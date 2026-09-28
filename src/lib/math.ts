export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

export const mean = (values: readonly number[]): number => (values.length ? sum(values) / values.length : 0);

/** Round to whole won; prices never drop below the floor. */
export const roundPrice = (price: number, floor = 50): number => Math.max(floor, Math.round(price));

export const pctChange = (from: number, to: number): number => (from > 0 ? to / from - 1 : 0);
