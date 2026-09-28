import { getStock } from '@/data/stocks';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW, formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getValuation } from '@/store/selectors';

export function Holdings({ onSelect }: { onSelect?: (stockId: string) => void }) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const { positions } = getValuation(game);
  if (!positions.length) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--color-dim)]">보유 종목이 없습니다. 전액 현금 상태입니다.</p>;
  }
  return (
    <div>
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">보유 종목</caption>
        <thead>
          <tr className="label border-b border-[var(--color-line)] [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
            <th>STOCK</th>
            <th className="text-right">SHARES</th>
            <th className="text-right">AVG PRICE</th>
            <th className="text-right">CURRENT</th>
            <th className="text-right">VALUE</th>
            <th className="text-right">P&L</th>
            <th className="text-right">RETURN</th>
            <th className="text-right">WEIGHT</th>
          </tr>
        </thead>
        <tbody className="num text-[13px]">
          {positions.map((p) => (
            <tr
              key={p.stockId}
              className="cursor-pointer border-b border-[var(--color-line)]/60 hover:bg-[var(--color-panel-2)] [&>td]:px-4 [&>td]:py-2"
              onClick={() => onSelect?.(p.stockId)}
            >
              <td>
                <button type="button" className="font-bold" onClick={() => onSelect?.(p.stockId)}>
                  {getStock(p.stockId)?.ticker}
                </button>
              </td>
              <td className="text-right">{p.shares.toLocaleString('ko-KR')}</td>
              <td className="text-right">{formatKRW(p.avgPrice)}</td>
              <td className="text-right">
                {formatKRW(p.price)} <PriceChange value={p.dayChange} className="text-[10px]" hideSymbol />
              </td>
              <td className="text-right">{formatKRW(p.value)}</td>
              <td className={`text-right ${trendClass(p.pnl)}`}>{formatKRW(p.pnl, { sign: true })}</td>
              <td className="text-right">
                <PriceChange value={p.pnlPct} />
              </td>
              <td className="text-right text-[var(--color-muted)]">{(p.weight * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-[var(--color-line)] md:hidden">
        {positions.map((p) => {
          const s = getStock(p.stockId);
          return (
            <li key={p.stockId}>
              <button type="button" onClick={() => onSelect?.(p.stockId)} className="w-full px-4 py-3 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-bold">{s?.ticker}</span>
                    <span className="ml-2 text-[11px] text-[var(--color-dim)]">{p.shares.toLocaleString('ko-KR')} shares</span>
                  </div>
                  <span className="num text-sm font-semibold">{formatKRW(p.value)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="num text-[var(--color-dim)]">
                    AVG {formatKRW(p.avgPrice)} → {formatKRW(p.price)}
                  </span>
                  <span className={`num ${trendClass(p.pnl)}`}>
                    {formatKRW(p.pnl, { sign: true })} ({formatPct(p.pnlPct)})
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-panel-3)]">
                  <div className="h-full bg-[var(--color-info)]" style={{ width: `${Math.min(100, p.weight * 100)}%` }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
