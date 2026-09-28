/**
 * Deterministic, seedable pseudo-random number generation.
 * The same seed always produces the same market, which makes replays and debugging reproducible.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Standard normal variate (Box–Muller). */
  gauss(): number;
  /** Fat-tailed variate: mostly normal, occasionally a larger shock. */
  fatTail(): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
  shuffle<T>(items: readonly T[]): T[];
}

/** mulberry32 — small, fast, good enough for games. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix several integers into one 32-bit seed (for per-day / per-purpose streams). */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    let x = part | 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193);
      x >>>= 8;
    }
  }
  // final avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  let spare: number | null = null;

  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    gauss: () => {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.sin(2 * Math.PI * v);
      return mag * Math.cos(2 * Math.PI * v);
    },
    fatTail: () => {
      const g = rng.gauss();
      return next() < 0.06 ? g * 2.2 : g;
    },
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() from empty list');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted: (items, weight) => {
      const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
      if (total <= 0) return undefined;
      let r = next() * total;
      for (const item of items) {
        r -= Math.max(0, weight(item));
        if (r < 0) return item;
      }
      return items[items.length - 1];
    },
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as (typeof out)[number], out[i] as (typeof out)[number]];
      }
      return out;
    },
  };
  return rng;
}

/** New random game seed (non-deterministic source). */
export function generateSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] ?? 1) % 2147483647 || 1;
  }
  return Math.floor(Math.random() * 2147483646) + 1;
}

/** Named sub-streams so that adding randomness in one system never shifts another. */
export const STREAM = {
  SCHEDULE: 1,
  MARKET_STATE: 2,
  PRICES: 3,
  INTRADAY: 4,
  EVENT_MAGNITUDE: 5,
  DEBUG: 99,
} as const;
