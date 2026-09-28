import { MARKET_STATES } from '@/data/marketStates';
import { INDEX_BASE, NEWS_TICK, SEVERITY_RANK, TICKS_PER_DAY } from '@/domain/constants';
import type {
  DifficultyConfig,
  MarketStateId,
  PricePoint,
  RumorEntry,
  ScheduledEvent,
  StockDefinition,
} from '@/domain/types';
import { clamp, roundPrice } from '@/lib/math';
import { createRng, mixSeed, STREAM, type Rng } from '@/lib/rng';

/**
 * Market engine — price formation.
 *
 * Daily return of a stock =
 *     baseTrend                          (company growth bias)
 *   + beta × marketFactor               (regime drift + regime noise + market-wide news)
 *   + idiosyncratic noise               (volatility × regime × difficulty, fat-tailed)
 *   + event impact                      (severity × sensitivity × regime asymmetry)
 *   + momentum carry                    (follow-through / reversal of recent news)
 *   − mean reversion                    (keeps prices from running away forever)
 *
 * The engine never looks at the player's portfolio: the market is fully determined by
 * the seed (plus any debug injections), so the same seed replays the same market.
 */

const MEAN_REVERSION = 0.035;
const HINT_PRICED_IN = 0.85;
const HINT_PRE_MOVE = 0.15;
const MAX_DAILY_UP = 0.6;
/** A stock in the headline realizes at least this share of the news impact, in the news direction. */
const MIN_HEADLINE_SHARE = 0.45;
/** Chance a company/sector headline is "sold on the news" (small move against it), by severity rank. */
const SELL_THE_NEWS = [0.1, 0.04, 0, 0];
const MAX_DAILY_DOWN = -0.45;

export function nextMarketState(prev: MarketStateId, rng: Rng, difficulty: DifficultyConfig): MarketStateId {
  const cfg = MARKET_STATES[prev];
  const entries = Object.entries(cfg.transitions) as [MarketStateId, number][];
  const adjusted = entries.map(([id, w]) => {
    let weight = w;
    if (id === 'VOLATILE' || id === 'BEAR') weight = Math.max(0.01, weight + difficulty.instability);
    return [id, weight] as const;
  });
  return rng.weighted(adjusted, ([, w]) => w)?.[0] ?? 'NEUTRAL';
}

/** Fair-value anchor used by mean reversion. */
function fairValue(stock: StockDefinition, day: number): number {
  return stock.initialPrice * Math.exp(stock.baseTrend * day);
}

export function computeIndex(prices: Record<string, number>, stocks: readonly StockDefinition[]): number {
  if (stocks.length === 0) return INDEX_BASE;
  let total = 0;
  for (const s of stocks) total += (prices[s.id] ?? s.initialPrice) / s.initialPrice;
  return (INDEX_BASE * total) / stocks.length;
}

export interface SimulateDayInput {
  seed: number;
  day: number;
  stocks: readonly StockDefinition[];
  difficulty: DifficultyConfig;
  prevPrices: Record<string, number>;
  prevState: MarketStateId;
  momentum: Record<string, number>;
  events: readonly ScheduledEvent[];
  /** Events hinted today (their event happens tomorrow). */
  hintedTomorrow: readonly ScheduledEvent[];
  rumors: readonly RumorEntry[];
  /** Force a regime (debug). */
  forceState?: MarketStateId;
}

export interface SimulateDayResult {
  prices: Record<string, number>;
  ticks: Record<string, PricePoint[]>;
  indexTicks: PricePoint[];
  marketState: MarketStateId;
  momentum: Record<string, number>;
  /** Realized daily change per stock. */
  changes: Record<string, number>;
  /** Event impact component per event uid per stock (before noise). */
  eventImpacts: Record<string, Record<string, number>>;
  marketChange: number;
}

export function simulateDay(input: SimulateDayInput): SimulateDayResult {
  const { seed, day, stocks, difficulty, prevPrices, events } = input;
  const stateRng = createRng(mixSeed(seed, STREAM.MARKET_STATE, day));
  const rng = createRng(mixSeed(seed, STREAM.PRICES, day));
  const tickRng = createRng(mixSeed(seed, STREAM.INTRADAY, day));
  const newsRng = createRng(mixSeed(seed, STREAM.EVENT_MAGNITUDE, day));

  // 1) Regime: Markov step, overridden by the most severe event that shifts the market.
  let marketState = nextMarketState(input.prevState, stateRng, difficulty);
  const shifting = [...events].filter((e) => e.marketShift).sort((a, b) => b.magnitude - a.magnitude)[0];
  if (shifting?.marketShift) marketState = shifting.marketShift;
  if (input.forceState) marketState = input.forceState;
  const regime = MARKET_STATES[marketState];

  // 2) Market factor shared by every stock.
  const marketNews = events.reduce((s, e) => s + e.marketImpact, 0);
  let marketNoise = regime.marketVol * difficulty.volatilityMultiplier * rng.gauss();
  // A market-moving headline is never cancelled out by random noise.
  if (Math.abs(marketNews) >= 0.03 && Math.sign(marketNoise) !== Math.sign(marketNews)) marketNoise *= 0.3;
  const marketFactor = regime.drift + marketNoise + marketNews;

  const prices: Record<string, number> = {};
  const ticks: Record<string, PricePoint[]> = {};
  const changes: Record<string, number> = {};
  const momentum: Record<string, number> = {};
  const eventImpacts: Record<string, Record<string, number>> = {};

  for (const stock of stocks) {
    const prev = prevPrices[stock.id] ?? stock.initialPrice;
    // On a stock's own news day the headline dominates: noise, carry and reversion are damped.
    const headlines = events.filter((e) => e.targets.includes(stock.id));
    const inNews = headlines.length > 0;
    const noise = stock.volatility * regime.volMultiplier * difficulty.volatilityMultiplier * rng.fatTail() * (inNews ? 0.45 : 1);
    const carry = (input.momentum[stock.id] ?? 0) * (inNews ? 0.5 : 1);
    const reversion = -MEAN_REVERSION * Math.log(prev / fairValue(stock, day)) * (inNews ? 0.3 : 1);

    // Event impacts
    let eventImpact = 0;
    let headlineImpact = 0;
    let followThrough = 0;
    for (const ev of events) {
      const isTarget = ev.targets.includes(stock.id);
      const isSpill = ev.spillTargets.includes(stock.id);
      if (!isTarget && !isSpill) continue;
      const signed = ev.direction * ev.magnitude * (isTarget ? 1 : ev.spillFactor);
      const asym = signed >= 0 ? regime.positiveImpact : regime.negativeImpact;
      const priced = ev.hinted && !ev.hintAmbiguous ? HINT_PRICED_IN : 1;
      const jitter = rng.range(0.85, 1.15);
      const impact = signed * stock.eventSensitivity * asym * priced * jitter;
      eventImpact += impact;
      if (isTarget) headlineImpact += impact + (ev.scope === 'MARKET' ? stock.beta * ev.marketImpact : 0);
      followThrough += impact * ev.followThrough;
      (eventImpacts[ev.uid] ??= {})[stock.id] = impact;
    }

    // Hint pre-move: the market starts pricing in a directional hint the day before.
    for (const ev of input.hintedTomorrow) {
      if (ev.hintAmbiguous || !ev.targets.includes(stock.id)) continue;
      eventImpact += ev.direction * ev.magnitude * HINT_PRE_MOVE * stock.eventSensitivity;
    }
    // False rumors: a small pop / dip that fades the next day.
    let rumorFade = 0;
    for (const rumor of input.rumors) {
      if (rumor.stockId !== stock.id) continue;
      const pop = rumor.direction * rumor.magnitude * stock.eventSensitivity;
      eventImpact += pop;
      rumorFade -= pop * 0.9;
    }

    let r = stock.baseTrend + stock.beta * marketFactor + noise + eventImpact + carry + reversion;

    // Headline guarantee: the player should be able to read the news. The stock in the
    // headline moves in the news direction by a meaningful amount — except for an occasional
    // "sell the news" reaction on smaller headlines, which stays modest.
    if (inNews && Math.abs(headlineImpact) > 0.004) {
      const dir = Math.sign(headlineImpact);
      const rank = Math.max(...headlines.map((e) => SEVERITY_RANK[e.severity]));
      const floor = Math.abs(headlineImpact) * MIN_HEADLINE_SHARE;
      if (newsRng.chance(SELL_THE_NEWS[rank] ?? 0)) {
        r = -dir * Math.abs(headlineImpact) * newsRng.range(0.15, 0.4);
      } else if (r * dir < floor) {
        r = dir * (floor + Math.abs(headlineImpact) * newsRng.range(0, 0.25));
      }
    }
    r = clamp(r, MAX_DAILY_DOWN, MAX_DAILY_UP);
    const price = roundPrice(prev * (1 + r));
    prices[stock.id] = price;
    changes[stock.id] = price / prev - 1;
    // Momentum: decays, gets topped up by today's news follow-through (or reversal).
    momentum[stock.id] = carry * 0.4 + followThrough * 0.6 + rumorFade;

    ticks[stock.id] = buildIntradayPath({
      day,
      from: prev,
      to: price,
      jump: clamp(eventImpact, -0.9, 3),
      vol: stock.volatility * regime.volMultiplier * 0.35,
      rng: tickRng,
    });
  }

  const indexTicks = buildIndexTicks(day, ticks, stocks);
  const prevIndex = computeIndex(prevPrices, stocks);
  const newIndex = computeIndex(prices, stocks);

  return {
    prices,
    ticks,
    indexTicks,
    marketState,
    momentum,
    changes,
    eventImpacts,
    marketChange: newIndex / prevIndex - 1,
  };
}

/**
 * Intraday path from the previous close to today's price.
 * A Brownian bridge in log-space, with the news jump placed at NEWS_TICK so the chart
 * visibly "gaps" when the headline hits.
 */
export function buildIntradayPath(opts: {
  day: number;
  from: number;
  to: number;
  jump: number;
  vol: number;
  rng: Rng;
}): PricePoint[] {
  const { day, from, to, rng } = opts;
  const total = Math.log(to / from);
  const jumpLog = Math.abs(opts.jump) > 0.015 ? Math.log(1 + opts.jump) : 0;
  const base = total - jumpLog;
  const steps = TICKS_PER_DAY;
  const walk: number[] = [0];
  for (let i = 1; i <= steps; i++) walk.push((walk[i - 1] ?? 0) + rng.gauss() * opts.vol * Math.sqrt(1 / steps));
  const end = walk[steps] ?? 0;
  const points: PricePoint[] = [];
  for (let t = 1; t <= steps; t++) {
    const frac = t / steps;
    const bridge = (walk[t] ?? 0) - frac * end;
    const logP = base * frac + bridge + (t >= NEWS_TICK ? jumpLog : 0);
    const price = t === steps ? to : roundPrice(from * Math.exp(logP));
    points.push({ day, tick: t, price });
  }
  return points;
}

export function buildIndexTicks(
  day: number,
  ticks: Record<string, PricePoint[]>,
  stocks: readonly StockDefinition[],
): PricePoint[] {
  const out: PricePoint[] = [];
  for (let t = 0; t < TICKS_PER_DAY; t++) {
    const prices: Record<string, number> = {};
    for (const s of stocks) prices[s.id] = ticks[s.id]?.[t]?.price ?? s.initialPrice;
    out.push({ day, tick: t + 1, price: Math.round(computeIndex(prices, stocks) * 100) / 100 });
  }
  return out;
}

/**
 * Pre-game history (days -9..0) so charts have context from the first day.
 * Simulated forward in a calm regime, then rescaled so day 0 closes exactly at initialPrice.
 */
export function generatePrehistory(
  seed: number,
  stocks: readonly StockDefinition[],
  difficulty: DifficultyConfig,
  days = 10,
): { history: Record<string, PricePoint[]>; indexHistory: PricePoint[] } {
  const raw: Record<string, PricePoint[]> = {};
  let prices: Record<string, number> = Object.fromEntries(stocks.map((s) => [s.id, s.initialPrice]));
  let state: MarketStateId = 'NEUTRAL';
  let momentum: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const day = i - days + 1; // -9 .. 0
    const result = simulateDay({
      seed: mixSeed(seed, 7777), // separate random stream from the game days
      day,
      stocks,
      difficulty,
      prevPrices: prices,
      prevState: state,
      momentum,
      events: [],
      hintedTomorrow: [],
      rumors: [],
    });
    for (const s of stocks) {
      const pts = (result.ticks[s.id] ?? []).map((p) => ({ ...p, day }));
      (raw[s.id] ??= []).push(...pts);
    }
    prices = result.prices;
    state = result.marketState === 'CRASH' || result.marketState === 'RALLY' ? 'NEUTRAL' : result.marketState;
    momentum = result.momentum;
  }
  const history: Record<string, PricePoint[]> = {};
  for (const s of stocks) {
    const pts = raw[s.id] ?? [];
    const last = pts[pts.length - 1]?.price ?? s.initialPrice;
    const k = s.initialPrice / last;
    history[s.id] = pts.map((p, idx) =>
      idx === pts.length - 1 ? { ...p, price: s.initialPrice } : { ...p, price: roundPrice(p.price * k) },
    );
  }
  const indexHistory: PricePoint[] = [];
  const perDay = TICKS_PER_DAY;
  for (let i = 0; i < days * perDay; i++) {
    const prices2: Record<string, number> = {};
    for (const s of stocks) prices2[s.id] = history[s.id]?.[i]?.price ?? s.initialPrice;
    const ref = history[stocks[0]?.id ?? '']?.[i];
    indexHistory.push({
      day: ref?.day ?? 0,
      tick: ref?.tick ?? 0,
      price: Math.round(computeIndex(prices2, stocks) * 100) / 100,
    });
  }
  return { history, indexHistory };
}
