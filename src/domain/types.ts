/**
 * Core domain types for MARKET//30.
 * Everything here is pure data — no UI, no side effects.
 * All companies, prices, events and trades are fictional game data.
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type TrendBias = 'DECLINE' | 'STABLE' | 'GROWTH' | 'HYPER_GROWTH';

export interface StockDefinition {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  /** Tags drive event targeting. New companies are picked up by events via tags. */
  tags: string[];
  description: string;
  initialPrice: number;
  /** Daily idiosyncratic volatility (std-dev of daily return, e.g. 0.025 = 2.5%). */
  volatility: number;
  /** Daily drift before noise (e.g. 0.002 = +0.2% / day). */
  baseTrend: number;
  trendBias: TrendBias;
  /** Multiplier applied to event price impact. */
  eventSensitivity: number;
  /** Sensitivity to the market-wide factor. */
  beta: number;
  riskLevel: RiskLevel;
}

export type MarketStateId = 'BULL' | 'NEUTRAL' | 'BEAR' | 'VOLATILE' | 'CRASH' | 'RALLY';

export interface MarketStateConfig {
  id: MarketStateId;
  label: string;
  mood: 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'UNSTABLE' | 'PANIC' | 'EUPHORIC';
  /** Daily drift of the market factor. */
  drift: number;
  /** Std-dev of the daily market factor. */
  marketVol: number;
  /** Multiplier on idiosyncratic volatility. */
  volMultiplier: number;
  /** Multipliers on positive / negative event impacts. */
  positiveImpact: number;
  negativeImpact: number;
  /** Markov transition weights to the next state (CRASH / RALLY are event-driven only). */
  transitions: Partial<Record<MarketStateId, number>>;
}

export type Severity = 'MINOR' | 'MODERATE' | 'MAJOR' | 'EXTREME';

export type EventScope = 'COMPANY' | 'SECTOR' | 'MARKET';

export type EventCategory =
  | 'PRODUCT'
  | 'EARNINGS'
  | 'REGULATION'
  | 'MACRO'
  | 'CORPORATE'
  | 'TECH'
  | 'SECURITY'
  | 'CLINICAL'
  | 'SUPPLY'
  | 'DEAL';

export interface EventTemplate {
  id: string;
  scope: EventScope;
  category: EventCategory;
  /** Headline (Korean). Supports {name} and {ticker} placeholders. */
  title: string;
  /** One-line summary (Korean). Supports placeholders. */
  summary: string;
  severity: Severity;
  /** +1 bullish / -1 bearish. */
  direction: 1 | -1;
  /** Relative probability weight for the scheduler. */
  probability: number;
  /** COMPANY scope: pick one stock that has any of these tags. Empty = any stock. */
  eligibleTags?: string[];
  /** SECTOR scope: every stock with any of these tags is affected. */
  targetTags?: string[];
  /** Secondary spill-over impact to other stocks with these tags (fraction of main impact). */
  spill?: { tags: string[]; factor: number };
  /** Shock to the market factor (fraction, e.g. -0.06). Applied to all stocks via beta. */
  marketImpact?: number;
  /** Force the market into this state on the event day. */
  marketShift?: MarketStateId;
  /** Portion of the impact that continues (>0) or reverses (<0) over following days. */
  followThrough: number;
  /** Earliest / latest day this event may be scheduled. */
  dayRange?: [number, number];
  /**
   * Scheduled, publicly known events (earnings dates, trial readouts, rate decisions) appear
   * on the calendar a few days ahead with this label — the direction stays hidden.
   */
  calendar?: string;
  /** Optional pre-event hint text published the day before. */
  hint?: { title: string; summary: string };
  /** Mega events are placed by the scheduler's guarantees, not the random draw. */
  mega?: boolean;
}

/** An event instance placed on a specific day, fully resolved (targets chosen). */
export interface ScheduledEvent {
  uid: string;
  templateId: string;
  day: number;
  scope: EventScope;
  category: EventCategory;
  title: string;
  summary: string;
  severity: Severity;
  direction: 1 | -1;
  /** Stock ids that take the main impact. */
  targets: string[];
  /** Stock ids that take a spill-over impact. */
  spillTargets: string[];
  spillFactor: number;
  /** Base impact magnitude (fraction) drawn from the severity range. */
  magnitude: number;
  marketImpact: number;
  marketShift?: MarketStateId;
  followThrough: number;
  hinted: boolean;
  /** Day the hint was published (event day - 1). */
  hintDay?: number;
  /** Ambiguous hints ("earnings tomorrow") don't reveal direction and cause no pre-move. */
  hintAmbiguous?: boolean;
  /** True when injected via debug tools. */
  injected?: boolean;
}

/** A rumor that never materializes: small pre-move, then fades. */
export interface RumorEntry {
  uid: string;
  day: number;
  stockId: string;
  direction: 1 | -1;
  magnitude: number;
}

export type NewsKind = 'BREAKING' | 'NEWS' | 'RUMOR' | 'ANALYST' | 'MARKET';

export interface NewsItem {
  id: string;
  day: number;
  kind: NewsKind;
  title: string;
  summary: string;
  severity: Severity;
  /** Direction is only revealed for real events (after the fact). Hints stay ambiguous in UI. */
  direction?: 1 | -1;
  affected: string[];
  /** Realized price change of each affected stock on that day (filled after pricing). */
  impacts?: Record<string, number>;
  marketChange?: number;
  eventUid?: string;
}

export interface PricePoint {
  day: number;
  tick: number;
  price: number;
}

export interface Holding {
  stockId: string;
  shares: number;
  /** Average purchase price (exact, not rounded). */
  avgPrice: number;
  /** Day the current position was opened (shares went from 0 to >0). */
  openedDay: number;
}

export type TradeType = 'BUY' | 'SELL';

export interface Transaction {
  id: string;
  day: number;
  stockId: string;
  ticker: string;
  type: TradeType;
  shares: number;
  price: number;
  total: number;
  /** SELL only: realized P&L of this sale. */
  realizedPnL?: number;
  /** SELL only: avg price of the position at the time of sale. */
  avgPriceAtSale?: number;
  /** SELL only: days the position had been held. */
  holdingDays?: number;
  /** Automatic liquidation at game end. */
  settlement?: boolean;
}

export interface DailySnapshot {
  day: number;
  totalValue: number;
  cash: number;
  invested: number;
  /** Share of total value per risk level (0..1). */
  highRiskShare: number;
  distinctHoldings: number;
  maxConcentration: number;
  maxConcentrationStock?: string;
  riskScore: number;
}

export interface DailyReport {
  day: number;
  marketChange: number;
  portfolioChange: number;
  portfolioValue: number;
  best?: { stockId: string; change: number };
  worst?: { stockId: string; change: number };
  newsIds: string[];
  tradeCount: number;
  marketState: MarketStateId;
}

export type GamePhase =
  | 'SETUP'
  | 'DAY_START'
  | 'NEWS_EVENT'
  | 'TRADING'
  | 'MARKET_CLOSED'
  | 'DAY_SUMMARY'
  | 'GAME_COMPLETE'
  | 'RESULT';

export type DifficultyId = 'CASUAL' | 'NORMAL' | 'HARD';

export interface DifficultyConfig {
  id: DifficultyId;
  label: string;
  description: string;
  startingCash: number;
  volatilityMultiplier: number;
  eventSeverityMultiplier: number;
  /** Extra probability of drifting into unstable market states. */
  instability: number;
  /** Fraction of scheduled events that get a hint the day before. */
  hintRate: number;
  scoreMultiplier: number;
}

export interface GameState {
  version: number;
  seed: number;
  difficulty: DifficultyId;
  day: number;
  totalDays: number;
  phase: GamePhase;
  startingCash: number;
  /** Capital added outside of trading (debug only). Excluded from returns. */
  capitalInjected: number;
  cash: number;
  holdings: Record<string, Holding>;
  prices: Record<string, number>;
  /** Close of the previous day (for daily change). */
  prevPrices: Record<string, number>;
  /** Intraday ticks per stock per day: history[stockId] = PricePoint[]. */
  history: Record<string, PricePoint[]>;
  indexHistory: PricePoint[];
  marketState: MarketStateId;
  marketStateHistory: MarketStateId[];
  /** Carry-over momentum from past events, per stock (daily return fraction). */
  momentum: Record<string, number>;
  schedule: ScheduledEvent[];
  rumors: RumorEntry[];
  /** All news, including pre-generated hints for future days. Filter by day <= current day. */
  news: NewsItem[];
  transactions: Transaction[];
  realizedPnL: number;
  /** Total portfolio value at each day's prices. valueHistory[0] = start. */
  valueHistory: number[];
  snapshots: DailySnapshot[];
  reports: DailyReport[];
  /** Days on which the market was in CRASH state. */
  crashDays: number[];
  /** Achievement ids unlocked during this run. */
  runAchievements: string[];
  startedAt: number;
  finishedAt?: number;
  txCounter: number;
}

export interface TradeError {
  code:
    | 'INVALID_QUANTITY'
    | 'INSUFFICIENT_CASH'
    | 'INSUFFICIENT_SHARES'
    | 'UNKNOWN_STOCK'
    | 'MARKET_CLOSED'
    | 'GAME_OVER';
  message: string;
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
