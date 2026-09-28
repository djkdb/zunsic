import { create } from 'zustand';
import { playSfx } from '@/audio/sfx';
import { ACHIEVEMENT_MAP, type AchievementId } from '@/data/achievements';
import { STOCKS } from '@/data/stocks';
import type { DifficultyId, GameState, MarketStateId, TradeError, Transaction } from '@/domain/types';
import {
  breakingNewsFor,
  closeDay,
  createNewGame,
  debugAddCash,
  debugResetMarket,
  debugResetPortfolio,
  debugSetDay,
  debugSetPrice,
  finishGame,
  GameStateError,
  injectEvent,
  normalizeLoadedPhase,
  randomTemplateId,
  startNextDay,
  transition,
} from '@/engine/gameEngine';
import { computeFinalStats, evaluateAchievements, type FinalStats } from '@/engine/scoringEngine';
import { executeOrder, type OrderRequest } from '@/engine/tradingEngine';
import { playCard } from '@/engine/cardEngine';
import { xpForRun } from '@/data/levels';
import type { CardId, RivalId } from '@/domain/types';
import {
  clearGame,
  DEFAULT_META,
  loadGame,
  loadMeta,
  resetAllData,
  saveGame,
  saveMeta,
  storageAvailable,
  type MetaData,
  type RunRecord,
  type Settings,
} from '@/persistence/storage';

export interface Toast {
  id: number;
  kind: 'error' | 'info' | 'achievement' | 'success';
  title: string;
  message?: string;
}

export interface OrderFlash {
  id: number;
  tx: Transaction;
}

export interface FinishedRun {
  stats: FinalStats;
  records: { bestReturn: boolean; bestFinalValue: boolean; bestScore: boolean };
  /** First completed run — there was no previous record to beat. */
  firstRun: boolean;
  newAchievements: AchievementId[];
  /** Career XP before / gained by this run. */
  xpBefore: number;
  xpGained: number;
}

interface GameStore {
  game: GameState | null;
  meta: MetaData;
  storageOk: boolean;
  /** Last completed run (for the result screen). */
  finished: FinishedRun | null;
  selectedStockId: string;
  toasts: Toast[];
  orderFlash: OrderFlash | null;
  loadNotice: string | null;
  helpOpen: boolean;

  hydrate: () => void;
  newGame: (difficulty?: DifficultyId, seed?: number, rival?: RivalId) => void;
  activateCard: (card: CardId) => boolean;
  abandonGame: () => void;
  selectStock: (id: string) => void;
  placeOrder: (order: OrderRequest) => { ok: true; tx: Transaction } | { ok: false; error: TradeError };
  /** DAY_START presentation finished. */
  openMarket: () => void;
  /** NEWS_EVENT overlay dismissed. */
  dismissNews: () => void;
  /** TRADING → MARKET_CLOSED */
  closeMarket: () => void;
  /** MARKET_CLOSED → DAY_SUMMARY */
  showSummary: () => void;
  /** DAY_SUMMARY → next day / game complete */
  continueFromSummary: () => void;
  /** GAME_COMPLETE → RESULT */
  showResult: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetEverything: () => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  clearOrderFlash: () => void;
  clearLoadNotice: () => void;
  setHelpOpen: (open: boolean) => void;
  debug: {
    nextDay: () => void;
    trigger: (kind: 'BULL' | 'CRASH' | 'RANDOM') => void;
    addCash: (amount: number) => void;
    resetMarket: () => void;
    resetPortfolio: () => void;
    finish: () => void;
    setDay: (day: number) => void;
    setPrice: (stockId: string, price: number) => void;
    forceState: (state: MarketStateId) => void;
  };
}

let toastId = 0;
let flashId = 0;

/** Wrap engine calls so a simulation error never crashes the UI. */
function safe<T>(fn: () => T, onError: (e: unknown) => void): T | undefined {
  try {
    return fn();
  } catch (e) {
    onError(e);
    return undefined;
  }
}

export const useGameStore = create<GameStore>()((set, get) => {
  const fail = (e: unknown) => {
    console.error('[MARKET//30]', e);
    const message = e instanceof GameStateError ? '게임 상태 전환 오류가 발생했습니다.' : '시뮬레이션 오류가 발생했습니다.';
    get().pushToast({ kind: 'error', title: '시스템 오류', message });
  };

  /**
   * Apply a new game state and unlock any achievements it earned.
   * At game completion the result screen presents achievements itself, so no toasts.
   */
  const commit = (next: GameState): AchievementId[] => {
    const silent = next.phase === 'GAME_COMPLETE' || next.phase === 'RESULT';
    const meta = get().meta;
    const earned = safe(() => evaluateAchievements(next, STOCKS), fail) ?? [];
    const fresh = earned.filter((id) => !meta.achievements[id]);
    const runNew = earned.filter((id) => !next.runAchievements.includes(id));
    const game = runNew.length ? { ...next, runAchievements: [...next.runAchievements, ...runNew] } : next;
    if (fresh.length) {
      const now = Date.now();
      const achievements = { ...meta.achievements };
      for (const id of fresh) achievements[id] = now;
      set({ game, meta: { ...meta, achievements } });
      if (!silent) for (const id of fresh) {
        const def = ACHIEVEMENT_MAP.get(id);
        if (def) get().pushToast({ kind: 'achievement', title: def.title, message: def.description });
      }
    } else {
      set({ game });
    }
    return fresh;
  };

  const withGame = (fn: (g: GameState) => GameState) => {
    const g = get().game;
    if (!g) return;
    const next = safe(() => fn(g), fail);
    if (next) commit(next);
  };

  return {
    game: null,
    meta: structuredClone(DEFAULT_META),
    storageOk: true,
    finished: null,
    selectedStockId: STOCKS[0]?.id ?? '',
    toasts: [],
    orderFlash: null,
    loadNotice: null,
    helpOpen: false,

    hydrate: () => {
      const meta = loadMeta();
      const loaded = loadGame();
      let game: GameState | null = null;
      let loadNotice: string | null = null;
      if (loaded.status === 'ok') {
        const g = loaded.data;
        // Drop stocks that no longer exist in data; ignore unknown ones gracefully.
        const known = new Set(STOCKS.map((s) => s.id));
        const missing = STOCKS.some((s) => !(s.id in g.prices));
        if (missing) {
          loadNotice = '저장된 게임이 현재 버전과 호환되지 않아 새 게임이 필요합니다.';
          clearGame();
        } else {
          const holdings = Object.fromEntries(Object.entries(g.holdings).filter(([id]) => known.has(id)));
          game = { ...g, holdings, phase: normalizeLoadedPhase(g.phase) };
        }
      } else if (loaded.status === 'corrupt') {
        loadNotice = `저장 데이터가 손상되어 복구할 수 없었습니다 (${loaded.reason}). 새 게임을 시작해 주세요.`;
      }
      set({ meta, game, storageOk: storageAvailable(), loadNotice });
    },

    newGame: (difficulty, seed, rival) => {
      const d = difficulty ?? get().meta.settings.difficulty;
      const game = safe(() => createNewGame({ stocks: STOCKS, difficulty: d, seed, rival }), fail);
      if (!game) return;
      set({ game, finished: null, selectedStockId: STOCKS[0]?.id ?? '', orderFlash: null, toasts: [] });
      get().updateSettings({ difficulty: d });
    },

    activateCard: (card) => {
      const g = get().game;
      if (!g) return false;
      const r = playCard(g, card, STOCKS);
      if (!r.ok) {
        get().pushToast({ kind: 'error', title: '카드 사용 불가', message: r.error });
        playSfx('blocked');
        return false;
      }
      commit(r.value);
      playSfx('card');
      return true;
    },

    abandonGame: () => {
      clearGame();
      set({ game: null });
    },

    selectStock: (id) => {
      if (STOCKS.some((s) => s.id === id)) set({ selectedStockId: id });
    },

    placeOrder: (order) => {
      const g = get().game;
      if (!g) return { ok: false, error: { code: 'GAME_OVER', message: '진행 중인 게임이 없습니다.' } };
      const r = executeOrder(g, order, STOCKS);
      if (!r.ok) {
        get().pushToast({ kind: 'error', title: '주문 불가', message: r.error.message });
        playSfx('blocked');
        return r;
      }
      commit(r.value.state);
      playSfx(r.value.transaction.type === 'BUY' ? 'buy' : 'sell');
      set({ orderFlash: { id: ++flashId, tx: r.value.transaction } });
      return { ok: true, tx: r.value.transaction };
    },

    openMarket: () => {
      withGame((g) => {
        if (g.phase !== 'DAY_START') return g;
        return transition(g, breakingNewsFor(g).length > 0 ? 'NEWS_EVENT' : 'TRADING');
      });
      const g = get().game;
      // Loss shield paid out overnight.
      const payout = g?.cardLog.find((l) => l.day === g.day && l.card === 'SHIELD');
      if (payout) {
        get().pushToast({ kind: 'success', title: '🛡 손실 방어권 발동', message: payout.text });
        playSfx('shield');
      }
      // Quiet day with fresh rumors: make sure the player notices them.
      if (g?.phase === 'TRADING') {
        const hints = g.news.filter((n) => n.day === g.day && (n.kind === 'RUMOR' || n.kind === 'ANALYST'));
        if (hints[0]) {
          get().pushToast({
            kind: 'info',
            title: hints.length > 1 ? `새 시장 소문 ${hints.length}건 · 미확인` : '새 시장 소문 · 미확인',
            message: hints[0].title,
          });
        }
      }
    },

    dismissNews: () => withGame((g) => (g.phase === 'NEWS_EVENT' ? transition(g, 'TRADING') : g)),

    closeMarket: () => withGame((g) => (g.phase === 'TRADING' ? closeDay(g, STOCKS) : g)),

    showSummary: () =>
      withGame((g) => {
        if (g.phase !== 'MARKET_CLOSED') return g;
        const summary = transition(g, 'DAY_SUMMARY');
        // "Skip report" setting: go straight to the next session (never skip the final day).
        if (get().meta.settings.skipReport && g.day < g.totalDays) {
          set({ toasts: get().toasts.filter((t) => t.kind !== 'info') });
          return startNextDay(summary, STOCKS);
        }
        return summary;
      }),

    continueFromSummary: () => {
      // Yesterday's rumor alerts are stale once a new day starts.
      set({ toasts: get().toasts.filter((t) => t.kind !== 'info') });
      withGame((g) => {
        if (g.phase !== 'DAY_SUMMARY') return g;
        return g.day >= g.totalDays ? finishGame(g, STOCKS) : startNextDay(g, STOCKS);
      });
    },

    showResult: () => {
      const current = get().game;
      if (!current || (current.phase !== 'GAME_COMPLETE' && current.phase !== 'RESULT')) return;
      if (current.phase === 'RESULT' && get().finished) return;
      if (current.phase === 'GAME_COMPLETE') commit(current);
      const g = get().game!;
      const stats = safe(() => computeFinalStats(g, STOCKS), fail);
      if (!stats) return;
      const meta = get().meta;
      const pb = meta.personalBest;
      let records = { bestReturn: false, bestFinalValue: false, bestScore: false };
      let personalBest = pb;
      if (g.phase === 'GAME_COMPLETE') {
        records = {
          bestReturn: pb.bestReturn === null || stats.returnPct > pb.bestReturn,
          bestFinalValue: pb.bestFinalValue === null || stats.finalValue > pb.bestFinalValue,
          bestScore: pb.bestScore === null || stats.score.total > pb.bestScore,
        };
        const run: RunRecord = {
          finishedAt: g.finishedAt ?? Date.now(),
          difficulty: g.difficulty,
          seed: g.seed,
          finalValue: stats.finalValue,
          returnPct: stats.returnPct,
          score: stats.score.total,
          rank: stats.score.rank,
          style: stats.style.primary,
          trades: stats.totalTrades,
        };
        personalBest = {
          bestReturn: records.bestReturn ? stats.returnPct : pb.bestReturn,
          bestFinalValue: records.bestFinalValue ? stats.finalValue : pb.bestFinalValue,
          bestScore: records.bestScore ? stats.score.total : pb.bestScore,
          gamesPlayed: pb.gamesPlayed + 1,
          recent: [run, ...pb.recent].slice(0, 10),
        };
      }
      // "NEW" = first unlocked (globally) during this run.
      const newAchievements = g.runAchievements.filter(
        (id) => (meta.achievements[id] ?? 0) >= g.startedAt,
      ) as AchievementId[];
      const xpGained = g.phase === 'GAME_COMPLETE' ? xpForRun(stats.score.total, stats.rival.won && stats.totalTrades > 0) : 0;
      set({
        toasts: [], // the result screen presents achievements itself
        game: { ...g, phase: 'RESULT' },
        meta: { ...meta, personalBest, xp: meta.xp + xpGained },
        finished: {
          stats,
          records,
          newAchievements,
          firstRun: g.phase === 'GAME_COMPLETE' && pb.gamesPlayed === 0,
          xpBefore: meta.xp,
          xpGained,
        },
      });
    },

    updateSettings: (patch) => set({ meta: { ...get().meta, settings: { ...get().meta.settings, ...patch } } }),

    resetEverything: () => {
      resetAllData();
      set({ game: null, meta: structuredClone(DEFAULT_META), finished: null, toasts: [] });
    },

    pushToast: (t) => {
      const id = ++toastId;
      set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    },
    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    clearOrderFlash: () => set({ orderFlash: null }),
    clearLoadNotice: () => set({ loadNotice: null }),
    setHelpOpen: (open) => {
      set({ helpOpen: open });
      if (!open && !get().meta.settings.seenTutorial) get().updateSettings({ seenTutorial: true });
    },

    debug: {
      nextDay: () => {
        const s = get();
        if (s.game?.phase === 'TRADING') s.closeMarket();
        if (get().game?.phase === 'MARKET_CLOSED') s.showSummary();
        if (get().game?.phase === 'DAY_SUMMARY') s.continueFromSummary();
      },
      trigger: (kind) => {
        withGame((g) => {
          const id = kind === 'BULL' ? 'mega-ai-boom' : kind === 'CRASH' ? 'mega-crash' : randomTemplateId(g);
          return injectEvent(g, id, STOCKS);
        });
        get().debug.nextDay();
      },
      addCash: (amount) => withGame((g) => debugAddCash(g, amount)),
      resetMarket: () => withGame((g) => debugResetMarket(g, STOCKS)),
      resetPortfolio: () => withGame((g) => debugResetPortfolio(g)),
      finish: () =>
        withGame((g) => {
          if (g.phase === 'GAME_COMPLETE' || g.phase === 'RESULT') return g;
          const ready = g.phase === 'TRADING' || g.phase === 'DAY_SUMMARY' || g.phase === 'MARKET_CLOSED' ? g : { ...g, phase: 'TRADING' as const };
          return finishGame(ready, STOCKS);
        }),
      setDay: (day) => withGame((g) => debugSetDay(g, day, STOCKS)),
      setPrice: (stockId, price) => withGame((g) => debugSetPrice(g, stockId, price)),
      forceState: (state) =>
        withGame((g) => ({ ...g, marketState: state, marketStateHistory: [...g.marketStateHistory.slice(0, -1), state] })),
    },
  };
});

// ───────────────────────── Persistence wiring ─────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedGame: GameState | null = null;
let lastSavedMeta: MetaData | null = null;
let warnedStorage = false;

export function startPersistence(): () => void {
  // Whatever was just hydrated is already on disk — only write real changes
  // (avoids clobbering data another tab saved in the meantime).
  lastSavedGame = useGameStore.getState().game;
  lastSavedMeta = useGameStore.getState().meta;
  const flush = () => {
    const { game, meta } = useGameStore.getState();
    let ok = true;
    if (game !== lastSavedGame) {
      if (game) ok = saveGame(game) && ok;
      lastSavedGame = game;
    }
    if (meta !== lastSavedMeta) {
      ok = saveMeta(meta) && ok;
      lastSavedMeta = meta;
    }
    if (!ok && !warnedStorage) {
      warnedStorage = true;
      useGameStore.getState().pushToast({
        kind: 'error',
        title: '저장 실패',
        message: '브라우저 저장소를 사용할 수 없어 진행 상황이 저장되지 않습니다.',
      });
    }
  };
  const unsub = useGameStore.subscribe((state, prev) => {
    if (state.game === prev.game && state.meta === prev.meta) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  });
  const onHide = () => flush();
  window.addEventListener('pagehide', onHide);
  return () => {
    unsub();
    window.removeEventListener('pagehide', onHide);
    if (saveTimer) clearTimeout(saveTimer);
  };
}
