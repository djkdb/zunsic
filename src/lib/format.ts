/** Formatting helpers. All currency is fictional in-game KRW. */

const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

export function formatKRW(value: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '₩—';
  const rounded = Math.round(value);
  const sign = opts.sign ? (rounded > 0 ? '+' : rounded < 0 ? '-' : '') : rounded < 0 ? '-' : '';
  return `${sign}₩${krw.format(Math.abs(rounded))}`;
}

/** Compact currency for tight spaces: ₩1.38M, ₩842K. */
export function formatKRWCompact(value: number, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '₩—';
  const abs = Math.abs(value);
  const sign = opts.sign ? (value > 0 ? '+' : value < 0 ? '-' : '') : value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}₩${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${sign}₩${(abs / 1_000).toFixed(0)}K`;
  return `${sign}₩${krw.format(Math.round(abs))}`;
}

/** Fraction → percent string. 0.0842 → "+8.42%". */
export function formatPct(fraction: number, opts: { sign?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(fraction)) return '—%';
  const digits = opts.digits ?? 2;
  const pct = fraction * 100;
  const fixed = Math.abs(pct).toFixed(digits);
  const isZero = Number(fixed) === 0;
  const sign = opts.sign !== false && !isZero ? (pct > 0 ? '+' : '-') : pct < 0 && !isZero ? '-' : '';
  return `${sign}${fixed}%`;
}

export function formatNumber(value: number): string {
  return krw.format(Math.round(value));
}

export function formatDay(day: number): string {
  return `${day}일차`;
}

/** ▲ / ▼ / ■ — direction is never conveyed by color alone. */
export function directionSymbol(value: number): string {
  if (value > 0.00001) return '▲';
  if (value < -0.00001) return '▼';
  return '■';
}

export function trendClass(value: number): 'text-up' | 'text-down' | 'text-flat' {
  if (value > 0.00001) return 'text-up';
  if (value < -0.00001) return 'text-down';
  return 'text-flat';
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
