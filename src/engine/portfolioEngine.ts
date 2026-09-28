import { CONCENTRATION_WARNING } from '@/domain/constants';
import type { DailySnapshot, GameState, Holding, RiskLevel, StockDefinition } from '@/domain/types';
import { RISK_WEIGHT } from '@/data/stocks';

/**
 * Portfolio engine — valuation, P&L and risk. Pure functions over GameState.
 *
 * Invariant (without debug capital injections):
 *   totalValue − startingCash = realizedPnL + unrealizedPnL
 */

export interface PositionView {
  stockId: string;
  shares: number;
  avgPrice: number;
  price: number;
  cost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  /** Share of total portfolio value (incl. cash). */
  weight: number;
  dayChange: number;
  openedDay: number;
}

export type PortfolioRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';

export interface PortfolioRisk {
  level: PortfolioRiskLevel;
  /** 0..100 */
  score: number;
  exposure: number;
  diversification: number;
}

export interface Valuation {
  cash: number;
  invested: number;
  totalValue: number;
  costBasis: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  /** Return vs. capital (starting cash + injections). */
  returnPct: number;
  dailyPnL: number;
  dailyPct: number;
  positions: PositionView[];
  risk: PortfolioRisk;
  concentration: { stockId: string; weight: number } | null;
}

export function capitalBase(state: Pick<GameState, 'startingCash' | 'capitalInjected'>): number {
  return state.startingCash + state.capitalInjected;
}

export function positionValue(holding: Holding, price: number): number {
  return holding.shares * price;
}

/** Average price after adding `shares` at `price` to an existing holding. */
export function averageIn(holding: Holding | undefined, shares: number, price: number): number {
  if (!holding || holding.shares <= 0) return price;
  return (holding.avgPrice * holding.shares + price * shares) / (holding.shares + shares);
}

export function valuePortfolio(
  state: Pick<GameState, 'cash' | 'holdings' | 'realizedPnL' | 'startingCash' | 'capitalInjected' | 'valueHistory' | 'day'>,
  prices: Record<string, number>,
  prevPrices: Record<string, number>,
  stocks: readonly StockDefinition[],
): Valuation {
  const positions: PositionView[] = [];
  let invested = 0;
  let costBasis = 0;
  let prevInvested = 0;
  for (const holding of Object.values(state.holdings)) {
    if (holding.shares <= 0) continue;
    const price = prices[holding.stockId] ?? holding.avgPrice;
    const prev = prevPrices[holding.stockId] ?? price;
    const value = holding.shares * price;
    const cost = holding.shares * holding.avgPrice;
    invested += value;
    costBasis += cost;
    prevInvested += holding.shares * prev;
    positions.push({
      stockId: holding.stockId,
      shares: holding.shares,
      avgPrice: holding.avgPrice,
      price,
      cost,
      value,
      pnl: value - cost,
      pnlPct: cost > 0 ? value / cost - 1 : 0,
      weight: 0,
      dayChange: prev > 0 ? price / prev - 1 : 0,
      openedDay: holding.openedDay,
    });
  }
  const totalValue = state.cash + invested;
  for (const p of positions) p.weight = totalValue > 0 ? p.value / totalValue : 0;
  positions.sort((a, b) => b.value - a.value);

  const unrealizedPnL = invested - costBasis;
  const base = capitalBase(state);
  const prevValue = state.valueHistory[state.day - 1] ?? base;
  // Daily P&L: today's price move on current positions (trades at market price don't create P&L).
  const dailyPnL = invested - prevInvested;
  const top = positions[0];

  return {
    cash: state.cash,
    invested,
    totalValue,
    costBasis,
    realizedPnL: state.realizedPnL,
    unrealizedPnL,
    totalPnL: state.realizedPnL + unrealizedPnL,
    returnPct: base > 0 ? totalValue / base - 1 : 0,
    dailyPnL,
    dailyPct: prevValue > 0 ? dailyPnL / prevValue : 0,
    positions,
    risk: computePortfolioRisk(positions, totalValue, stocks),
    concentration: top && top.weight >= CONCENTRATION_WARNING ? { stockId: top.stockId, weight: top.weight } : null,
  };
}

/**
 * Simple, readable portfolio risk:
 *   risk = exposure × avgRiskOfHoldings × concentrationFactor
 * Holding cash lowers exposure; spreading across stocks lowers concentration.
 */
export function computePortfolioRisk(
  positions: readonly Pick<PositionView, 'stockId' | 'value'>[],
  totalValue: number,
  stocks: readonly StockDefinition[],
): PortfolioRisk {
  const invested = positions.reduce((s, p) => s + p.value, 0);
  if (invested <= 0 || totalValue <= 0) return { level: 'NONE', score: 0, exposure: 0, diversification: 1 };
  const exposure = invested / totalValue;
  let weightedRisk = 0;
  let hhi = 0;
  for (const p of positions) {
    const w = p.value / invested;
    const risk: RiskLevel = stocks.find((s) => s.id === p.stockId)?.riskLevel ?? 'MEDIUM';
    weightedRisk += w * RISK_WEIGHT[risk];
    hhi += w * w;
  }
  const concentrationFactor = 0.55 + 0.45 * Math.sqrt(hhi);
  const score = Math.round(100 * exposure * (weightedRisk / 4) * concentrationFactor * 1.25);
  const clamped = Math.min(100, score);
  const level: PortfolioRiskLevel =
    clamped < 22 ? 'LOW' : clamped < 45 ? 'MEDIUM' : clamped < 70 ? 'HIGH' : 'EXTREME';
  return { level, score: clamped, exposure, diversification: 1 - hhi };
}

export function takeSnapshot(
  state: Pick<GameState, 'cash' | 'holdings' | 'day'>,
  prices: Record<string, number>,
  stocks: readonly StockDefinition[],
): DailySnapshot {
  let invested = 0;
  let highRisk = 0;
  let top = 0;
  let topId: string | undefined;
  let distinct = 0;
  for (const h of Object.values(state.holdings)) {
    if (h.shares <= 0) continue;
    const value = h.shares * (prices[h.stockId] ?? h.avgPrice);
    invested += value;
    distinct++;
    const risk = stocks.find((s) => s.id === h.stockId)?.riskLevel;
    if (risk === 'HIGH' || risk === 'EXTREME') highRisk += value;
    if (value > top) {
      top = value;
      topId = h.stockId;
    }
  }
  const total = state.cash + invested;
  const positions = Object.values(state.holdings)
    .filter((h) => h.shares > 0)
    .map((h) => ({ stockId: h.stockId, value: h.shares * (prices[h.stockId] ?? h.avgPrice) }));
  return {
    riskScore: computePortfolioRisk(positions, total, stocks).score,
    day: state.day,
    totalValue: total,
    cash: state.cash,
    invested,
    highRiskShare: total > 0 ? highRisk / total : 0,
    distinctHoldings: distinct,
    maxConcentration: total > 0 ? top / total : 0,
    maxConcentrationStock: topId,
  };
}

export function totalValueAt(state: Pick<GameState, 'cash' | 'holdings'>, prices: Record<string, number>): number {
  let v = state.cash;
  for (const h of Object.values(state.holdings)) v += h.shares * (prices[h.stockId] ?? h.avgPrice);
  return v;
}
