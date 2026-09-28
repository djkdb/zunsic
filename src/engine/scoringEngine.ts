import { ACHIEVEMENTS, type AchievementId } from '@/data/achievements';
import { DIFFICULTIES } from '@/data/difficulties';
import type { GameState, StockDefinition, Transaction } from '@/domain/types';
import { clamp, mean } from '@/lib/math';
import { computeIndex } from './marketEngine';
import { capitalBase } from './portfolioEngine';

/**
 * Scoring engine — final metrics, score, rank, trading style and achievements.
 */

export interface Drawdown {
  maxDrawdown: number; // positive fraction, e.g. 0.186
  peak: number;
  trough: number;
  peakDay: number;
  troughDay: number;
}

export function computeMaxDrawdown(values: readonly number[]): Drawdown {
  let peak = values[0] ?? 0;
  let peakDay = 0;
  let best: Drawdown = { maxDrawdown: 0, peak, trough: peak, peakDay: 0, troughDay: 0 };
  values.forEach((v, day) => {
    if (v === undefined || !Number.isFinite(v)) return;
    if (v > peak) {
      peak = v;
      peakDay = day;
    }
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > best.maxDrawdown) best = { maxDrawdown: dd, peak, trough: v, peakDay, troughDay: day };
  });
  return best;
}

export type TradingStyleId = 'ACTIVE_TRADER' | 'RISK_TAKER' | 'LONG_TERM' | 'DIVERSIFIER' | 'CAUTIOUS' | 'OBSERVER';

export const TRADING_STYLES: Record<TradingStyleId, { label: string; description: string }> = {
  ACTIVE_TRADER: { label: 'ACTIVE TRADER', description: '시장의 모든 움직임에 반응한다. 잦은 매매로 기회를 노리는 스타일.' },
  RISK_TAKER: { label: 'RISK TAKER', description: '고위험 종목에 과감하게 베팅한다. 큰 변동을 두려워하지 않는 스타일.' },
  LONG_TERM: { label: 'LONG-TERM INVESTOR', description: '한번 산 종목은 오래 들고 간다. 단기 소음보다 추세를 믿는 스타일.' },
  DIVERSIFIER: { label: 'DIVERSIFIER', description: '여러 종목에 나눠 담는다. 한 번의 악재에 무너지지 않는 스타일.' },
  CAUTIOUS: { label: 'CAUTIOUS', description: '현금 비중을 높게 유지한다. 확신이 있을 때만 움직이는 스타일.' },
  OBSERVER: { label: 'THE OBSERVER', description: '30일 동안 시장을 지켜보기만 했다. 다음엔 한 번 뛰어들어 보자.' },
};

export interface StyleResult {
  primary: TradingStyleId;
  secondary?: TradingStyleId;
  traits: Record<Exclude<TradingStyleId, 'OBSERVER'>, number>;
  metrics: { trades: number; avgHoldingDays: number; highRiskShare: number; avgDistinct: number; cashRatio: number };
}

export function classifyStyle(state: GameState): StyleResult {
  const trades = state.transactions.filter((t) => !t.settlement).length;
  const sells = state.transactions.filter((t) => t.type === 'SELL');
  const avgHoldingDays = mean(sells.map((t) => t.holdingDays ?? 0));
  const snaps = state.snapshots;
  const highRiskShare = mean(snaps.map((s) => s.highRiskShare));
  const avgDistinct = mean(snaps.map((s) => s.distinctHoldings));
  const cashRatio = mean(snaps.map((s) => (s.totalValue > 0 ? s.cash / s.totalValue : 1)));
  const metrics = { trades, avgHoldingDays, highRiskShare, avgDistinct, cashRatio };

  const traits = {
    ACTIVE_TRADER: clamp(trades / 24, 0, 1.5),
    RISK_TAKER: clamp(highRiskShare / 0.6, 0, 1.5),
    LONG_TERM: clamp((avgHoldingDays / 12) * (trades <= 16 ? 1 : 0.5), 0, 1.5),
    DIVERSIFIER: clamp((avgDistinct - 1) / 3.5, 0, 1.5),
    CAUTIOUS: clamp((cashRatio - 0.25) / 0.45, 0, 1.5),
  };
  if (trades === 0) return { primary: 'OBSERVER', traits, metrics };
  const ranked = (Object.entries(traits) as [Exclude<TradingStyleId, 'OBSERVER'>, number][]).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] ?? 'ACTIVE_TRADER';
  const second = ranked[1];
  return { primary, secondary: second && second[1] >= 0.6 ? second[0] : undefined, traits, metrics };
}

export interface TradeHighlight {
  ticker: string;
  stockId: string;
  pnl: number;
  day: number;
}

export interface FinalStats {
  startingCapital: number;
  finalValue: number;
  returnPct: number;
  totalPnL: number;
  realizedPnL: number;
  drawdown: Drawdown;
  bestTrade: TradeHighlight | null;
  worstTrade: TradeHighlight | null;
  winRate: number;
  totalTrades: number;
  sellCount: number;
  bestDay: { day: number; change: number; pct: number } | null;
  worstDay: { day: number; change: number; pct: number } | null;
  avgRiskScore: number;
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  indexReturn: number;
  positiveDays: number;
  style: StyleResult;
  score: ScoreBreakdown;
}

export interface ScoreBreakdown {
  returnPts: number;
  riskControl: number;
  consistency: number;
  efficiency: number;
  multiplier: number;
  total: number;
  rank: 'S' | 'A' | 'B' | 'C' | 'D';
}

function highlight(t: Transaction | undefined): TradeHighlight | null {
  if (!t) return null;
  return { ticker: t.ticker, stockId: t.stockId, pnl: t.realizedPnL ?? 0, day: t.day };
}

export function computeFinalStats(state: GameState, stocks: readonly StockDefinition[]): FinalStats {
  const base = capitalBase(state);
  const values = state.valueHistory.slice(0, state.day + 1).map((v, i) => (Number.isFinite(v) ? v : (state.valueHistory[i - 1] ?? base)));
  const finalValue = values[values.length - 1] ?? base;
  const returnPct = base > 0 ? finalValue / base - 1 : 0;
  const drawdown = computeMaxDrawdown(values);

  const sells = state.transactions.filter((t) => t.type === 'SELL');
  const sorted = [...sells].sort((a, b) => (b.realizedPnL ?? 0) - (a.realizedPnL ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const wins = sells.filter((t) => (t.realizedPnL ?? 0) > 0).length;
  const totalTrades = state.transactions.filter((t) => !t.settlement).length;

  let bestDay: FinalStats['bestDay'] = null;
  let worstDay: FinalStats['worstDay'] = null;
  let positiveDays = 0;
  let movingDays = 0;
  for (let d = 1; d < values.length; d++) {
    const prev = values[d - 1] ?? 0;
    const cur = values[d] ?? 0;
    const change = cur - prev;
    const pct = prev > 0 ? change / prev : 0;
    if (Math.abs(change) >= 1) {
      movingDays++;
      if (change > 0) positiveDays++;
    }
    if (!bestDay || change > bestDay.change) bestDay = { day: d, change, pct };
    if (!worstDay || change < worstDay.change) worstDay = { day: d, change, pct };
  }

  const avgRiskScore = mean(state.snapshots.map((s) => s.riskScore ?? 0));
  const riskLevel: FinalStats['riskLevel'] =
    state.snapshots.every((s) => s.invested <= 0)
      ? 'NONE'
      : avgRiskScore < 22
        ? 'LOW'
        : avgRiskScore < 45
          ? 'MEDIUM'
          : avgRiskScore < 70
            ? 'HIGH'
            : 'EXTREME';

  const startIndex = computeIndex(Object.fromEntries(stocks.map((s) => [s.id, s.initialPrice])), stocks);
  const indexReturn = computeIndex(state.prices, stocks) / startIndex - 1;

  const winRate = sells.length ? wins / sells.length : 0;
  const score = computeScore({
    returnPct,
    maxDrawdown: drawdown.maxDrawdown,
    positiveRatio: movingDays ? positiveDays / movingDays : 0,
    winRate,
    totalTrades,
    sellCount: sells.length,
    multiplier: DIFFICULTIES[state.difficulty].scoreMultiplier,
  });

  return {
    startingCapital: base,
    finalValue,
    returnPct,
    totalPnL: finalValue - base,
    realizedPnL: state.realizedPnL,
    drawdown,
    bestTrade: highlight(best),
    worstTrade: worst && worst !== best ? highlight(worst) : null,
    winRate,
    totalTrades,
    sellCount: sells.length,
    bestDay,
    worstDay,
    avgRiskScore,
    riskLevel,
    indexReturn,
    positiveDays,
    style: classifyStyle(state),
    score,
  };
}

export function computeScore(input: {
  returnPct: number;
  maxDrawdown: number;
  positiveRatio: number;
  winRate: number;
  totalTrades: number;
  sellCount: number;
  multiplier: number;
}): ScoreBreakdown {
  const returnPts = Math.round(clamp(5000 + input.returnPct * 11000, 0, 16000));
  const riskControl = input.totalTrades === 0 ? 0 : Math.round(clamp((0.2 - input.maxDrawdown) * 6000, -1500, 1200));
  const consistency = Math.round(input.positiveRatio * 1000);
  const overtrading = Math.max(0, input.totalTrades - 60) * 15;
  const efficiency = Math.round((input.sellCount >= 3 ? input.winRate * 800 : 0) - overtrading);
  const raw = returnPts + riskControl + consistency + efficiency;
  const total = Math.max(0, Math.round(raw * input.multiplier));
  const rank: ScoreBreakdown['rank'] =
    total >= 9500 ? 'S' : total >= 8000 ? 'A' : total >= 6500 ? 'B' : total >= 5000 ? 'C' : 'D';
  return { returnPts, riskControl, consistency, efficiency, multiplier: input.multiplier, total, rank };
}

// ───────────────────────── Achievements ─────────────────────────

export function evaluateAchievements(state: GameState, stocks: readonly StockDefinition[]): AchievementId[] {
  const base = capitalBase(state);
  const trades = state.transactions.filter((t) => !t.settlement);
  const sells = state.transactions.filter((t) => t.type === 'SELL');
  const complete = state.phase === 'GAME_COMPLETE' || state.phase === 'RESULT';
  const values = state.valueHistory.filter((v) => Number.isFinite(v));
  const finalReturn = base > 0 ? (values[values.length - 1] ?? base) / base - 1 : 0;
  const out = new Set<AchievementId>();

  if (trades.length >= 1) out.add('FIRST_TRADE');
  if (values.some((v) => v >= base * 1.1)) out.add('UP_10');
  if (values.some((v) => v >= base * 2)) out.add('DOUBLE');
  if (
    sells.some((t) => (t.holdingDays ?? 0) >= 10) ||
    Object.values(state.holdings).some((h) => h.shares > 0 && state.day - h.openedDay >= 10)
  ) {
    out.add('DIAMOND_HANDS');
  }
  if (trades.length >= 20) out.add('DAY_TRADER');
  if (state.snapshots.some((s) => s.highRiskShare >= 0.7)) out.add('RISK_TAKER');
  if (trades.some((t) => t.type === 'BUY' && state.crashDays.includes(t.day))) out.add('BUY_THE_DIP');
  if (sells.some((t) => (t.realizedPnL ?? 0) >= 100_000)) out.add('SNIPER');

  if (complete) {
    out.add('FULL_30');
    const heldThroughCrash = state.crashDays.some((d) => {
      const snap = state.snapshots.find((s) => s.day === d);
      return snap ? snap.invested / Math.max(1, snap.totalValue) >= 0.4 : false;
    });
    if (heldThroughCrash && finalReturn >= 0) out.add('SURVIVOR');
    if (sells.length >= 3 && sells.every((t) => (t.realizedPnL ?? 0) >= 0) && finalReturn > 0) out.add('PERFECT_RUN');
    const stats = computeFinalStats(state, stocks);
    if (trades.length > 0 && stats.returnPct - stats.indexReturn >= 0.05) out.add('MARKET_BEATER');
  }

  return ACHIEVEMENTS.map((a) => a.id).filter((id) => out.has(id));
}
