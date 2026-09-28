import type { Severity } from './types';

export const GAME_TITLE = 'MARKET//30';
export const GAME_SUBTITLE = '30 DAYS. ₩1,000,000. ONE MARKET.';
export const TOTAL_DAYS = 30;
export const SAVE_VERSION = 1;
/** Intraday ticks generated per day (for chart texture). */
export const TICKS_PER_DAY = 12;
/** Tick at which breaking news hits the tape (jump placement on the chart). */
export const NEWS_TICK = 4;
/** Base index level. */
export const INDEX_BASE = 1000;

/** Impact ranges per severity (fraction of price), before sensitivity/market multipliers. */
export const SEVERITY_RANGE: Record<Severity, [number, number]> = {
  MINOR: [0.01, 0.03],
  MODERATE: [0.03, 0.08],
  MAJOR: [0.08, 0.15],
  EXTREME: [0.15, 0.3],
};

export const SEVERITY_RANK: Record<Severity, number> = { MINOR: 0, MODERATE: 1, MAJOR: 2, EXTREME: 3 };

/** Portfolio share in a single stock that triggers the concentration warning. */
export const CONCENTRATION_WARNING = 0.5;
