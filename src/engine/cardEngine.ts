import { SEVERITY_RANK } from '@/domain/constants';
import type { CardId, CardUse, GameState, Result, StockDefinition } from '@/domain/types';
import { createRng, mixSeed } from '@/lib/rng';
import { upcomingCalendarEvents } from './calendar';

/**
 * Chance cards — three one-shot power-ups per game. When to play them is the strategy.
 *  ANALYST : outlook (up/down) for the next scheduled event, right ~80% of the time
 *  SHIELD  : for the next session, any single-stock loss beyond −5% is refunded in cash
 *  PAPER   : read tomorrow's headlines one day early
 */

export const CARD_IDS: readonly CardId[] = ['ANALYST', 'SHIELD', 'PAPER'];
export const SHIELD_THRESHOLD = 0.05;
export const ANALYST_ACCURACY = 0.8;
/** Score bonus for each card left unused at the end. */
export const UNUSED_CARD_BONUS = 250;

export function emptyCards(): Record<CardId, CardUse> {
  return { ANALYST: {}, SHIELD: {}, PAPER: {} };
}

export function cardAvailability(state: GameState, card: CardId, stocks: readonly StockDefinition[]): { ok: true } | { ok: false; reason: string } {
  if (state.cards[card]?.usedDay !== undefined) return { ok: false, reason: '이미 사용한 카드입니다.' };
  if (state.phase !== 'TRADING') return { ok: false, reason: '장이 열려 있을 때만 쓸 수 있습니다.' };
  if (card === 'ANALYST' && upcomingCalendarEvents(state, stocks, 3).length === 0) {
    return { ok: false, reason: '앞으로 3일간 예정된 일정이 없습니다.' };
  }
  if ((card === 'SHIELD' || card === 'PAPER') && state.day >= state.totalDays) {
    return { ok: false, reason: '마지막 날에는 쓸 수 없습니다.' };
  }
  return { ok: true };
}

export function playCard(state: GameState, card: CardId, stocks: readonly StockDefinition[]): Result<GameState, string> {
  const available = cardAvailability(state, card, stocks);
  if (!available.ok) return { ok: false, error: available.reason };
  const cards = { ...state.cards };

  if (card === 'ANALYST') {
    const next = upcomingCalendarEvents(state, stocks, 3)[0]!;
    const rng = createRng(mixSeed(state.seed, 4242, next.event.day, next.event.magnitude * 1e6));
    const correct = rng.next() < ANALYST_ACCURACY;
    cards.ANALYST = {
      usedDay: state.day,
      analyst: { label: next.label, eventDay: next.event.day, outlook: (correct ? next.event.direction : -next.event.direction) as 1 | -1 },
    };
  } else if (card === 'PAPER') {
    const tomorrow = state.schedule
      .filter((e) => e.day === state.day + 1)
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
      .slice(0, 2)
      .map((e) => ({ title: e.title, summary: e.summary, direction: e.direction }));
    cards.PAPER = { usedDay: state.day, paper: { day: state.day + 1, items: tomorrow } };
  } else {
    cards.SHIELD = { usedDay: state.day };
  }
  return { ok: true, value: { ...state, cards } };
}

/**
 * Loss shield settlement when moving from `prev` (day N) to the new prices of day N+1.
 * Refund = shares × prevPrice × (loss beyond the threshold).
 */
export function shieldRefunds(prev: Pick<GameState, 'holdings' | 'prices' | 'cards' | 'day'>, newPrices: Record<string, number>): { total: number; lines: string[] } {
  if (prev.cards.SHIELD?.usedDay !== prev.day) return { total: 0, lines: [] };
  let total = 0;
  const lines: string[] = [];
  for (const h of Object.values(prev.holdings)) {
    const before = prev.prices[h.stockId] ?? 0;
    const after = newPrices[h.stockId] ?? before;
    const change = before > 0 ? after / before - 1 : 0;
    if (change < -SHIELD_THRESHOLD) {
      const refund = Math.round(h.shares * before * (-change - SHIELD_THRESHOLD));
      if (refund > 0) {
        total += refund;
        lines.push(`${h.stockId}:${refund}`);
      }
    }
  }
  return { total, lines };
}

export function unusedCards(state: Pick<GameState, 'cards'>): number {
  return CARD_IDS.filter((c) => state.cards[c]?.usedDay === undefined).length;
}
