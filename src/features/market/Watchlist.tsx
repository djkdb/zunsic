import { memo } from 'react';
import { STOCKS } from '@/data/stocks';
import { Sparkline } from '@/components/chart/Sparkline';
import { RiskBadge } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW } from '@/lib/format';
import type { GameState } from '@/domain/types';
import { useGameStore } from '@/store/gameStore';
import { displayHistory, displayPrices, isPreReveal } from '@/store/selectors';

function dailyCloses(game: GameState, stockId: string, days: number): number[] {
  const series = displayHistory(game, stockId);
  const closes: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const p = series[i]!;
    const next = series[i + 1];
    if (!next || next.day !== p.day) closes.push(p.price);
  }
  return closes.slice(-days);
}

interface WatchlistProps {
  onSelect: (stockId: string) => void;
  compact?: boolean;
}

export const Watchlist = memo(function Watchlist({ onSelect, compact }: WatchlistProps) {
  const game = useGameStore((s) => s.game);
  const selected = useGameStore((s) => s.selectedStockId);
  if (!game) return null;
  const { prices, prev } = displayPrices(game);
  const highlighted = new Set(
    isPreReveal(game) ? [] : game.news.filter((n) => n.day === game.day && n.eventUid).flatMap((n) => n.affected),
  );

  return (
    <ul className="flex flex-col" aria-label="Watchlist">
      {STOCKS.map((s) => {
        const price = prices[s.id] ?? s.initialPrice;
        const change = price / (prev[s.id] ?? price) - 1;
        const held = game.holdings[s.id]?.shares ?? 0;
        const active = selected === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={active ? 'true' : undefined}
              aria-label={`${s.name} ${formatKRW(price)} ${change >= 0 ? '상승' : '하락'} ${(change * 100).toFixed(2)}%${held ? `, ${held}주 보유` : ''}`}
              className={`group flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${
                active ? 'border-[var(--color-ink)] bg-[var(--color-panel-2)]' : 'border-transparent hover:bg-[var(--color-panel-2)]/60'
              } ${highlighted.has(s.id) ? 'ring-1 ring-[var(--color-amber)]/40 ring-inset' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[13px] font-bold tracking-wide text-[var(--color-ink)]">{s.ticker}</span>
                  {held > 0 && (
                    <span className="rounded bg-[var(--color-info-soft)] px-1 font-mono text-[9px] font-bold text-[var(--color-info)]" title={`${held}주 보유`}>
                      ●{held}
                    </span>
                  )}
                  {highlighted.has(s.id) && <span className="font-mono text-[9px] font-bold text-[var(--color-amber)]">NEWS</span>}
                </div>
                <div className="truncate text-[11px] text-[var(--color-dim)]">{compact ? s.sector : s.name}</div>
              </div>
              {!compact && <Sparkline values={dailyCloses(game, s.id, 12)} />}
              <div className="w-[92px] text-right">
                <div className="num text-[13px] font-semibold text-[var(--color-ink)]">{formatKRW(price)}</div>
                <PriceChange value={change} className="text-[11px]" />
              </div>
              {compact && <RiskBadge level={s.riskLevel} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
});
