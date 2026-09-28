import { describe, expect, it } from 'vitest';
import { STOCKS } from '@/data/stocks';
import { SEVERITY_RANK } from '@/domain/constants';
import type { GameState } from '@/domain/types';
import {
  closeDay,
  createNewGame,
  debugAddCash,
  finishGame,
  injectEvent,
  normalizeLoadedPhase,
  startNextDay,
  transition,
  visibleNews,
} from './gameEngine';
import { averageIn, totalValueAt, valuePortfolio } from './portfolioEngine';
import { computeFinalStats, computeMaxDrawdown, evaluateAchievements } from './scoringEngine';
import { executeOrder, validateOrder } from './tradingEngine';
import { validateGameState } from '@/persistence/storage';
import { getUpcomingCalendar } from '@/store/selectors';

const trading = (s: GameState): GameState => ({ ...s, phase: 'TRADING' });
const newGame = (seed = 12345) => trading(createNewGame({ stocks: STOCKS, seed }));
const buy = (s: GameState, stockId: string, shares: number) => {
  const r = executeOrder(s, { type: 'BUY', stockId, shares }, STOCKS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.state;
};
const sell = (s: GameState, stockId: string, shares: number) => {
  const r = executeOrder(s, { type: 'SELL', stockId, shares }, STOCKS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value.state;
};
const nextDay = (s: GameState) => trading(startNextDay(transition(closeDay(s, STOCKS), 'DAY_SUMMARY'), STOCKS));
const valuation = (s: GameState) => valuePortfolio(s, s.prices, s.prevPrices, STOCKS);

describe('Test 01 — new game', () => {
  it('grants ₩1,000,000 on NORMAL at day 1', () => {
    const s = createNewGame({ stocks: STOCKS, seed: 1 });
    expect(s.cash).toBe(1_000_000);
    expect(s.day).toBe(1);
    expect(s.phase).toBe('DAY_START');
    expect(Object.keys(s.prices)).toHaveLength(STOCKS.length);
    expect(s.valueHistory[1]).toBe(1_000_000);
  });
  it('is deterministic per seed and differs across seeds', () => {
    const a = createNewGame({ stocks: STOCKS, seed: 42 });
    const b = createNewGame({ stocks: STOCKS, seed: 42 });
    const c = createNewGame({ stocks: STOCKS, seed: 43 });
    expect(a.prices).toEqual(b.prices);
    expect(a.schedule.map((e) => e.title)).toEqual(b.schedule.map((e) => e.title));
    expect(a.prices).not.toEqual(c.prices);
  });
});

describe('Test 02/03 — buy & sell', () => {
  it('buy lowers cash and adds holdings; sell reverses', () => {
    let s = newGame();
    const price = s.prices.nova!;
    s = buy(s, 'nova', 10);
    expect(s.cash).toBe(1_000_000 - price * 10);
    expect(s.holdings.nova?.shares).toBe(10);
    s = sell(s, 'nova', 4);
    expect(s.holdings.nova?.shares).toBe(6);
    expect(s.cash).toBe(1_000_000 - price * 6);
    s = sell(s, 'nova', 6);
    expect(s.holdings.nova).toBeUndefined();
    expect(s.transactions).toHaveLength(3);
  });
});

describe('Test 04 — average price', () => {
  it('10 × ₩100 + 10 × ₩120 = avg ₩110', () => {
    expect(averageIn({ stockId: 'x', shares: 10, avgPrice: 100, openedDay: 1 }, 10, 120)).toBe(110);
    let s = newGame();
    s = { ...s, prices: { ...s.prices, nova: 100 } };
    s = buy(s, 'nova', 10);
    s = { ...s, prices: { ...s.prices, nova: 120 } };
    s = buy(s, 'nova', 10);
    expect(s.holdings.nova?.avgPrice).toBe(110);
    // Selling doesn't change avg price
    s = sell(s, 'nova', 5);
    expect(s.holdings.nova?.avgPrice).toBe(110);
  });
});

describe('Test 05/06 — realized & unrealized P&L', () => {
  it('splits P&L and keeps the value invariant', () => {
    let s = newGame();
    s = { ...s, prices: { ...s.prices, nova: 100 } };
    s = buy(s, 'nova', 100);
    s = { ...s, prices: { ...s.prices, nova: 150 } };
    s = sell(s, 'nova', 40); // realized (150-100)*40 = 2000
    expect(s.realizedPnL).toBe(2000);
    s = { ...s, prices: { ...s.prices, nova: 130 } };
    const v = valuation(s);
    expect(v.unrealizedPnL).toBe((130 - 100) * 60);
    expect(v.totalPnL).toBe(2000 + 1800);
    expect(v.totalValue - s.startingCash).toBe(v.totalPnL);
  });
});

describe('Test 15 — trade validation', () => {
  it('blocks invalid orders', () => {
    const s = newGame();
    expect(validateOrder(s, { type: 'BUY', stockId: 'nova', shares: 0 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(validateOrder(s, { type: 'BUY', stockId: 'nova', shares: -3 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(validateOrder(s, { type: 'BUY', stockId: 'nova', shares: 1.5 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(validateOrder(s, { type: 'BUY', stockId: 'nova', shares: Number.NaN }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INVALID_QUANTITY' } });
    expect(validateOrder(s, { type: 'BUY', stockId: 'nova', shares: 1_000_000 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_CASH' } });
    expect(validateOrder(s, { type: 'SELL', stockId: 'nova', shares: 1 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_SHARES' } });
    expect(validateOrder(s, { type: 'BUY', stockId: 'nope', shares: 1 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_STOCK' } });
    expect(validateOrder({ ...s, phase: 'DAY_SUMMARY' }, { type: 'BUY', stockId: 'nova', shares: 1 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'MARKET_CLOSED' } });
    expect(validateOrder({ ...s, phase: 'GAME_COMPLETE' }, { type: 'BUY', stockId: 'nova', shares: 1 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'GAME_OVER' } });
  });
  it('allows buying exactly all cash', () => {
    let s = newGame();
    const p = s.prices.grnt!;
    const max = Math.floor(s.cash / p);
    s = buy(s, 'grnt', max);
    expect(s.cash).toBeGreaterThanOrEqual(0);
    expect(s.cash).toBeLessThan(p);
  });
});

describe('Test 07/08 — next day & news', () => {
  it('updates prices, advances the day and publishes event news with impacts', () => {
    let s = newGame(777);
    const before = { ...s.prices };
    s = nextDay(s);
    expect(s.day).toBe(2);
    expect(s.prices).not.toEqual(before);
    // Run to the first scheduled event and check its targets moved with the news
    const ev = s.schedule.find((e) => e.scope === 'COMPANY' && SEVERITY_RANK[e.severity] >= 2)!;
    while (s.day < ev.day) s = nextDay(s);
    const item = s.news.find((n) => n.eventUid === ev.uid)!;
    expect(item).toBeDefined();
    expect(item.impacts).toBeDefined();
    const change = item.impacts![ev.targets[0]!]!;
    // Major company news should move the target in its direction the vast majority of the time
    expect(Math.sign(change)).toBe(ev.direction);
  });
  it('future hints are hidden until their day', () => {
    const s = newGame(99);
    expect(visibleNews(s).every((n) => n.day <= s.day)).toBe(true);
    expect(s.news.some((n) => n.day > s.day)).toBe(true);
  });
});

describe('Scheduler guarantees', () => {
  it('every game has a crash and a boom and a major company shock each way', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = createNewGame({ stocks: STOCKS, seed });
      expect(s.schedule.some((e) => e.marketShift === 'CRASH'), `crash seed ${seed}`).toBe(true);
      expect(s.schedule.some((e) => e.marketShift === 'RALLY'), `rally seed ${seed}`).toBe(true);
      expect(s.schedule.some((e) => e.scope === 'COMPANY' && e.direction === 1 && SEVERITY_RANK[e.severity] >= 2)).toBe(true);
      expect(s.schedule.some((e) => e.scope === 'COMPANY' && e.direction === -1 && SEVERITY_RANK[e.severity] >= 2)).toBe(true);
      expect(s.schedule.filter((e) => e.day <= 9).length).toBeLessThan(s.schedule.filter((e) => e.day > 20).length + 6);
      expect(s.schedule.every((e) => e.day >= 2 && e.day <= 30)).toBe(true);
    }
  });
});

describe('Test 09/10 — bull & crash', () => {
  it('crash day drops the index; rally day lifts it', () => {
    let crashes = 0;
    let rallies = 0;
    for (let seed = 100; seed < 130; seed++) {
      let s = newGame(seed);
      while (s.day < s.totalDays) {
        s = nextDay(s);
        const r = closeDay(s, STOCKS).reports.at(-1)!;
        if (s.marketState === 'CRASH' && s.schedule.some((e) => e.day === s.day && e.marketShift === 'CRASH')) {
          expect(r.marketChange).toBeLessThan(-0.03);
          crashes++;
        }
        if (s.marketState === 'RALLY' && s.schedule.some((e) => e.day === s.day && e.marketShift === 'RALLY')) {
          expect(r.marketChange).toBeGreaterThan(0.02);
          rallies++;
        }
      }
    }
    expect(crashes).toBe(30);
    expect(rallies).toBe(30);
  });
  it('debug injected crash applies tomorrow', () => {
    let s = newGame(5);
    s = injectEvent(s, 'mega-crash', STOCKS);
    s = nextDay(s);
    expect(s.marketState).toBe('CRASH');
    expect(s.crashDays).toContain(2);
  });
});

describe('Test 11 — portfolio risk & concentration', () => {
  it('rates all-in EXTREME stock higher than diversified low-risk', () => {
    let a = newGame();
    a = buy(a, 'orbt', Math.floor(a.cash / a.prices.orbt!));
    let b = newGame();
    for (const id of ['bstn', 'grnt', 'mrse', 'aura']) b = buy(b, id, Math.floor(200_000 / b.prices[id]!));
    const va = valuation(a);
    const vb = valuation(b);
    expect(va.risk.score).toBeGreaterThan(vb.risk.score);
    expect(['HIGH', 'EXTREME']).toContain(va.risk.level);
    expect(['LOW', 'MEDIUM']).toContain(vb.risk.level);
    expect(va.concentration?.stockId).toBe('orbt');
    expect(vb.concentration).toBeNull();
    expect(valuation(newGame()).risk.level).toBe('NONE');
  });
});

describe('Test 12 — max drawdown', () => {
  it('matches the spec example', () => {
    const dd = computeMaxDrawdown([1_000_000, 1_450_000, 1_300_000, 1_180_000, 1_400_000]);
    expect(dd.peak).toBe(1_450_000);
    expect(dd.trough).toBe(1_180_000);
    expect(dd.maxDrawdown).toBeCloseTo(0.18620689, 6);
  });
  it('is zero for a monotonic rise', () => {
    expect(computeMaxDrawdown([1, 2, 3]).maxDrawdown).toBe(0);
  });
});

describe('Test 13/14/15 — full game, achievements & result', () => {
  it('plays 30 days, settles positions and computes final stats', () => {
    let s = newGame(2024);
    s = buy(s, 'nova', 20);
    for (let d = 1; d < 30; d++) {
      s = nextDay(s);
      if (d === 5) s = buy(s, 'bstn', 5);
      if (d === 12) s = sell(s, 'nova', 10);
    }
    expect(s.day).toBe(30);
    const before = totalValueAt(s, s.prices);
    const done = finishGame(s, STOCKS);
    expect(done.phase).toBe('GAME_COMPLETE');
    expect(Object.keys(done.holdings)).toHaveLength(0);
    expect(done.cash).toBe(before);
    const stats = computeFinalStats(done, STOCKS);
    expect(stats.finalValue).toBe(before);
    expect(stats.totalTrades).toBe(3);
    expect(stats.totalPnL).toBeCloseTo(done.realizedPnL, 6);
    expect(stats.score.total).toBeGreaterThan(0);
    const ach = evaluateAchievements(done, STOCKS);
    expect(ach).toContain('FIRST_TRADE');
    expect(ach).toContain('FULL_30');
    expect(ach).toContain('DIAMOND_HANDS');
    // Trading after the game is blocked
    expect(validateOrder(done, { type: 'BUY', stockId: 'nova', shares: 1 }, STOCKS)).toMatchObject({ ok: false, error: { code: 'GAME_OVER' } });
  });
  it('an observer game is classified as OBSERVER', () => {
    let s = newGame(3);
    while (s.day < 30) s = nextDay(s);
    const done = finishGame(s, STOCKS);
    expect(computeFinalStats(done, STOCKS).style.primary).toBe('OBSERVER');
    expect(computeFinalStats(done, STOCKS).finalValue).toBe(1_000_000);
  });
});

describe('State machine & persistence', () => {
  it('rejects invalid transitions', () => {
    const s = newGame();
    expect(() => transition(s, 'DAY_START')).toThrow();
    expect(() => transition({ ...s, phase: 'RESULT' }, 'TRADING')).toThrow();
  });
  it('normalizes transient phases on reload', () => {
    expect(normalizeLoadedPhase('NEWS_EVENT')).toBe('TRADING');
    expect(normalizeLoadedPhase('MARKET_CLOSED')).toBe('DAY_SUMMARY');
  });
  it('validates saves and survives JSON round-trip', () => {
    let s = newGame();
    s = buy(s, 'aura', 3);
    const round = JSON.parse(JSON.stringify(s));
    expect(validateGameState(round)).toBeNull();
    expect(validateGameState({ ...round, cash: -5 })).not.toBeNull();
    expect(validateGameState({ ...round, prices: { nova: 'x' } })).not.toBeNull();
    expect(validateGameState(null)).not.toBeNull();
    expect(validateGameState({ ...round, version: 99 })).not.toBeNull();
  });
  it('debug cash injection does not count as return', () => {
    const s = debugAddCash(newGame(), 1_000_000);
    expect(valuation(s).returnPct).toBe(0);
  });
});

describe('News readability', () => {
  it('headline stocks move with the news; "sell the news" reactions stay small', () => {
    let n = 0;
    let hit = 0;
    let worstAgainst = 0;
    for (let seed = 1; seed <= 80; seed++) {
      let s = newGame(seed);
      while (s.day < s.totalDays) {
        s = nextDay(s);
        for (const ev of s.schedule.filter((e) => e.day === s.day)) {
          for (const id of ev.targets) {
            // single-headline days only (overlapping news can legitimately conflict)
            const overlapping = s.schedule.filter(
              (e) => e.day === s.day && (e.targets.includes(id) || e.spillTargets.includes(id) || e.marketImpact !== 0),
            );
            if (overlapping.length > 1) continue;
            const change = s.prices[id]! / s.prevPrices[id]! - 1;
            n++;
            if (Math.sign(change) === ev.direction) hit++;
            else worstAgainst = Math.max(worstAgainst, Math.abs(change));
          }
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(hit / n).toBeGreaterThan(0.9);
    expect(worstAgainst).toBeLessThan(0.06);
  });

  it('calendar lists scheduled events ahead without revealing direction', () => {
    const s = newGame(20260928);
    let found = 0;
    for (let day = 1; day <= 27; day++) {
      const entries = getUpcomingCalendar({ ...s, day }, 3);
      for (const e of entries) {
        found++;
        expect(e.inDays).toBeGreaterThanOrEqual(1);
        expect(e.inDays).toBeLessThanOrEqual(3);
        expect(e.label).not.toMatch(/서프라이즈|쇼크|성공|실패|인상|인하|흥행|참패/);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('Rival, chance cards, chatter', () => {
  it('rival is deterministic and independent of the player', () => {
    let a = createNewGame({ stocks: STOCKS, seed: 99, rival: 'MOMENTUM_KIM' });
    let b = createNewGame({ stocks: STOCKS, seed: 99, rival: 'MOMENTUM_KIM' });
    a = trading(a);
    b = buy(trading(b), 'nova', 30); // player acts differently
    for (let d = 0; d < 10; d++) {
      a = nextDay(a);
      b = nextDay(b);
    }
    expect(a.rival.valueHistory).toEqual(b.rival.valueHistory);
    expect(a.rival.valueHistory[10]).toBeGreaterThan(0);
  });

  it('index granny buys everything on day 1 and holds', () => {
    const g = createNewGame({ stocks: STOCKS, seed: 5, rival: 'INDEX_GRANNY' });
    expect(Object.keys(g.rival.holdings)).toHaveLength(STOCKS.length);
    const later = nextDay(nextDay(trading(g)));
    expect(later.rival.holdings).toEqual(g.rival.holdings);
  });

  it('loss shield refunds losses beyond 5% and keeps the P&L invariant', async () => {
    const { playCard } = await import('./cardEngine');
    // Find a seed/day where the held stock falls more than 5% overnight
    for (let seed = 1; seed < 400; seed++) {
      let s = buy(newGame(seed), 'orbt', 40);
      const r = playCard(s, 'SHIELD', STOCKS);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value;
      const next = nextDay(s);
      const change = next.prices.orbt! / s.prices.orbt! - 1;
      if (change < -0.05) {
        const expected = Math.round(40 * s.prices.orbt! * (-change - 0.05));
        expect(next.bonusPnL).toBe(expected);
        expect(next.cash).toBe(s.cash + expected);
        const v = valuation(next);
        expect(v.totalValue - next.startingCash).toBeCloseTo(v.totalPnL, 6);
        // Second use is refused
        expect(playCard(next, 'SHIELD', STOCKS).ok).toBe(false);
        return;
      }
    }
    throw new Error('no shield trigger found');
  });

  it('tomorrow paper shows the actual next-day headlines; analyst needs a calendar event', async () => {
    const { playCard, cardAvailability } = await import('./cardEngine');
    const s = newGame(20260928);
    const r = playCard(s, 'PAPER', STOCKS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const titles = r.value.cards.PAPER.paper!.items.map((i) => i.title);
    const actual = s.schedule.filter((e) => e.day === 2).map((e) => e.title);
    for (const t of titles) expect(actual).toContain(t);
    const avail = cardAvailability(s, 'ANALYST', STOCKS);
    if (avail.ok) {
      const a = playCard(s, 'ANALYST', STOCKS);
      expect(a.ok && a.value.cards.ANALYST.analyst?.label).toBeTruthy();
    }
    expect(cardAvailability({ ...s, phase: 'DAY_SUMMARY' }, 'PAPER', STOCKS).ok).toBe(false);
  });

  it('chatter is deterministic and never empty', async () => {
    const { generateChatter } = await import('./chatter');
    let s = newGame(7);
    for (let d = 0; d < 5; d++) s = nextDay(s);
    const a = generateChatter(s, STOCKS);
    const b = generateChatter(s, STOCKS);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
  });

  it('older saves without new fields are normalized', async () => {
    const { normalizeGame } = await import('./gameEngine');
    const s = newGame(1);
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.rival;
    delete legacy.cards;
    delete legacy.bonusPnL;
    delete legacy.cardLog;
    const n = normalizeGame(legacy);
    expect(n.rival.id).toBeTruthy();
    expect(n.cards.SHIELD).toEqual({});
    expect(n.bonusPnL).toBe(0);
    expect(() => nextDay(n)).not.toThrow();
  });
});
