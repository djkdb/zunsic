import { useMemo, useState } from 'react';
import { getStock } from '@/data/stocks';
import type { StockDefinition } from '@/domain/types';
import { sliceForPeriod, type Period } from '@/components/chart/chartUtils';
import { PriceChart, type ChartMarker } from '@/components/chart/PriceChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RiskBadge, TickerChip } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatDay, formatKRW, formatPct } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { displayHistory, displayPrices, getValuation, getVisibleNews } from '@/store/selectors';
import { NewsItemRow } from '@/features/news/NewsFeed';

const PERIODS: { id: Period; label: string; hint: string }[] = [
  { id: '1D', label: '1D', hint: '오늘' },
  { id: '1W', label: '1W', hint: '최근 7일' },
  { id: '1M', label: '1M', hint: '전체 기간' },
];

const TREND_LABEL: Record<StockDefinition['trendBias'], string> = {
  DECLINE: 'Decline',
  STABLE: 'Stable',
  GROWTH: 'Growth',
  HYPER_GROWTH: 'Hyper-growth',
};

interface StockDetailProps {
  stockId: string;
  chartHeight?: number;
}

export function StockDetail({ stockId, chartHeight = 300 }: StockDetailProps) {
  const game = useGameStore((s) => s.game);
  const [period, setPeriod] = useState<Period>('1M');
  const stock = getStock(stockId);

  const series = useMemo(() => (game && stock ? displayHistory(game, stock.id) : []), [game, stock]);
  const points = useMemo(() => sliceForPeriod(series, period), [series, period]);
  const markers = useMemo<ChartMarker[]>(
    () =>
      game && stock
        ? game.transactions
            .filter((t) => t.stockId === stock.id && !t.settlement)
            .map((t) => ({ day: t.day, type: t.type, shares: t.shares, price: t.price }))
        : [],
    [game, stock],
  );

  if (!game) return null;
  if (!stock) {
    return <div className="panel p-6 text-sm text-[var(--color-down)]">ERROR: 존재하지 않는 종목입니다.</div>;
  }

  const { prices, prev } = displayPrices(game);
  const price = prices[stock.id] ?? stock.initialPrice;
  const change = price / (prev[stock.id] ?? price) - 1;
  const position = getValuation(game).positions.find((p) => p.stockId === stock.id);
  const news = getVisibleNews(game)
    .filter((n) => n.affected.includes(stock.id))
    .slice(0, 4);
  const periodChange = points.length > 1 ? (points[points.length - 1]!.price / points[0]!.price - 1) : 0;
  const hi = points.length ? Math.max(...points.map((p) => p.price)) : price;
  const lo = points.length ? Math.min(...points.map((p) => p.price)) : price;

  return (
    <section aria-labelledby={`stock-${stock.id}`} className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TickerChip ticker={stock.ticker} />
            <RiskBadge level={stock.riskLevel} prefix="RISK " />
            <span className="label">{stock.sector}</span>
          </div>
          <h2 id={`stock-${stock.id}`} className="mt-1.5 truncate font-mono text-xl font-extrabold tracking-tight sm:text-2xl">
            {stock.name}
          </h2>
        </div>
        <div className="text-right">
          <AnimatedNumber value={price} format={formatKRW} className="block text-2xl font-bold sm:text-3xl" duration={800} />
          <PriceChange value={change} amount={price - (prev[stock.id] ?? price)} className="text-sm" />
        </div>
      </div>

      {/* Chart */}
      <div className="panel p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div role="tablist" aria-label="차트 기간" className="flex gap-1 rounded-lg bg-[var(--color-panel-2)] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                title={p.hint}
                onClick={() => setPeriod(p.id)}
                className={`h-8 min-w-11 rounded-md px-2.5 font-mono text-xs font-bold transition-colors ${
                  period === p.id ? 'bg-[var(--color-ink)] text-[var(--color-bg)]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--color-dim)]">
            <span>
              H <span className="text-[var(--color-muted)]">{formatKRW(hi)}</span>
            </span>
            <span>
              L <span className="text-[var(--color-muted)]">{formatKRW(lo)}</span>
            </span>
            <PriceChange value={periodChange} className="text-[11px]" />
          </div>
        </div>
        <PriceChart
          points={points}
          markers={markers}
          height={chartHeight}
          reference={position ? { value: position.avgPrice, label: `AVG ${formatKRW(position.avgPrice)}` } : undefined}
          ariaLabel={`${stock.name} ${period} 가격 차트`}
        />
        <div className="mt-1 flex items-center gap-4 font-mono text-[10px] text-[var(--color-dim)]">
          <span><span className="text-up">▲</span> BUY</span>
          <span><span className="text-down">▼</span> SELL</span>
          {position && <span className="text-[var(--color-info)]">- - AVG PRICE</span>}
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
        <Stat label="SHARES" value={position ? `${position.shares.toLocaleString('ko-KR')}` : '—'} />
        <Stat label="AVG PRICE" value={position ? formatKRW(position.avgPrice) : '—'} />
        <Stat label="VALUE" value={position ? formatKRW(position.value) : '—'} />
        <Stat
          label="P&L"
          value={position ? `${formatKRW(position.pnl, { sign: true })}` : '—'}
          sub={position ? formatPct(position.pnlPct) : undefined}
          tone={position ? position.pnl : 0}
        />
      </div>

      {/* Profile + news */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-4">
          <h3 className="label mb-2">COMPANY PROFILE</h3>
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">{stock.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs">
            <Def term="SECTOR" value={stock.sector} />
            <Def term="RISK" value={stock.riskLevel} />
            <Def term="BASE TREND" value={TREND_LABEL[stock.trendBias]} />
            <Def term="VOLATILITY" value={`${(stock.volatility * 100).toFixed(1)}% / day`} />
            <Def term="MARKET BETA" value={stock.beta.toFixed(2)} />
            <Def term="NEWS SENSITIVITY" value={`×${stock.eventSensitivity.toFixed(2)}`} />
          </dl>
          <p className="mt-3 text-[11px] text-[var(--color-dim)]">※ 완전히 가상의 기업입니다. 실제 기업·종목과 무관합니다.</p>
        </div>
        <div className="panel p-4">
          <h3 className="label mb-2">RECENT NEWS · {stock.ticker}</h3>
          {news.length === 0 ? (
            <p className="py-4 text-sm text-[var(--color-dim)]">아직 관련 뉴스가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]">
              {news.map((n) => (
                <NewsItemRow key={n.id} item={n} focusStock={stock.id} compact />
              ))}
            </ul>
          )}
        </div>
      </div>
      <span className="sr-only">{formatDay(game.day)}</span>
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: number }) {
  const color = tone === undefined || tone === 0 ? 'text-[var(--color-ink)]' : tone > 0 ? 'text-up' : 'text-down';
  return (
    <div className="bg-[var(--color-panel)] px-3 py-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className={`num mt-0.5 text-sm font-semibold ${color}`}>
        {tone !== undefined && tone !== 0 && <span aria-hidden="true">{tone > 0 ? '▲ ' : '▼ '}</span>}
        {value}
      </div>
      {sub && <div className={`num text-[11px] ${color}`}>{sub}</div>}
    </div>
  );
}

function Def({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wider text-[var(--color-dim)]">{term}</dt>
      <dd className="text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}
