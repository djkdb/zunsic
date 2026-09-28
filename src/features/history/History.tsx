import { getStock } from '@/data/stocks';
import { formatDay, formatKRW } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';

export function History() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const txs = [...game.transactions].reverse();
  if (!txs.length) {
    return <p className="px-4 py-8 text-center text-sm text-[var(--color-dim)]">아직 거래 내역이 없습니다. 첫 주문을 넣어 보세요.</p>;
  }
  return (
    <div>
      {/* Desktop table */}
      <table className="hidden w-full text-left md:table">
        <caption className="sr-only">거래 내역</caption>
        <thead>
          <tr className="label border-b border-[var(--color-line)] [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
            <th>날짜</th>
            <th>구분</th>
            <th>종목</th>
            <th className="text-right">수량</th>
            <th className="text-right">체결가</th>
            <th className="text-right">거래금액</th>
            <th className="text-right">실현손익</th>
          </tr>
        </thead>
        <tbody className="num text-[13px]">
          {txs.map((t) => (
            <tr key={t.id} className="border-b border-[var(--color-line)]/60 [&>td]:px-4 [&>td]:py-2">
              <td className="text-[var(--color-muted)]">{formatDay(t.day)}</td>
              <td>
                <SideTag type={t.type} settlement={t.settlement} />
              </td>
              <td className="font-bold">{t.ticker}</td>
              <td className="text-right">{t.shares.toLocaleString('ko-KR')}주</td>
              <td className="text-right">{formatKRW(t.price)}</td>
              <td className="text-right">{formatKRW(t.total)}</td>
              <td className={`text-right ${t.realizedPnL === undefined ? 'text-[var(--color-dim)]' : t.realizedPnL >= 0 ? 'text-up' : 'text-down'}`}>
                {t.realizedPnL === undefined ? '—' : formatKRW(t.realizedPnL, { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile cards */}
      <ul className="divide-y divide-[var(--color-line)] md:hidden">
        {txs.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-16 font-mono text-[11px] text-[var(--color-muted)]">{formatDay(t.day)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <SideTag type={t.type} settlement={t.settlement} />
                <span className="font-mono text-sm font-bold">{t.ticker}</span>
              </div>
              <div className="num mt-0.5 text-[11px] text-[var(--color-dim)]">
                {t.shares.toLocaleString('ko-KR')}주 × {formatKRW(t.price)} · {getStock(t.stockId)?.name}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-[13px] font-semibold">{formatKRW(t.total)}</div>
              {t.realizedPnL !== undefined && (
                <div className={`num text-[11px] ${t.realizedPnL >= 0 ? 'text-up' : 'text-down'}`}>{formatKRW(t.realizedPnL, { sign: true })}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SideTag({ type, settlement }: { type: 'BUY' | 'SELL'; settlement?: boolean }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        type === 'BUY' ? 'bg-[var(--color-up-soft)] text-up' : 'bg-[var(--color-down-soft)] text-down'
      }`}
    >
      {type === 'BUY' ? '▲ 매수' : settlement ? '▼ 정산' : '▼ 매도'}
    </span>
  );
}
