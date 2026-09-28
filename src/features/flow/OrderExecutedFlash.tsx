import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatKRW } from '@/lib/format';
import { useTimeScale } from '@/hooks/useMotion';
import { useGameStore } from '@/store/gameStore';

/** Big "ORDER EXECUTED" stamp after every successful trade. Non-blocking. */
export function OrderExecutedFlash() {
  const flash = useGameStore((s) => s.orderFlash);
  const clear = useGameStore((s) => s.clearOrderFlash);
  const scale = useTimeScale();
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(clear, Math.max(900, 1500 * scale));
    return () => clearTimeout(t);
  }, [flash, clear, scale]);
  if (!flash) return null;
  const { tx } = flash;
  const buy = tx.type === 'BUY';
  const color = buy ? 'var(--color-up)' : 'var(--color-down)';
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-24 z-[60] flex justify-center px-4" role="status" aria-live="assertive">
      <div key={flash.id} className="animate-stamp rounded-xl border-2 bg-[var(--color-bg)]/95 px-6 py-4 text-center shadow-2xl backdrop-blur" style={{ borderColor: color }}>
        <div className="font-mono text-[10px] font-bold tracking-[0.3em] text-[var(--color-dim)]">ORDER EXECUTED</div>
        <div className="font-mono text-2xl font-extrabold tracking-[0.06em] sm:text-3xl" style={{ color }}>
          주문 체결
        </div>
        <div className="num mt-1 text-sm text-[var(--color-ink)]">
          {buy ? '▲ 매수' : '▼ 매도'} {tx.ticker} {tx.shares.toLocaleString('ko-KR')}주 × {formatKRW(tx.price)}
        </div>
        <div className="num text-xs text-[var(--color-muted)]">
          거래금액 {formatKRW(tx.total)}
          {tx.realizedPnL !== undefined && (
            <span className={tx.realizedPnL >= 0 ? 'text-up' : 'text-down'}> · 실현손익 {formatKRW(tx.realizedPnL, { sign: true })}</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
