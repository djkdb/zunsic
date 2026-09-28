import type { MarketStateConfig, MarketStateId } from '@/domain/types';

/**
 * Market regimes. The market factor (shared by all stocks, scaled by beta) is drawn
 * from the current regime. CRASH and RALLY are only entered through events, so the
 * player can always trace a panic or a boom back to a headline.
 */
export const MARKET_STATES: Record<MarketStateId, MarketStateConfig> = {
  BULL: {
    id: 'BULL',
    label: 'BULL',
    mood: 'BULLISH',
    drift: 0.003,
    marketVol: 0.008,
    volMultiplier: 0.95,
    positiveImpact: 1.15,
    negativeImpact: 0.9,
    transitions: { BULL: 0.62, NEUTRAL: 0.25, VOLATILE: 0.08, BEAR: 0.05 },
  },
  NEUTRAL: {
    id: 'NEUTRAL',
    label: 'NEUTRAL',
    mood: 'NEUTRAL',
    drift: 0.0001,
    marketVol: 0.007,
    volMultiplier: 1,
    positiveImpact: 1,
    negativeImpact: 1,
    transitions: { NEUTRAL: 0.5, BULL: 0.22, BEAR: 0.16, VOLATILE: 0.12 },
  },
  BEAR: {
    id: 'BEAR',
    label: 'BEAR',
    mood: 'BEARISH',
    drift: -0.0035,
    marketVol: 0.009,
    volMultiplier: 1.1,
    positiveImpact: 0.85,
    negativeImpact: 1.2,
    transitions: { BEAR: 0.55, NEUTRAL: 0.28, VOLATILE: 0.12, BULL: 0.05 },
  },
  VOLATILE: {
    id: 'VOLATILE',
    label: 'VOLATILE',
    mood: 'UNSTABLE',
    drift: 0,
    marketVol: 0.016,
    volMultiplier: 1.6,
    positiveImpact: 1.2,
    negativeImpact: 1.25,
    transitions: { VOLATILE: 0.4, NEUTRAL: 0.3, BEAR: 0.15, BULL: 0.15 },
  },
  CRASH: {
    id: 'CRASH',
    label: 'CRASH',
    mood: 'PANIC',
    drift: -0.018,
    marketVol: 0.02,
    volMultiplier: 1.9,
    positiveImpact: 0.7,
    negativeImpact: 1.15,
    transitions: { VOLATILE: 0.5, BEAR: 0.4, NEUTRAL: 0.1 },
  },
  RALLY: {
    id: 'RALLY',
    label: 'RALLY',
    mood: 'EUPHORIC',
    drift: 0.014,
    marketVol: 0.012,
    volMultiplier: 1.35,
    positiveImpact: 1.3,
    negativeImpact: 0.8,
    transitions: { BULL: 0.6, VOLATILE: 0.25, NEUTRAL: 0.15 },
  },
};

export const MARKET_STATE_IDS = Object.keys(MARKET_STATES) as MarketStateId[];
