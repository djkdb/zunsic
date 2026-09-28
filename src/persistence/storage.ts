import { SAVE_VERSION } from '@/domain/constants';
import type { DifficultyId, GameState } from '@/domain/types';

/**
 * localStorage persistence with validation and safe fallbacks.
 * Storage failures (private mode, quota, corrupted JSON) never crash the game.
 */

const KEYS = {
  save: 'market30:save:v1',
  meta: 'market30:meta:v1',
  corrupt: 'market30:corrupt-backup',
} as const;

export interface PersonalBest {
  bestReturn: number | null;
  bestFinalValue: number | null;
  bestScore: number | null;
  gamesPlayed: number;
  recent: RunRecord[];
}

export interface RunRecord {
  finishedAt: number;
  difficulty: DifficultyId;
  seed: number;
  finalValue: number;
  returnPct: number;
  score: number;
  rank: string;
  style: string;
  trades: number;
}

export interface Settings {
  reducedMotion: 'system' | 'on' | 'off';
  fastMode: boolean;
  difficulty: DifficultyId;
  /** Skip the daily report modal and go straight to the next day. */
  skipReport: boolean;
  /** First-game "how to play" guide has been seen. */
  seenTutorial: boolean;
}

export interface MetaData {
  version: number;
  achievements: Record<string, number>; // id → unlockedAt
  personalBest: PersonalBest;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  reducedMotion: 'system',
  fastMode: false,
  difficulty: 'NORMAL',
  skipReport: false,
  seenTutorial: false,
};

export const DEFAULT_META: MetaData = {
  version: SAVE_VERSION,
  achievements: {},
  personalBest: { bestReturn: null, bestFinalValue: null, bestScore: null, gamesPlayed: 0, recent: [] },
  settings: DEFAULT_SETTINGS,
};

export type LoadResult<T> = { status: 'ok'; data: T } | { status: 'empty' } | { status: 'corrupt'; reason: string };

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probe = '__market30_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return getStorage() !== null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Structural validation of a saved game. Returns a reason string when invalid. */
export function validateGameState(value: unknown): string | null {
  if (!isObj(value)) return 'not an object';
  if (value.version !== SAVE_VERSION) return `unsupported version ${String(value.version)}`;
  const numFields = ['seed', 'day', 'totalDays', 'startingCash', 'cash', 'realizedPnL', 'txCounter', 'capitalInjected'];
  for (const f of numFields) if (!isNum(value[f])) return `invalid field ${f}`;
  if ((value.cash as number) < 0) return 'negative cash';
  if ((value.day as number) < 1 || (value.day as number) > (value.totalDays as number)) return 'day out of range';
  for (const f of ['holdings', 'prices', 'prevPrices', 'history', 'momentum']) if (!isObj(value[f])) return `invalid ${f}`;
  for (const f of ['schedule', 'rumors', 'news', 'transactions', 'valueHistory', 'snapshots', 'reports', 'indexHistory', 'crashDays', 'marketStateHistory', 'runAchievements']) {
    if (!Array.isArray(value[f])) return `invalid ${f}`;
  }
  for (const [id, p] of Object.entries(value.prices as Record<string, unknown>)) {
    if (!isNum(p) || p <= 0) return `invalid price ${id}`;
  }
  for (const [id, h] of Object.entries(value.holdings as Record<string, unknown>)) {
    if (!isObj(h) || !isNum(h.shares) || !isNum(h.avgPrice) || h.shares < 0 || h.stockId !== id) return `invalid holding ${id}`;
  }
  if (typeof value.phase !== 'string') return 'invalid phase';
  return null;
}

export function loadGame(): LoadResult<GameState> {
  const storage = getStorage();
  if (!storage) return { status: 'empty' };
  let raw: string | null;
  try {
    raw = storage.getItem(KEYS.save);
  } catch {
    return { status: 'empty' };
  }
  if (!raw) return { status: 'empty' };
  try {
    const parsed: unknown = JSON.parse(raw);
    const reason = validateGameState(parsed);
    if (reason) {
      backupCorrupt(raw);
      return { status: 'corrupt', reason };
    }
    return { status: 'ok', data: parsed as GameState };
  } catch (e) {
    backupCorrupt(raw);
    return { status: 'corrupt', reason: e instanceof Error ? e.message : 'parse error' };
  }
}

function backupCorrupt(raw: string) {
  try {
    const storage = getStorage();
    storage?.setItem(KEYS.corrupt, raw.slice(0, 200_000));
    storage?.removeItem(KEYS.save);
  } catch {
    /* ignore */
  }
}

export function saveGame(state: GameState): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(KEYS.save, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearGame(): void {
  try {
    getStorage()?.removeItem(KEYS.save);
  } catch {
    /* ignore */
  }
}

export function loadMeta(): MetaData {
  const storage = getStorage();
  if (!storage) return structuredClone(DEFAULT_META);
  try {
    const raw = storage.getItem(KEYS.meta);
    if (!raw) return structuredClone(DEFAULT_META);
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed)) return structuredClone(DEFAULT_META);
    const pb = isObj(parsed.personalBest) ? parsed.personalBest : {};
    const settings = isObj(parsed.settings) ? parsed.settings : {};
    return {
      version: SAVE_VERSION,
      achievements: isObj(parsed.achievements)
        ? Object.fromEntries(Object.entries(parsed.achievements).filter(([, v]) => isNum(v))) as Record<string, number>
        : {},
      personalBest: {
        bestReturn: isNum(pb.bestReturn) ? pb.bestReturn : null,
        bestFinalValue: isNum(pb.bestFinalValue) ? pb.bestFinalValue : null,
        bestScore: isNum(pb.bestScore) ? pb.bestScore : null,
        gamesPlayed: isNum(pb.gamesPlayed) ? pb.gamesPlayed : 0,
        recent: Array.isArray(pb.recent) ? (pb.recent.filter(isObj) as unknown as RunRecord[]).slice(0, 10) : [],
      },
      settings: {
        reducedMotion:
          settings.reducedMotion === 'on' || settings.reducedMotion === 'off' ? settings.reducedMotion : 'system',
        fastMode: settings.fastMode === true,
        difficulty:
          settings.difficulty === 'CASUAL' || settings.difficulty === 'HARD' ? settings.difficulty : 'NORMAL',
        skipReport: settings.skipReport === true,
        seenTutorial: settings.seenTutorial === true,
      },
    };
  } catch {
    return structuredClone(DEFAULT_META);
  }
}

export function saveMeta(meta: MetaData): boolean {
  try {
    getStorage()?.setItem(KEYS.meta, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function resetAllData(): void {
  try {
    const storage = getStorage();
    for (const key of Object.values(KEYS)) storage?.removeItem(key);
  } catch {
    /* ignore */
  }
}
