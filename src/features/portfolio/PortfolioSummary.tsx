import type { ReactNode } from 'react';
import { getStock } from '@/data/stocks';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RiskBadge } from '@/components/ui/Badges';
import { directionSymbol, formatKRW, formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getValuation } from '@/store/selectors';

export function PortfolioSummary({ hero }: { hero?: boolean }) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const v = getValuation(game);
  const signed = (x: number) => formatKRW(x, { sign: true });

  return (
    <section className="panel overflow-hidden" aria-label="포트폴리오 요약">
      <div className="border-b border-[var(--color-line)] px-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <span className="label">총자산</span>
          <RiskBadge level={v.risk.level} prefix={v.risk.level === 'NONE' ? '' : '위험 '} />
        </div>
        <AnimatedNumber
          value={v.totalValue}
          format={formatKRW}
          testId="total-value"
          className={`mt-1 block font-extrabold tracking-tight ${hero ? 'text-4xl' : 'text-3xl'}`}
          duration={900}
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`num text-sm font-semibold ${trendClass(v.returnPct)}`} aria-label={`총 수익률 ${formatPct(v.returnPct)}`}>
            {directionSymbol(v.returnPct)} <AnimatedNumber value={v.returnPct} format={(x) => formatPct(x)} flash={false} />
          </span>
          <span className="label !text-[10px]">총 수익률</span>
          <span className={`num text-xs ${trendClass(v.dailyPnL)}`}>
            오늘 <AnimatedNumber value={v.dailyPnL} format={signed} flash={false} /> ({formatPct(v.dailyPct)})
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-[var(--color-line)]">
        <Cell label="현금" value={<AnimatedNumber value={v.cash} format={formatKRW} testId="cash-value" />} sub={v.totalValue > 0 ? `${((v.cash / v.totalValue) * 100).toFixed(0)}%` : undefined} />
        <Cell label="투자금 (평가)" value={<AnimatedNumber value={v.invested} format={formatKRW} />} sub={v.totalValue > 0 ? `${((v.invested / v.totalValue) * 100).toFixed(0)}%` : undefined} />
      </dl>

      <dl className="grid grid-cols-3 gap-px border-t border-[var(--color-line)] bg-[var(--color-line)]">
        <Cell small label="실현손익" value={<Signed value={v.realizedPnL} testId="realized-value" />} />
        <Cell small label="미실현손익" value={<Signed value={v.unrealizedPnL} testId="unrealized-value" />} />
        <Cell small label="총 손익" value={<Signed value={v.totalPnL} />} />
      </dl>

      {v.concentration && (
        <div role="status" className="flex items-start gap-2 border-t border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)] px-4 py-2.5 text-[12px] text-[var(--color-amber)]">
          <span aria-hidden="true">⚠</span>
          <span>
            <b className="font-mono tracking-wider">집중 투자 경고</b> — 포트폴리오의 {(v.concentration.weight * 100).toFixed(0)}%가{' '}
            {getStock(v.concentration.stockId)?.ticker}에 투자되어 있습니다.
          </span>
        </div>
      )}
      <RiskMeter score={v.risk.score} diversification={v.risk.diversification} />
    </section>
  );
}

function Signed({ value, testId }: { value: number; testId?: string }) {
  return (
    <span className={trendClass(value)}>
      <AnimatedNumber value={value} format={(x) => formatKRW(x, { sign: true })} flash={false} testId={testId} />
    </span>
  );
}

function Cell({ label, value, sub, small }: { label: string; value: ReactNode; sub?: string; small?: boolean }) {
  return (
    <div className="bg-[var(--color-panel)] px-4 py-2.5">
      <dt className="label !text-[10px]">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${small ? 'text-[12px]' : 'text-[15px]'}`}>
        {value}
        {sub && <span className="num ml-1.5 text-[10px] font-normal text-[var(--color-dim)]">{sub}</span>}
      </dd>
    </div>
  );
}

function RiskMeter({ score, diversification }: { score: number; diversification: number }) {
  return (
    <div className="border-t border-[var(--color-line)] px-4 py-2.5">
      <div className="flex items-center justify-between">
        <span className="label !text-[10px]">포트폴리오 위험도</span>
        <span className="num text-[10px] text-[var(--color-dim)]">
          {score}/100 · 분산도 {(diversification * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-3)]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="포트폴리오 위험도">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${Math.max(2, score)}%`,
            background: score < 22 ? 'var(--color-info)' : score < 45 ? 'var(--color-muted)' : score < 70 ? 'var(--color-amber)' : 'var(--color-down)',
          }}
        />
      </div>
    </div>
  );
}
