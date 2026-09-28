import { useMemo, useState } from 'react';
import { PriceChart } from '@/components/chart/PriceChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { MarketStateBadge } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { useGameStore } from '@/store/gameStore';
import { displayIndexHistory, getIndexView, isPreReveal } from '@/store/selectors';
import { PERIOD_LABEL, sliceForPeriod, type Period } from '@/components/chart/chartUtils';

export function MarketIndexCard({ chartHeight = 120 }: { chartHeight?: number }) {
  const game = useGameStore((s) => s.game);
  const [period, setPeriod] = useState<Period>('1M');
  const series = useMemo(() => (game ? displayIndexHistory(game) : []), [game]);
  const points = useMemo(() => sliceForPeriod(series, period), [series, period]);
  if (!game) return null;
  const view = getIndexView(game);
  const state = isPreReveal(game) ? (game.marketStateHistory[game.marketStateHistory.length - 2] ?? 'NEUTRAL') : game.marketState;
  return (
    <section className="panel p-3" aria-label="시장 지수">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label">시장 지수</div>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={view.value} format={(v) => v.toFixed(2)} className="text-xl font-bold" />
            <PriceChange value={view.change} className="text-sm font-semibold" />
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-[var(--color-dim)]">
            오늘 <PriceChange value={view.dayChange} className="text-[10px]" />
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
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PriceChart points={points} height={chartHeight} valueFormat={(v) => v.toFixed(1)} ariaLabel="시장 지수 차트" showHighLow={false} />
    </section>
  );
}
