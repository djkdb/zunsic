import { MARKET_STATES } from '@/data/marketStates';
import type { MarketStateId, RiskLevel } from '@/domain/types';
import type { PortfolioRiskLevel } from '@/engine/portfolioEngine';

const RISK_STYLE: Record<RiskLevel | 'NONE', string> = {
  NONE: 'text-[var(--color-dim)] border-[var(--color-line-strong)]',
  LOW: 'text-[var(--color-info)] border-[var(--color-info)]/40 bg-[var(--color-info-soft)]',
  MEDIUM: 'text-[var(--color-muted)] border-[var(--color-line-strong)] bg-[var(--color-panel-3)]',
  HIGH: 'text-[var(--color-amber)] border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)]',
  EXTREME: 'text-[var(--color-down)] border-[var(--color-down)]/40 bg-[var(--color-down-soft)]',
};

export function RiskBadge({ level, prefix = '' }: { level: RiskLevel | PortfolioRiskLevel; prefix?: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${RISK_STYLE[level]}`}>
      {prefix}
      {level === 'NONE' ? 'NO POSITION' : level}
    </span>
  );
}

const STATE_STYLE: Record<MarketStateId, string> = {
  BULL: 'text-[var(--color-up)] border-[var(--color-up)]/40 bg-[var(--color-up-soft)]',
  RALLY: 'text-[var(--color-up)] border-[var(--color-up)] bg-[var(--color-up-soft)] animate-pulse',
  NEUTRAL: 'text-[var(--color-muted)] border-[var(--color-line-strong)]',
  BEAR: 'text-[var(--color-down)] border-[var(--color-down)]/40 bg-[var(--color-down-soft)]',
  CRASH: 'text-[var(--color-down)] border-[var(--color-down)] bg-[var(--color-down-soft)] animate-pulse',
  VOLATILE: 'text-[var(--color-amber)] border-[var(--color-amber)]/40 bg-[var(--color-amber-soft)]',
};

const STATE_ICON: Record<MarketStateId, string> = { BULL: '▲', RALLY: '⇈', NEUTRAL: '■', BEAR: '▼', CRASH: '⇊', VOLATILE: '≈' };

export function MarketStateBadge({ state, showMood }: { state: MarketStateId; showMood?: boolean }) {
  const cfg = MARKET_STATES[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${STATE_STYLE[state]}`}
      title={`Market regime: ${cfg.label} (${cfg.mood})`}
    >
      <span aria-hidden="true">{STATE_ICON[state]}</span>
      {showMood ? cfg.mood : cfg.label}
    </span>
  );
}

export function TickerChip({ ticker, className = '' }: { ticker: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded bg-[var(--color-panel-3)] px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[var(--color-ink)] ${className}`}>
      {ticker}
    </span>
  );
}
