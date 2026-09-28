import { TICKS_PER_DAY } from '@/domain/constants';
import type { PricePoint } from '@/domain/types';

/** Tick → pseudo market clock (09:00 – 15:30). */
export function tickClock(tick: number): string {
  const minutes = 9 * 60 + Math.round((tick / TICKS_PER_DAY) * 390);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export type Period = '1D' | '1W' | '1M';

/** 1D = today's session (from previous close), 1W = last 7 sessions, 1M = everything. */
export function sliceForPeriod(series: readonly PricePoint[], period: Period): PricePoint[] {
  if (period === '1M') return [...series];
  const n = period === '1D' ? TICKS_PER_DAY + 1 : TICKS_PER_DAY * 7 + 1;
  return series.slice(Math.max(0, series.length - n));
}
