import { memo, type ReactNode } from 'react';
import { STOCKS } from '@/data/stocks';
import { Sparkline } from '@/components/chart/Sparkline';
import { RiskBadge } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW } from '@/lib/format';
import type { GameState } from '@/domain/types';
import { useGameStore } from '@/store/gameStore';
import { displayHistory, displayPrices, getTodayHints, getUpcomingCalendar, isPreReveal } from '@/store/selectors';

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
    isPreReveal(game)
      ? []
      : game.news.filter((n) => n.day === game.day && n.eventUid && n.kind !== 'RUMOR' && n.kind !== 'ANALYST').flatMap((n) => n.affected),
  );
  const rumored = new Set(getTodayHints(game).flatMap((n) => n.affected));
  const scheduled = new Map(getUpcomingCalendar(game).flatMap((e) => e.stockIds.map((id) => [id, e] as const)));

  return (
    <ul className="flex flex-col" aria-label="관심 종목">
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
                <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                  <span className="font-mono text-[13px] font-bold tracking-wide text-[var(--color-ink)]">{s.ticker}</span>
                  {held > 0 && <Tag className="bg-[var(--color-info-soft)] text-[var(--color-info)]" title={`${held}주 보유`}>{held}주</Tag>}
                  {highlighted.has(s.id) && <Tag className="bg-[var(--color-amber-soft)] text-[var(--color-amber)]" title="오늘 이 종목 관련 뉴스가 나왔습니다">뉴스</Tag>}
                  {rumored.has(s.id) && <Tag className="border border-dashed border-[var(--color-line-strong)] text-[var(--color-muted)]" title="오늘 확인되지 않은 소문이 돌고 있습니다">소문</Tag>}
                  {scheduled.has(s.id) && (
                    <Tag className="border border-[var(--color-amber)]/40 text-[var(--color-amber)]" title={scheduled.get(s.id)?.label}>
                      {scheduled.get(s.id)?.inDays === 1 ? '내일 발표' : `D-${scheduled.get(s.id)?.inDays}`}
                    </Tag>
                  )}
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

function Tag({ children, className, title }: { children: ReactNode; className: string; title?: string }) {
  return (
    <span className={`shrink-0 rounded px-1 font-mono text-[9px] leading-4 font-bold ${className}`} title={title}>
      {children}
    </span>
  );
}
