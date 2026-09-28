import { directionSymbol, formatKRW, formatPct, trendClass } from '@/lib/format';

interface PriceChangeProps {
  value: number;
  /** Absolute won change, shown before the percentage. */
  amount?: number;
  className?: string;
  digits?: number;
  hideSymbol?: boolean;
}

/** ▲ +8.20% / ▼ -4.10% — direction is conveyed by symbol + color. */
export function PriceChange({ value, amount, className = '', digits = 2, hideSymbol }: PriceChangeProps) {
  return (
    <span className={`num whitespace-nowrap ${trendClass(value)} ${className}`}>
      {!hideSymbol && <span aria-hidden="true">{directionSymbol(value)} </span>}
      {amount !== undefined && <>{formatKRW(amount, { sign: true })} </>}
      {formatPct(value, { digits })}
    </span>
  );
}
