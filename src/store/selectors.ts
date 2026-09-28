import { EVENT_TEMPLATE_MAP } from '@/data/events';
import { STOCKS } from '@/data/stocks';
import { TICKS_PER_DAY } from '@/domain/constants';
import type { GameState, NewsItem, PricePoint } from '@/domain/types';
import { fillTemplate } from '@/lib/format';
import { visibleNews } from '@/engine/gameEngine';
import { computeIndex } from '@/engine/marketEngine';
import { valuePortfolio, type Valuation } from '@/engine/portfolioEngine';
import { useGameStore } from './gameStore';

/**
 * Derived data with per-state memoization (WeakMap keyed by the immutable GameState),
 * so many components can read valuations without recomputing.
 *
 * During DAY_START / NEWS_EVENT the UI shows the previous close: the new prices are
 * revealed only after the breaking news lands.
 */

export function isPreReveal(game: Pick<GameState, 'phase'>): boolean {
  return game.phase === 'DAY_START' || game.phase === 'NEWS_EVENT';
}

const valuationCache = new WeakMap<GameState, Valuation>();
export function getValuation(game: GameState): Valuation {
  let v = valuationCache.get(game);
  if (!v) {
    const pre = isPreReveal(game);
    const prices = pre ? game.prevPrices : game.prices;
    const prev = pre ? prevDayClose(game, game.day - 1) : game.prevPrices;
    const valueHistory = pre ? game.valueHistory.slice(0, game.day) : game.valueHistory;
    v = valuePortfolio({ ...game, valueHistory }, prices, prev, STOCKS);
    valuationCache.set(game, v);
  }
  return v;
}

/** Close price of each stock at the end of `day` (from tick history). */
export function prevDayClose(game: GameState, day: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of STOCKS) {
    const series = game.history[s.id] ?? [];
    let price = s.initialPrice;
    for (let i = series.length - 1; i >= 0; i--) {
      const p = series[i];
      if (p && p.day <= day) {
        price = p.price;
        break;
      }
    }
    out[s.id] = price;
  }
  return out;
}

export function displayPrices(game: GameState): { prices: Record<string, number>; prev: Record<string, number> } {
  if (isPreReveal(game)) return { prices: game.prevPrices, prev: prevDayClose(game, game.day - 2) };
  return { prices: game.prices, prev: game.prevPrices };
}

/** History visible to the player (hides today's ticks before reveal). */
export function displayHistory(game: GameState, stockId: string): PricePoint[] {
  const series = game.history[stockId] ?? [];
  return isPreReveal(game) ? series.slice(0, Math.max(0, series.length - TICKS_PER_DAY)) : series;
}

export function displayIndexHistory(game: GameState): PricePoint[] {
  return isPreReveal(game) ? game.indexHistory.slice(0, Math.max(0, game.indexHistory.length - TICKS_PER_DAY)) : game.indexHistory;
}

export interface IndexView {
  value: number;
  change: number;
  dayChange: number;
}
const indexCache = new WeakMap<GameState, IndexView>();
export function getIndexView(game: GameState): IndexView {
  let v = indexCache.get(game);
  if (!v) {
    const { prices, prev } = displayPrices(game);
    const base = computeIndex(Object.fromEntries(STOCKS.map((s) => [s.id, s.initialPrice])), STOCKS);
    const value = computeIndex(prices, STOCKS);
    v = { value, change: value / base - 1, dayChange: value / computeIndex(prev, STOCKS) - 1 };
    indexCache.set(game, v);
  }
  return v;
}

const newsCache = new WeakMap<GameState, NewsItem[]>();
/** Visible news, newest first. Before reveal, today's event news is still hidden. */
export function getVisibleNews(game: GameState): NewsItem[] {
  let v = newsCache.get(game);
  if (!v) {
    const day = isPreReveal(game) ? game.day - 1 : game.day;
    v = visibleNews({ news: game.news, day }).sort((a, b) => b.day - a.day);
    newsCache.set(game, v);
  }
  return v;
}

/** Hook: current game (throws-free; components render fallbacks when null). */
export const useGame = () => useGameStore((s) => s.game);

/** Today's unconfirmed rumors / analyst notes (hidden until the market opens). */
export function getTodayHints(game: GameState): NewsItem[] {
  if (isPreReveal(game)) return [];
  return game.news.filter((n) => n.day === game.day && (n.kind === 'RUMOR' || n.kind === 'ANALYST'));
}

export interface CalendarEntry {
  key: string;
  day: number;
  inDays: number;
  label: string;
  stockIds: string[];
}

/**
 * Publicly scheduled events in the next few days (earnings, trial readouts, rate decisions).
 * Only the date and subject are known — never the direction.
 */
export function getUpcomingCalendar(game: GameState, horizon = 3): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  const seen = new Set<string>();
  for (const ev of game.schedule) {
    if (ev.day <= game.day || ev.day > game.day + horizon) continue;
    const template = EVENT_TEMPLATE_MAP.get(ev.templateId);
    if (!template?.calendar) continue;
    const stock = ev.scope === 'COMPANY' ? STOCKS.find((s) => s.id === ev.targets[0]) : undefined;
    const label = fillTemplate(template.calendar, { ticker: stock?.ticker ?? '', name: stock?.name ?? '' });
    const key = `${ev.day}-${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, day: ev.day, inDays: ev.day - game.day, label, stockIds: stock ? [stock.id] : [] });
  }
  return out.sort((a, b) => a.day - b.day);
}
