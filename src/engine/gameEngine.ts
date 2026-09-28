import { DIFFICULTIES } from '@/data/difficulties';
import { EVENT_TEMPLATE_MAP } from '@/data/events';
import { SAVE_VERSION, SEVERITY_RANK, TOTAL_DAYS } from '@/domain/constants';
import type {
  RivalId,
  DailyReport,
  DifficultyId,
  GamePhase,
  GameState,
  MarketStateId,
  NewsItem,
  ScheduledEvent,
  StockDefinition,
} from '@/domain/types';
import { createRng, generateSeed, mixSeed, STREAM } from '@/lib/rng';
import { generateSchedule, instantiateEvent } from './eventScheduler';
import { computeIndex, generatePrehistory, simulateDay } from './marketEngine';
import { takeSnapshot, totalValueAt } from './portfolioEngine';
import { executeOrder } from './tradingEngine';
import { createRival, stepRival } from './rivalEngine';
import { emptyCards, shieldRefunds } from './cardEngine';
import { RIVALS } from '@/data/rivals';

/**
 * Game engine — lifecycle and the phase state machine.
 *
 *   SETUP → DAY_START → (NEWS_EVENT) → TRADING → MARKET_CLOSED → DAY_SUMMARY
 *        ↑__________________________________________________________| (next day)
 *   DAY_SUMMARY (last day) → GAME_COMPLETE → RESULT
 */

export const PHASE_TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  SETUP: ['DAY_START'],
  DAY_START: ['NEWS_EVENT', 'TRADING'],
  NEWS_EVENT: ['TRADING'],
  TRADING: ['MARKET_CLOSED', 'GAME_COMPLETE'],
  MARKET_CLOSED: ['DAY_SUMMARY'],
  DAY_SUMMARY: ['DAY_START', 'GAME_COMPLETE'],
  GAME_COMPLETE: ['RESULT'],
  RESULT: [],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

export class GameStateError extends Error {}

export function transition(state: GameState, to: GamePhase): GameState {
  if (state.phase === to) return state;
  if (!canTransition(state.phase, to)) {
    throw new GameStateError(`Invalid phase transition ${state.phase} → ${to}`);
  }
  return { ...state, phase: to };
}

/** Fill fields added in later updates so older saves keep working. */
export function normalizeGame(game: GameState): GameState {
  const g = game as Partial<GameState> & GameState;
  return {
    ...g,
    rival: g.rival ?? { ...createRival('INDEX_GRANNY', g.startingCash), valueHistory: g.valueHistory.map(() => g.startingCash) },
    cards: { ...emptyCards(), ...(g.cards ?? {}) },
    bonusPnL: g.bonusPnL ?? 0,
    cardLog: g.cardLog ?? [],
  };
}

/** Phases that are pure presentation and should resume into a stable phase after reload. */
export function normalizeLoadedPhase(phase: GamePhase): GamePhase {
  if (phase === 'DAY_START' || phase === 'NEWS_EVENT') return 'TRADING';
  if (phase === 'MARKET_CLOSED') return 'DAY_SUMMARY';
  if (phase === 'SETUP') return 'TRADING';
  return phase;
}

export function createNewGame(opts: {
  stocks: readonly StockDefinition[];
  difficulty?: DifficultyId;
  seed?: number;
  totalDays?: number;
  rival?: RivalId;
}): GameState {
  const difficultyId = opts.difficulty ?? 'NORMAL';
  const difficulty = DIFFICULTIES[difficultyId];
  const seed = opts.seed ?? generateSeed();
  const totalDays = opts.totalDays ?? TOTAL_DAYS;
  const { stocks } = opts;

  const pre = generatePrehistory(seed, stocks, difficulty);
  const schedule = generateSchedule({ seed, totalDays, difficulty, stocks });
  const initialPrices = Object.fromEntries(stocks.map((s) => [s.id, s.initialPrice]));
  const rivalId = opts.rival ?? RIVALS[createRng(mixSeed(seed, 555)).int(0, RIVALS.length - 1)]!.id;

  const base: GameState = {
    version: SAVE_VERSION,
    seed,
    difficulty: difficultyId,
    day: 0,
    totalDays,
    phase: 'SETUP',
    startingCash: difficulty.startingCash,
    capitalInjected: 0,
    cash: difficulty.startingCash,
    holdings: {},
    prices: initialPrices,
    prevPrices: initialPrices,
    history: pre.history,
    indexHistory: pre.indexHistory,
    marketState: 'NEUTRAL',
    marketStateHistory: [],
    momentum: {},
    schedule: schedule.events,
    rumors: schedule.rumors,
    news: schedule.news,
    transactions: [],
    realizedPnL: 0,
    valueHistory: [difficulty.startingCash],
    snapshots: [],
    reports: [],
    crashDays: [],
    runAchievements: [],
    startedAt: Date.now(),
    txCounter: 0,
    rival: createRival(rivalId, difficulty.startingCash),
    cards: emptyCards(),
    bonusPnL: 0,
    cardLog: [],
  };

  // Day 1 opens with a quiet session (no events scheduled on day 1).
  return transition(simulateNextDay(base, stocks), 'DAY_START');
}

/** Price the next day and append news. Does not touch phase. */
export function simulateNextDay(
  state: GameState,
  stocks: readonly StockDefinition[],
  opts: { forceState?: MarketStateId } = {},
): GameState {
  const day = state.day + 1;
  const difficulty = DIFFICULTIES[state.difficulty];
  const events = state.schedule.filter((e) => e.day === day);
  const hintedTomorrow = state.schedule.filter((e) => e.hintDay === day);
  const rumors = state.rumors.filter((r) => r.day === day);

  const result = simulateDay({
    seed: state.seed,
    day,
    stocks,
    difficulty,
    prevPrices: state.prices,
    prevState: state.marketState,
    momentum: state.momentum,
    events,
    hintedTomorrow,
    rumors,
    forceState: opts.forceState,
  });

  const history: GameState['history'] = {};
  for (const s of stocks) history[s.id] = [...(state.history[s.id] ?? []), ...(result.ticks[s.id] ?? [])];

  // News for today's events, with realized impacts attached.
  const eventNews: NewsItem[] = events.map((ev) => eventToNews(ev, result.changes, result.marketChange));
  if (result.marketState !== state.marketState && (result.marketState === 'BULL' || result.marketState === 'BEAR' || result.marketState === 'VOLATILE') && !events.some((e) => e.marketShift)) {
    eventNews.push(regimeNews(day, result.marketState, result.marketChange));
  }

  // Chance card: loss shield bought yesterday settles against today's move.
  const shield = shieldRefunds(state, result.prices);
  const cardLog = shield.total
    ? [
        ...state.cardLog,
        {
          day,
          card: 'SHIELD' as const,
          amount: shield.total,
          text: `손실 방어권 발동: 보험금 ${shield.total.toLocaleString('ko-KR')}원 지급 (${shield.lines
            .map((l) => stocks.find((s) => s.id === l.split(':')[0])?.ticker ?? l)
            .join(', ')})`,
        },
      ]
    : state.cardLog;

  const next: GameState = {
    ...state,
    cash: state.cash + shield.total,
    bonusPnL: state.bonusPnL + shield.total,
    cardLog,
    day,
    prevPrices: state.prices,
    prices: result.prices,
    history,
    indexHistory: [...state.indexHistory, ...result.indexTicks],
    marketState: result.marketState,
    marketStateHistory: [...state.marketStateHistory, result.marketState],
    momentum: result.momentum,
    news: [...state.news, ...eventNews],
    crashDays: result.marketState === 'CRASH' ? [...state.crashDays, day] : state.crashDays,
  };
  next.rival = stepRival(state.rival, next, stocks);
  const valueHistory = [...next.valueHistory];
  valueHistory[day] = totalValueAt(next, next.prices);
  return { ...next, valueHistory };
}

function eventToNews(ev: ScheduledEvent, changes: Record<string, number>, marketChange: number): NewsItem {
  const affected = [...ev.targets, ...ev.spillTargets];
  const impacts: Record<string, number> = {};
  for (const id of affected) impacts[id] = changes[id] ?? 0;
  const breaking = SEVERITY_RANK[ev.severity] >= SEVERITY_RANK.MODERATE || ev.scope === 'MARKET';
  return {
    id: `news-${ev.uid}`,
    day: ev.day,
    kind: ev.scope === 'MARKET' && Math.abs(ev.marketImpact) >= 0.03 ? 'MARKET' : breaking ? 'BREAKING' : 'NEWS',
    title: ev.title,
    summary: ev.summary,
    severity: ev.severity,
    direction: ev.direction,
    affected,
    impacts,
    marketChange,
    eventUid: ev.uid,
  };
}

function regimeNews(day: number, state: MarketStateId, marketChange: number): NewsItem {
  const text: Partial<Record<MarketStateId, { title: string; summary: string }>> = {
    BULL: { title: '매수세 복귀… 시장 분위기 강세 전환', summary: '매수세가 살아나며 시장 분위기가 강세로 전환됐다.' },
    BEAR: { title: '매도 우위 지속… 시장 분위기 약세 전환', summary: '매도 우위가 이어지며 시장 분위기가 약세로 기울었다.' },
    VOLATILE: { title: '투자자 불안 확산… 변동성 급등', summary: '투자자 불안이 커지며 시장 변동성이 확대됐다.' },
  };
  const t = text[state] ?? { title: '시장 동향', summary: '' };
  return {
    id: `regime-${day}`,
    day,
    kind: 'NEWS',
    title: t.title,
    summary: t.summary,
    severity: 'MINOR',
    affected: [],
    marketChange,
  };
}

/** Close the trading day: record snapshot + daily report. TRADING → MARKET_CLOSED. */
export function closeDay(state: GameState, stocks: readonly StockDefinition[]): GameState {
  const closed = transition(state, 'MARKET_CLOSED');
  const snapshot = takeSnapshot(closed, closed.prices, stocks);
  const prevValue = closed.valueHistory[closed.day - 1] ?? closed.startingCash;
  const value = snapshot.totalValue;
  const valueHistory = [...closed.valueHistory];
  valueHistory[closed.day] = value;

  let best: DailyReport['best'];
  let worst: DailyReport['worst'];
  for (const s of stocks) {
    const change = (closed.prices[s.id] ?? 0) / (closed.prevPrices[s.id] ?? 1) - 1;
    if (!best || change > best.change) best = { stockId: s.id, change };
    if (!worst || change < worst.change) worst = { stockId: s.id, change };
  }

  // Portfolio change for the day excludes capital injected today (debug) — compare like for like.
  const report: DailyReport = {
    day: closed.day,
    marketChange: computeIndex(closed.prices, stocks) / computeIndex(closed.prevPrices, stocks) - 1,
    portfolioChange: prevValue > 0 ? value / prevValue - 1 : 0,
    portfolioValue: value,
    best,
    worst,
    newsIds: closed.news.filter((n) => n.day === closed.day).map((n) => n.id),
    tradeCount: closed.transactions.filter((t) => t.day === closed.day && !t.settlement).length,
    marketState: closed.marketState,
  };

  return {
    ...closed,
    valueHistory,
    snapshots: [...closed.snapshots.filter((s) => s.day !== closed.day), snapshot],
    reports: [...closed.reports.filter((r) => r.day !== closed.day), report],
  };
}

/** DAY_SUMMARY → DAY_START of the next day (or GAME_COMPLETE after the last day). */
export function startNextDay(
  state: GameState,
  stocks: readonly StockDefinition[],
  opts: { forceState?: MarketStateId } = {},
): GameState {
  if (state.day >= state.totalDays) return finishGame(state, stocks);
  return transition(simulateNextDay(state, stocks, opts), 'DAY_START');
}

/** Liquidate every position at the final price and complete the game. */
export function finishGame(state: GameState, stocks: readonly StockDefinition[]): GameState {
  let s: GameState = state;
  if (s.phase === 'TRADING') s = closeDay(s, stocks);
  if (s.phase === 'MARKET_CLOSED') s = transition(s, 'DAY_SUMMARY');
  for (const h of Object.values(s.holdings)) {
    if (h.shares <= 0) continue;
    const r = executeOrder(s, { type: 'SELL', stockId: h.stockId, shares: h.shares }, stocks, {
      settlement: true,
      skipPhaseCheck: true,
    });
    if (r.ok) s = r.value.state;
  }
  const valueHistory = [...s.valueHistory];
  valueHistory[s.day] = s.cash;
  return { ...transition(s, 'GAME_COMPLETE'), valueHistory, finishedAt: Date.now() };
}

/** News visible to the player (hints for future days stay hidden). */
export function visibleNews(state: Pick<GameState, 'news' | 'day'>): NewsItem[] {
  return state.news.filter((n) => n.day <= state.day);
}

/** Headline news for the day's BREAKING overlay, most severe first. */
export function breakingNewsFor(state: Pick<GameState, 'news' | 'day'>, day = state.day): NewsItem[] {
  return state.news
    .filter((n) => n.day === day && (n.kind === 'BREAKING' || n.kind === 'MARKET'))
    .sort((a, b) => {
      const kind = (b.kind === 'MARKET' ? 1 : 0) - (a.kind === 'MARKET' ? 1 : 0);
      return kind !== 0 ? kind : SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    });
}

// ───────────────────────── Debug helpers (dev tools only) ─────────────────────────

/** Queue an event for tomorrow. */
export function injectEvent(
  state: GameState,
  templateId: string,
  stocks: readonly StockDefinition[],
  opts: { target?: string } = {},
): GameState {
  const template = EVENT_TEMPLATE_MAP.get(templateId);
  if (!template || state.day >= state.totalDays) return state;
  const rng = createRng(mixSeed(state.seed, STREAM.DEBUG, state.day, state.schedule.length));
  const ev = instantiateEvent(template, state.day + 1, { stocks, difficulty: DIFFICULTIES[state.difficulty] }, rng, {
    forcedTarget: opts.target,
  });
  if (!ev) return state;
  ev.injected = true;
  return { ...state, schedule: [...state.schedule, ev].sort((a, b) => a.day - b.day) };
}

export function randomTemplateId(state: GameState): string {
  const rng = createRng(mixSeed(state.seed, STREAM.DEBUG, state.day, 31));
  const ids = [...EVENT_TEMPLATE_MAP.values()].filter((t) => !t.mega).map((t) => t.id);
  return rng.pick(ids);
}

export function debugAddCash(state: GameState, amount: number): GameState {
  return { ...state, cash: state.cash + amount, capitalInjected: state.capitalInjected + amount };
}

export function debugSetPrice(state: GameState, stockId: string, price: number): GameState {
  if (!(stockId in state.prices) || !Number.isFinite(price) || price <= 0) return state;
  const rounded = Math.round(price);
  const history = { ...state.history };
  const series = [...(history[stockId] ?? [])];
  const last = series[series.length - 1];
  if (last) series[series.length - 1] = { ...last, price: rounded };
  history[stockId] = series;
  const prices = { ...state.prices, [stockId]: rounded };
  const valueHistory = [...state.valueHistory];
  valueHistory[state.day] = totalValueAt(state, prices);
  return { ...state, prices, history, valueHistory };
}

/** Fast-forward (no trading) until `targetDay`. */
export function debugSetDay(state: GameState, targetDay: number, stocks: readonly StockDefinition[]): GameState {
  let s = state;
  const target = Math.min(Math.max(targetDay, s.day), s.totalDays);
  while (s.day < target) {
    s = simulateNextDay(s, stocks);
    const snap = takeSnapshot(s, s.prices, stocks);
    s = { ...s, snapshots: [...s.snapshots, snap] };
  }
  return { ...s, phase: 'TRADING' };
}

export function debugResetPortfolio(state: GameState): GameState {
  return {
    ...state,
    cash: state.startingCash,
    capitalInjected: 0,
    holdings: {},
    realizedPnL: 0,
    bonusPnL: 0,
    transactions: [],
    valueHistory: state.valueHistory.map(() => state.startingCash),
  };
}

/** Rebuild the market from a fresh seed at the current day. Portfolio is kept. */
export function debugResetMarket(state: GameState, stocks: readonly StockDefinition[]): GameState {
  const seed = generateSeed();
  const difficulty = DIFFICULTIES[state.difficulty];
  const pre = generatePrehistory(seed, stocks, difficulty);
  const schedule = generateSchedule({ seed, totalDays: state.totalDays, difficulty, stocks });
  const prices = Object.fromEntries(stocks.map((s) => [s.id, s.initialPrice]));
  const valueHistory = [...state.valueHistory];
  valueHistory[state.day] = totalValueAt(state, prices);
  return {
    ...state,
    seed,
    prices,
    prevPrices: prices,
    history: pre.history,
    indexHistory: pre.indexHistory,
    marketState: 'NEUTRAL',
    momentum: {},
    schedule: schedule.events.filter((e) => e.day > state.day),
    rumors: schedule.rumors.filter((r) => r.day > state.day),
    news: [...state.news.filter((n) => n.day <= state.day), ...schedule.news.filter((n) => n.day > state.day)],
    valueHistory,
  };
}
