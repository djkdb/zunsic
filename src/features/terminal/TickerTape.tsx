import { memo } from 'react';
import { STOCKS } from '@/data/stocks';
import { directionSymbol, formatKRW, formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { displayPrices, getVisibleNews } from '@/store/selectors';

/** Scrolling tape: latest headline + every ticker. Purely decorative for AT (duplicated content hidden). */
export const TickerTape = memo(function TickerTape() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const { prices, prev } = displayPrices(game);
  const latest = getVisibleNews(game).find((n) => n.kind === 'BREAKING' || n.kind === 'MARKET');
  const items = (
    <>
      {latest && (
        <span className="mx-4 inline-flex items-center gap-2">
          <span className="rounded bg-[var(--color-amber)] px-1.5 font-bold text-[#1b1203]">속보</span>
          <span className="text-[var(--color-ink)]">{latest.title}</span>
        </span>
      )}
      {STOCKS.map((s) => {
        const p = prices[s.id] ?? s.initialPrice;
        const c = p / (prev[s.id] ?? p) - 1;
        return (
          <span key={s.id} className="mx-4 inline-flex items-center gap-1.5">
            <span className="font-bold text-[var(--color-ink)]">{s.ticker}</span>
            <span className="text-[var(--color-muted)]">{formatKRW(p)}</span>
            <span className={trendClass(c)}>
              {directionSymbol(c)} {formatPct(c)}
            </span>
          </span>
        );
      })}
    </>
  );
  return (
    <div className="relative overflow-hidden border-b border-[var(--color-line)] bg-[var(--color-panel)]" aria-hidden="true">
      <div className="flex w-max animate-ticker py-1.5 font-mono text-[11px] whitespace-nowrap hover:[animation-play-state:paused]">
        <div className="flex">{items}</div>
        <div className="flex">{items}</div>
      </div>
    </div>
  );
});
