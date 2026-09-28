import { useId, useState } from 'react';
import { getStock, STOCKS } from '@/data/stocks';
import type { TradeType } from '@/domain/types';
import { maxBuyable, validateOrder } from '@/engine/tradingEngine';
import { Button } from '@/components/ui/Button';
import { formatKRW, formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';

interface OrderPanelProps {
  stockId: string;
  initialSide?: TradeType;
  onExecuted?: () => void;
  /** Allow switching stock from inside the panel (desktop). */
  showStockPicker?: boolean;
}

export function OrderPanel({ stockId, initialSide = 'BUY', onExecuted, showStockPicker }: OrderPanelProps) {
  const game = useGameStore((s) => s.game);
  const placeOrder = useGameStore((s) => s.placeOrder);
  const selectStock = useGameStore((s) => s.selectStock);
  const [side, setSide] = useState<TradeType>(initialSide);
  const [qtyText, setQtyText] = useState('');
  const [shake, setShake] = useState(0);
  const inputId = useId();
  const errorId = useId();

  if (!game) return null;
  const stock = getStock(stockId);
  if (!stock) return <div className="panel p-4 text-sm text-[var(--color-down)]">ERROR: 존재하지 않는 종목</div>;

  const price = game.prices[stock.id] ?? 0;
  const holding = game.holdings[stock.id];
  const held = holding?.shares ?? 0;
  const canTrade = game.phase === 'TRADING';
  const max = side === 'BUY' ? maxBuyable(game.cash, price) : held;
  const qty = qtyText.trim() === '' ? null : Number(qtyText);
  const check = qty === null ? null : validateOrder(game, { type: side, stockId: stock.id, shares: qty }, STOCKS);
  const preview = check?.ok ? check.value : null;
  const error = check && !check.ok ? check.error : null;

  const setFraction = (f: number) => setQtyText(String(Math.max(0, Math.floor(max * f))));
  const bump = (d: number) => setQtyText(String(Math.max(0, (Number.isFinite(qty ?? NaN) ? Math.floor(qty ?? 0) : 0) + d)));

  const submit = () => {
    const shares = qty ?? 0;
    const result = placeOrder({ type: side, stockId: stock.id, shares });
    if (result.ok) {
      setQtyText('');
      onExecuted?.();
    } else {
      setShake((n) => n + 1);
    }
  };

  const isBuy = side === 'BUY';
  return (
    <section className="panel overflow-hidden" aria-label={`${stock.ticker} 주문`}>
      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-1 border-b border-[var(--color-line)] p-1.5" role="radiogroup" aria-label="주문 종류">
        {(['BUY', 'SELL'] as TradeType[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={side === s}
            onClick={() => {
              setSide(s);
              setQtyText('');
            }}
            className={`h-11 rounded-md font-mono text-sm font-extrabold tracking-[0.15em] transition-colors ${
              side === s
                ? s === 'BUY'
                  ? 'bg-[var(--color-up)] text-[#04140b]'
                  : 'bg-[var(--color-down)] text-[#1a0505]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]'
            }`}
          >
            {s === 'BUY' ? '▲ BUY' : '▼ SELL'}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          {showStockPicker ? (
            <label className="flex items-center gap-2">
              <span className="sr-only">종목 선택</span>
              <select
                value={stock.id}
                onChange={(e) => {
                  selectStock(e.target.value);
                  setQtyText('');
                }}
                className="h-9 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-2 font-mono text-sm font-bold"
              >
                {STOCKS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ticker} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="font-mono text-sm font-bold">
              {stock.ticker} <span className="font-normal text-[var(--color-dim)]">{stock.name}</span>
            </span>
          )}
          <span className="num text-sm font-semibold">{formatKRW(price)}</span>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor={inputId} className="label">
              QUANTITY
            </label>
            <span className="num text-[11px] text-[var(--color-dim)]">
              {isBuy ? 'MAX BUY' : 'HOLDING'} {max.toLocaleString('ko-KR')}
            </span>
          </div>
          <div key={shake} className={`flex items-stretch gap-1.5 ${shake ? 'animate-shake' : ''}`}>
            <button type="button" onClick={() => bump(-1)} className="w-11 shrink-0 rounded-md border border-[var(--color-line-strong)] text-lg text-[var(--color-muted)] hover:text-[var(--color-ink)]" aria-label="수량 1 감소">
              −
            </button>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canTrade && submit()}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={`num h-11 w-full min-w-0 rounded-md border bg-[var(--color-panel-2)] px-3 text-right text-lg font-semibold outline-none focus:border-[var(--color-info)] ${
                error ? 'border-[var(--color-down)]' : 'border-[var(--color-line-strong)]'
              }`}
            />
            <button type="button" onClick={() => bump(1)} className="w-11 shrink-0 rounded-md border border-[var(--color-line-strong)] text-lg text-[var(--color-muted)] hover:text-[var(--color-ink)]" aria-label="수량 1 증가">
              +
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {(isBuy ? [0.1, 0.25, 0.5, 1] : [0.25, 0.5, 0.75, 1]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFraction(f)}
                disabled={max === 0}
                className="h-9 rounded-md bg-[var(--color-panel-2)] font-mono text-[11px] font-bold text-[var(--color-muted)] hover:text-[var(--color-ink)] disabled:opacity-40"
              >
                {f === 1 ? (isBuy ? 'MAX' : 'ALL') : `${f * 100}%`}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-1.5 rounded-md bg-[var(--color-panel-2)] p-3 font-mono text-[12px]">
          <Row label={isBuy ? 'EST. COST' : 'EST. PROCEEDS'} value={preview ? formatKRW(preview.total) : '—'} strong />
          {isBuy ? (
            <>
              <Row label="CASH AFTER" value={preview ? formatKRW(preview.cashAfter) : formatKRW(game.cash)} />
              <Row label="AVG PRICE AFTER" value={preview ? formatKRW(preview.avgPriceAfter) : holding ? formatKRW(holding.avgPrice) : '—'} />
              <Row label="SHARES AFTER" value={preview ? preview.sharesAfter.toLocaleString('ko-KR') : held.toLocaleString('ko-KR')} />
            </>
          ) : (
            <>
              <Row
                label="EXPECTED P&L"
                value={preview?.expectedPnL !== undefined ? `${formatKRW(preview.expectedPnL, { sign: true })} (${formatPct(holding ? price / holding.avgPrice - 1 : 0)})` : '—'}
                tone={preview?.expectedPnL}
              />
              <Row label="SHARES LEFT" value={preview ? preview.sharesAfter.toLocaleString('ko-KR') : held.toLocaleString('ko-KR')} />
              <Row label="CASH AFTER" value={preview ? formatKRW(preview.cashAfter) : formatKRW(game.cash)} />
            </>
          )}
        </dl>

        <p id={errorId} role="alert" className="min-h-[1.25rem] text-[12px] text-[var(--color-down)]">
          {error && qty !== null ? `⛔ BLOCKED — ${error.message}` : !canTrade ? '장이 열려 있지 않습니다.' : ''}
        </p>

        <Button variant={isBuy ? 'buy' : 'sell'} size="lg" className="h-14 w-full text-base" onClick={submit} disabled={!canTrade}>
          {isBuy ? `BUY ${stock.ticker}` : `SELL ${stock.ticker}`}
          {preview && <span className="num font-normal opacity-80">× {preview.shares.toLocaleString('ko-KR')}</span>}
        </Button>
        <p className="text-center text-[10px] text-[var(--color-dim)]">가상 게임 머니 거래 · 실제 투자와 무관</p>
      </div>
    </section>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[10px] tracking-wider text-[var(--color-dim)]">{label}</dt>
      <dd className={`num ${strong ? 'text-[13px] font-bold text-[var(--color-ink)]' : tone !== undefined ? trendClass(tone) : 'text-[var(--color-muted)]'}`}>{value}</dd>
    </div>
  );
}
