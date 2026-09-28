import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { getStock, STOCKS } from '@/data/stocks';
import { breakingNewsFor } from '@/engine/gameEngine';
import { totalValueAt } from '@/engine/portfolioEngine';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { directionSymbol, formatKRW, formatPct, trendClass } from '@/lib/format';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useTimeScale } from '@/hooks/useMotion';
import { useGameStore } from '@/store/gameStore';
import { SEVERITY_LABEL } from '@/lib/labels';
import { computeIndex } from '@/engine/marketEngine';

/**
 * The signature moment:
 *  1. ticker flash  2. BREAKING badge  3. headline  4. affected stocks highlight
 *  5. price moves (count-up)  6. portfolio impact  7. player decision
 */
export function BreakingNewsOverlay() {
  const game = useGameStore((s) => s.game);
  const dismissNews = useGameStore((s) => s.dismissNews);
  const placeOrder = useGameStore((s) => s.placeOrder);
  const scale = useTimeScale();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [stage, setStage] = useState(0);
  const [confirmSell, setConfirmSell] = useState(false);

  const data = useMemo(() => {
    if (!game) return null;
    const items = breakingNewsFor(game);
    const main = items[0];
    if (!main) return null;
    const affected = [...new Set(items.flatMap((n) => n.affected))].slice(0, 6);
    const before = totalValueAt(game, game.prevPrices);
    const after = totalValueAt(game, game.prices);
    const indexChange = computeIndex(game.prices, STOCKS) / computeIndex(game.prevPrices, STOCKS) - 1;
    const hasPositions = Object.values(game.holdings).some((h) => h.shares > 0);
    return { main, others: items.slice(1, 3), affected, before, after, indexChange, hasPositions };
  }, [game]);

  useEffect(() => {
    const times = [0, 250, 700, 1300, 1900, 2700, 3200];
    const timers = times.map((t, i) => setTimeout(() => setStage(i + 1), t * scale));
    return () => timers.forEach(clearTimeout);
  }, [scale]);

  if (!game || !data) return null;
  const { main } = data;
  const marketEvent = main.kind === 'MARKET';
  const bearish = main.direction === -1;
  const accent = marketEvent ? (bearish ? 'var(--color-down)' : 'var(--color-up)') : 'var(--color-amber)';
  const decision = marketEvent && bearish;

  const sellAll = () => {
    dismissNews();
    for (const h of Object.values(useGameStore.getState().game?.holdings ?? {})) {
      if (h.shares > 0) placeOrder({ type: 'SELL', stockId: h.stockId, shares: h.shares });
    }
  };
  const goMarket = () => {
    dismissNews();
    if (!desktop) navigate('/play/market');
  };

  return (
    <Modal open labelledBy="breaking-title" variant="overlay" className="w-full max-w-3xl px-4" onClose={stage >= 6 ? dismissNews : undefined}>
      <div className={`relative overflow-hidden rounded-2xl border bg-[var(--color-panel)] ${marketEvent && bearish && stage >= 5 ? 'animate-shake' : ''}`} style={{ borderColor: accent }}>
        {/* 1. ticker flash */}
        <div className="overflow-hidden border-b py-1.5" style={{ borderColor: accent, background: `color-mix(in srgb, ${accent} 16%, transparent)` }}>
          <div className="flex w-max animate-ticker font-mono text-[11px] font-bold tracking-[0.3em] whitespace-nowrap" style={{ color: accent }} aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="mx-6">
                속보 · BREAKING NEWS ●
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {/* 2. badge */}
          {stage >= 2 && (
            <div className="flex animate-stamp items-center gap-2">
              <span className="rounded px-2 py-1 font-mono text-xs font-extrabold tracking-[0.1em] text-[#120c02]" style={{ background: accent }}>
                {marketEvent ? (bearish ? '시장 경보' : '시장 급등') : '속보'}
              </span>
              <span className="font-mono text-[11px] text-[var(--color-dim)]">{game.day}일차 · 영향도 {SEVERITY_LABEL[main.severity]}</span>
            </div>
          )}
          {/* 3. headline */}
          {stage >= 3 && (
            <div className="animate-rise-in">
              <h2 id="breaking-title" className="mt-4 font-mono text-2xl leading-tight font-extrabold tracking-tight sm:text-4xl">
                {main.title}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{main.summary}</p>
              {data.others.map((o) => (
                <p key={o.id} className="mt-2 font-mono text-[12px] text-[var(--color-muted)]">
                  <span className="text-[var(--color-amber)]">추가 ▸</span> {o.title}
                </p>
              ))}
            </div>
          )}

          {/* 4 + 5. affected stocks with price move */}
          {stage >= 4 && (
            <div className="mt-5 grid animate-rise-in grid-cols-2 gap-2 sm:grid-cols-3">
              {marketEvent && (
                <MoveTile label="시장 지수" from={0} to={data.indexChange} revealed={stage >= 5} />
              )}
              {data.affected.map((id) => {
                const s = getStock(id);
                const change = (game.prices[id] ?? 0) / (game.prevPrices[id] ?? 1) - 1;
                return <MoveTile key={id} label={s?.ticker ?? id} sub={s?.name} from={0} to={change} revealed={stage >= 5} held={(game.holdings[id]?.shares ?? 0) > 0} />;
              })}
            </div>
          )}

          {/* 6. portfolio impact */}
          {stage >= 6 && data.hasPositions && (
            <div className="mt-5 flex animate-rise-in flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-4 py-3">
              <span className="label">내 포트폴리오</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="num text-sm text-[var(--color-muted)]">{formatKRW(data.before)}</span>
                <span className="text-[var(--color-dim)]">→</span>
                <AnimatedNumber value={data.after} format={formatKRW} className={`text-lg font-bold ${trendClass(data.after - data.before)}`} />
                <span className={`num text-sm ${trendClass(data.after - data.before)}`}>
                  {directionSymbol(data.after - data.before)} {formatPct(data.after / data.before - 1)}
                </span>
              </div>
            </div>
          )}

          {/* 7. decision */}
          {stage >= 7 && (
            <div className="mt-6 animate-rise-in">
              {decision && data.hasPositions ? (
                <>
                  <div className="label mb-2 text-center">당신의 선택은?</div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" size="lg" onClick={dismissNews} data-autofocus>
                      보유 유지
                    </Button>
                    <Button variant="sell" size="lg" onClick={() => (confirmSell ? sellAll() : setConfirmSell(true))}>
                      {confirmSell ? '정말 매도?' : '전량 매도'}
                    </Button>
                    <Button variant="buy" size="lg" onClick={goMarket}>
                      저점 매수
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="primary" size="lg" className="w-full" onClick={dismissNews} data-autofocus>
                  거래 계속하기 ▸
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MoveTile({ label, sub, to, revealed, held }: { label: string; sub?: string; from: number; to: number; revealed: boolean; held?: boolean }) {
  const shown = revealed ? to : 0;
  const tone = revealed ? trendClass(to) : 'text-[var(--color-muted)]';
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors duration-500 ${
        revealed ? (to >= 0 ? 'border-[var(--color-up)]/50 bg-[var(--color-up-soft)]' : 'border-[var(--color-down)]/50 bg-[var(--color-down-soft)]') : 'border-[var(--color-amber)]/60 bg-[var(--color-amber-soft)] animate-pulse-amber'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-extrabold">{label}</span>
        {held && <span className="rounded bg-[var(--color-info-soft)] px-1 font-mono text-[9px] font-bold text-[var(--color-info)]">보유</span>}
      </div>
      {sub && <div className="truncate text-[10px] text-[var(--color-dim)]">{sub}</div>}
      <div className={`num mt-1 text-2xl font-extrabold ${tone}`}>
        {revealed && <span aria-hidden="true">{directionSymbol(to)} </span>}
        <AnimatedNumber value={shown} format={(v) => formatPct(v, { digits: 1 })} duration={900} flash={false} />
      </div>
    </div>
  );
}
