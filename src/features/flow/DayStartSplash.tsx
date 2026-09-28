import { useEffect } from 'react';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { GAME_TITLE } from '@/domain/constants';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Modal } from '@/components/ui/Modal';
import { formatKRW } from '@/lib/format';
import { useTimeScale } from '@/hooks/useMotion';
import { useGameStore } from '@/store/gameStore';

export function DayStartSplash() {
  const game = useGameStore((s) => s.game);
  const openMarket = useGameStore((s) => s.openMarket);
  const scale = useTimeScale();
  const day = game?.day ?? 0;
  const first = day === 1;

  useEffect(() => {
    const t = setTimeout(openMarket, (first ? 3000 : 1500) * scale);
    return () => clearTimeout(t);
  }, [day, first, scale, openMarket]);

  if (!game) return null;
  return (
    <Modal open labelledBy="day-start-title" variant="overlay" className="w-full" onClose={openMarket}>
      <button type="button" data-autofocus onClick={openMarket} className="grid-bg flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-6 text-center" aria-label="건너뛰기">
        {first ? (
          <>
            <div className="animate-rise-in font-mono text-sm font-bold tracking-[0.3em] text-[var(--color-muted)]">{GAME_TITLE}</div>
            <div className="label animate-rise-in [animation-delay:200ms]">STARTING CAPITAL</div>
            <FirstCapital value={game.startingCash} />
            <div id="day-start-title" className="animate-rise-in font-mono text-lg font-bold tracking-[0.25em] text-[var(--color-up)] [animation-delay:1400ms]">
              DAY 01 · MARKET OPEN
            </div>
          </>
        ) : (
          <>
            <div className="label animate-rise-in">MARKET OPEN</div>
            <div id="day-start-title" className="num animate-rise-in text-7xl font-extrabold tracking-tighter sm:text-8xl [animation-delay:120ms]">
              DAY {String(day).padStart(2, '0')}
            </div>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--color-panel-3)]">
              <div className="h-full bg-[var(--color-ink)]" style={{ width: `${(day / game.totalDays) * 100}%` }} />
            </div>
            <div className="font-mono text-xs tracking-[0.2em] text-[var(--color-dim)]">{game.totalDays - day} DAYS LEFT</div>
          </>
        )}
        <span className="mt-6 font-mono text-[10px] tracking-widest text-[var(--color-dim)]">TAP TO SKIP</span>
      </button>
    </Modal>
  );
}

function FirstCapital({ value }: { value: number }) {
  const shown = useDelayedValue(0, value, 350);
  return <AnimatedNumber value={shown} format={formatKRW} duration={1100} flash={false} className="text-5xl font-extrabold tracking-tight sm:text-7xl" />;
}
