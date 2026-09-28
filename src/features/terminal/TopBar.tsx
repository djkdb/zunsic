import { Link } from 'react-router';
import { GAME_TITLE } from '@/domain/constants';
import { Button } from '@/components/ui/Button';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { MarketStateBadge } from '@/components/ui/Badges';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getIndexView, getValuation, isPreReveal } from '@/store/selectors';

export function TopBar() {
  const game = useGameStore((s) => s.game);
  const closeMarket = useGameStore((s) => s.closeMarket);
  if (!game) return null;
  const index = getIndexView(game);
  const valuation = getValuation(game);
  const trading = game.phase === 'TRADING';
  const lastDay = game.day >= game.totalDays;
  const shownState = isPreReveal(game) ? (game.marketStateHistory[game.marketStateHistory.length - 2] ?? 'NEUTRAL') : game.marketState;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-mono text-sm font-extrabold tracking-tight text-[var(--color-ink)]" aria-label="MARKET//30 홈으로">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-ink)] text-[11px] text-[var(--color-bg)]">M</span>
          <span className="hidden sm:inline">{GAME_TITLE}</span>
        </Link>

        <DayProgress day={game.day} total={game.totalDays} />

        <div className="hidden items-center gap-2 md:flex" aria-label="시장 지수">
          <span className="label">지수</span>
          <AnimatedNumber value={index.value} format={(v) => v.toFixed(2)} className="text-sm font-semibold" duration={600} />
          <PriceChange value={index.change} className="text-xs" />
          <MarketStateBadge state={shownState} />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight lg:hidden">
            <div className="label !text-[9px]">총자산</div>
            <AnimatedNumber value={valuation.totalValue} format={formatKRW} className="text-[13px] font-semibold" />
          </div>
          <Button
            variant={lastDay ? 'amber' : 'primary'}
            size="md"
            className="min-w-[112px] !px-3"
            onClick={closeMarket}
            disabled={!trading}
            aria-label={lastDay ? '마지막 날 장 마감 및 최종 정산' : '장 마감 후 다음 날로 진행'}
          >
            {lastDay ? '최종 정산 ■' : '다음 날 ▸'}
          </Button>
          <Link
            to="/settings"
            className="hidden h-10 w-10 place-items-center rounded-lg border border-[var(--color-line-strong)] text-[var(--color-muted)] hover:text-[var(--color-ink)] sm:grid"
            aria-label="설정"
          >
            ⚙
          </Link>
        </div>
      </div>
    </header>
  );
}

function DayProgress({ day, total }: { day: number; total: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label={`${total}일 중 ${day}일차`} data-testid="day-indicator" data-day={day}>
      <div className="num text-sm font-bold whitespace-nowrap">
        <span className="text-[var(--color-ink)]">{day}</span>일차
        <span className="text-[var(--color-dim)]"> / {total}일</span>
      </div>
      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-panel-3)] sm:block xl:w-40" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={day}>
        <div className="h-full rounded-full bg-[var(--color-ink)] transition-[width] duration-700" style={{ width: `${(day / total) * 100}%` }} />
      </div>
    </div>
  );
}
