import { useMemo, useState } from 'react';
import { PriceChart } from '@/components/chart/PriceChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { MarketStateBadge } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { useGameStore } from '@/store/gameStore';
import { displayIndexHistory, getIndexView, isPreReveal } from '@/store/selectors';
import { sliceForPeriod, type Period } from '@/components/chart/chartUtils';

export function MarketIndexCard({ chartHeight = 120 }: { chartHeight?: number }) {
  const game = useGameStore((s) => s.game);
  const [period, setPeriod] = useState<Period>('1M');
  const series = useMemo(() => (game ? displayIndexHistory(game) : []), [game]);
  const points = useMemo(() => sliceForPeriod(series, period), [series, period]);
  if (!game) return null;
  const view = getIndexView(game);
  const state = isPreReveal(game) ? (game.marketStateHistory[game.marketStateHistory.length - 2] ?? 'NEUTRAL') : game.marketState;
  return (
    <section className="panel p-3" aria-label="Market index">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label">MARKET INDEX</div>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={view.value} format={(v) => v.toFixed(2)} className="text-xl font-bold" />
            <PriceChange value={view.change} className="text-sm font-semibold" />
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--color-dim)]">
            TODAY <PriceChange value={view.dayChange} className="text-[10px]" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <MarketStateBadge state={state} showMood />
          <div className="flex gap-0.5">
            {(['1D', '1W', '1M'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={`h-6 rounded px-1.5 font-mono text-[10px] font-bold ${period === p ? 'bg-[var(--color-panel-3)] text-[var(--color-ink)]' : 'text-[var(--color-dim)]'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PriceChart points={points} height={chartHeight} valueFormat={(v) => v.toFixed(1)} ariaLabel="Market index chart" showHighLow={false} />
    </section>
  );
}
