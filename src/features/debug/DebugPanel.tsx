import type { ReactNode } from 'react';
import { useState } from 'react';
import { MARKET_STATE_IDS } from '@/data/marketStates';
import { STOCKS } from '@/data/stocks';
import { formatKRW, formatPct } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getIndexView, getValuation } from '@/store/selectors';
import type { MarketStateId } from '@/domain/types';

/** Developer panel. Enabled only with ?debug=true in dev builds (or VITE_ENABLE_DEBUG=true). */
export default function DebugPanel() {
  const game = useGameStore((s) => s.game);
  const debug = useGameStore((s) => s.debug);
  const [open, setOpen] = useState(false);
  const [dayText, setDayText] = useState('');
  const [stockId, setStockId] = useState(STOCKS[0]?.id ?? '');
  const [priceText, setPriceText] = useState('');

  if (!game) {
    return (
      <div className="fixed right-2 bottom-2 z-[80] rounded-md border border-[var(--color-info)] bg-[var(--color-panel)] px-3 py-2 font-mono text-[11px] text-[var(--color-info)]">
        DEBUG · no active game
      </div>
    );
  }
  const v = getValuation(game);
  const idx = getIndexView(game);
  const queue = game.schedule.filter((e) => e.day > game.day).slice(0, 6);

  return (
    <div className="fixed top-16 right-2 z-[80] w-[300px] max-w-[calc(100vw-1rem)] rounded-lg border border-[var(--color-info)] bg-[var(--color-panel)]/97 font-mono text-[11px] shadow-2xl" data-testid="debug-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 font-bold text-[var(--color-info)]">
        <span>⚙ DEBUG PANEL</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="max-h-[70dvh] space-y-2 overflow-y-auto border-t border-[var(--color-line)] px-3 py-2 scrollbar-thin">
          <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <dt className="text-[var(--color-dim)]">DAY</dt>
            <dd data-testid="debug-day">
              {game.day}/{game.totalDays}
            </dd>
            <dt className="text-[var(--color-dim)]">PHASE</dt>
            <dd>{game.phase}</dd>
            <dt className="text-[var(--color-dim)]">MARKET STATE</dt>
            <dd data-testid="debug-state">{game.marketState}</dd>
            <dt className="text-[var(--color-dim)]">SEED</dt>
            <dd>{game.seed}</dd>
            <dt className="text-[var(--color-dim)]">MARKET INDEX</dt>
            <dd>
              {idx.value.toFixed(2)} ({formatPct(idx.change)})
            </dd>
            <dt className="text-[var(--color-dim)]">TOTAL ASSET</dt>
            <dd>{formatKRW(v.totalValue)}</dd>
            <dt className="text-[var(--color-dim)]">CASH</dt>
            <dd>{formatKRW(game.cash)}</dd>
          </dl>
          <div>
            <div className="text-[var(--color-dim)]">EVENT QUEUE</div>
            <ul className="mt-0.5 space-y-0.5">
              {queue.map((e) => (
                <li key={e.uid} className="truncate" title={e.title}>
                  <span className={e.direction > 0 ? 'text-up' : 'text-down'}>D{e.day}</span> {e.severity[0]} {e.hinted ? 'ʰ' : ''} {e.title}
                </li>
              ))}
              {!queue.length && <li className="text-[var(--color-dim)]">—</li>}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Btn onClick={debug.nextDay}>Next Day</Btn>
            <Btn onClick={() => debug.trigger('BULL')}>Trigger Bull</Btn>
            <Btn onClick={() => debug.trigger('CRASH')}>Trigger Crash</Btn>
            <Btn onClick={() => debug.trigger('RANDOM')}>Random Event</Btn>
            <Btn onClick={() => debug.addCash(1_000_000)}>+₩1,000,000</Btn>
            <Btn onClick={debug.resetMarket}>Reset Market</Btn>
            <Btn onClick={debug.resetPortfolio}>Reset Portfolio</Btn>
            <Btn onClick={debug.finish}>Finish Game</Btn>
          </div>
          <div className="flex gap-1">
            <input value={dayText} onChange={(e) => setDayText(e.target.value)} placeholder="day" className="h-7 w-16 rounded border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-1.5" aria-label="Set day" />
            <Btn onClick={() => Number(dayText) && debug.setDay(Number(dayText))}>Set Day</Btn>
          </div>
          <div className="flex gap-1">
            <select value={stockId} onChange={(e) => setStockId(e.target.value)} className="h-7 rounded border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-1" aria-label="Stock">
              {STOCKS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ticker}
                </option>
              ))}
            </select>
            <input value={priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="price" className="h-7 w-20 rounded border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-1.5" aria-label="Set price" />
            <Btn onClick={() => Number(priceText) && debug.setPrice(stockId, Number(priceText))}>Set Price</Btn>
          </div>
          <div className="flex flex-wrap gap-1">
            {MARKET_STATE_IDS.map((s) => (
              <button key={s} type="button" onClick={() => debug.forceState(s as MarketStateId)} className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] hover:border-[var(--color-info)]">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-7 rounded border border-[var(--color-line-strong)] px-2 text-left hover:border-[var(--color-info)] hover:text-[var(--color-info)]">
      {children}
    </button>
  );
}
