/**
 * Balance simulation: plays many seeded games with simple bot strategies and prints
 * return distributions. Run with `npm run sim`. Used to tune volatility / event sizes so
 * the game is neither trivially profitable nor hopeless.
 */
import { it } from 'vitest';
import { STOCKS } from '../src/data/stocks';
import type { DifficultyId, GameState } from '../src/domain/types';
import { closeDay, createNewGame, finishGame, startNextDay, transition } from '../src/engine/gameEngine';
import { computeFinalStats } from '../src/engine/scoringEngine';
import { executeOrder } from '../src/engine/tradingEngine';

type Strategy = (s: GameState) => GameState;

const order = (s: GameState, type: 'BUY' | 'SELL', stockId: string, shares: number) => {
  if (shares <= 0) return s;
  const r = executeOrder(s, { type, stockId, shares }, STOCKS);
  return r.ok ? r.value.state : s;
};
const sellAll = (s: GameState) => Object.values(s.holdings).reduce((acc, h) => order(acc, 'SELL', h.stockId, h.shares), s);

const strategies: Record<string, Strategy> = {
  equalHold: (s) => (s.day === 1 ? STOCKS.reduce((acc, st) => order(acc, 'BUY', st.id, Math.floor(s.cash / STOCKS.length / acc.prices[st.id]!)), s) : s),
  allInNova: (s) => (s.day === 1 ? order(s, 'BUY', 'nova', Math.floor(s.cash / s.prices.nova!)) : s),
  allInOrbit: (s) => (s.day === 1 ? order(s, 'BUY', 'orbt', Math.floor(s.cash / s.prices.orbt!)) : s),
  defensive: (s) => (s.day === 1 ? ['bstn', 'grnt'].reduce((acc, id) => order(acc, 'BUY', id, Math.floor(s.cash / 2 / acc.prices[id]!)), s) : s),
  newsChaser: (s) => {
    // Buys whatever had positive breaking news today, sells on negative news.
    let acc = s;
    for (const n of s.news.filter((x) => x.day === s.day && x.direction && (x.kind === 'BREAKING' || x.kind === 'MARKET'))) {
      for (const id of n.affected) {
        if (n.direction === 1) acc = order(acc, 'BUY', id, Math.floor((acc.cash * 0.3) / acc.prices[id]!));
        else acc = order(acc, 'SELL', id, acc.holdings[id]?.shares ?? 0);
      }
    }
    return acc;
  },
  hintReader: (s) => {
    // Acts on directional hints the day before events; exits the day after.
    let acc = sellAll(s);
    for (const ev of s.schedule.filter((e) => e.hintDay === s.day && !e.hintAmbiguous && e.direction === 1 && e.scope === 'COMPANY')) {
      const id = ev.targets[0]!;
      acc = order(acc, 'BUY', id, Math.floor((acc.cash * 0.5) / acc.prices[id]!));
    }
    return acc;
  },
  random: (s) => {
    const r = (s.seed * 31 + s.day * 17) % 100;
    const st = STOCKS[r % STOCKS.length]!;
    return r < 50 ? order(s, 'BUY', st.id, Math.floor((s.cash * 0.25) / s.prices[st.id]!)) : order(s, 'SELL', st.id, s.holdings[st.id]?.shares ?? 0);
  },
};

function play(seed: number, difficulty: DifficultyId, strat: Strategy) {
  let s: GameState = { ...createNewGame({ stocks: STOCKS, seed, difficulty }), phase: 'TRADING' };
  for (;;) {
    s = strat(s);
    if (s.day >= s.totalDays) break;
    s = { ...startNextDay(transition(closeDay(s, STOCKS), 'DAY_SUMMARY'), STOCKS), phase: 'TRADING' };
  }
  return computeFinalStats(finishGame(s, STOCKS), STOCKS);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const quant = (arr: number[], q: number) => [...arr].sort((a, b) => a - b)[Math.floor(q * (arr.length - 1))]!;

it('balance report', () => {
  const N = Number(process.env.SIM_N ?? 400);
  for (const difficulty of ['NORMAL', 'HARD', 'CASUAL'] as DifficultyId[]) {
    console.log(`\n=== ${difficulty} (${N} seeds) ===`);
    for (const [name, strat] of Object.entries(strategies)) {
      const rets: number[] = [];
      const dds: number[] = [];
      const scores: number[] = [];
      const idx: number[] = [];
      for (let seed = 1; seed <= N; seed++) {
        const st = play(seed * 7919, difficulty, strat);
        rets.push(st.returnPct);
        dds.push(st.drawdown.maxDrawdown);
        scores.push(st.score.total);
        idx.push(st.indexReturn);
      }
      const win = rets.filter((r) => r > 0).length / N;
      console.log(
        `${name.padEnd(11)} ret p10 ${pct(quant(rets, 0.1)).padStart(7)} p50 ${pct(quant(rets, 0.5)).padStart(7)} p90 ${pct(quant(rets, 0.9)).padStart(7)} | win ${pct(win).padStart(6)} | MDD p50 ${pct(quant(dds, 0.5)).padStart(6)} | score p50 ${quant(scores, 0.5)} | index p50 ${pct(quant(idx, 0.5))}`,
      );
    }
  }
}, 600_000);
