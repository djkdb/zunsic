import { useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useTimeScale } from '@/hooks/useMotion';
import { useGameStore } from '@/store/gameStore';

export function MarketClosedSplash() {
  const day = useGameStore((s) => s.game?.day ?? 0);
  const showSummary = useGameStore((s) => s.showSummary);
  const scale = useTimeScale();
  useEffect(() => {
    const t = setTimeout(showSummary, 1100 * scale);
    return () => clearTimeout(t);
  }, [showSummary, scale]);
  return (
    <Modal open labelledBy="closed-title" variant="overlay" className="w-full">
      <button type="button" data-autofocus onClick={showSummary} className="flex min-h-dvh w-full flex-col items-center justify-center gap-3" aria-label="건너뛰기">
        <div className="label animate-rise-in">DAY {String(day).padStart(2, '0')}</div>
        <div id="closed-title" className="animate-stamp rounded-lg border-2 border-[var(--color-ink)] px-6 py-3 font-mono text-4xl font-extrabold tracking-[0.15em] sm:text-6xl">
          MARKET CLOSED
        </div>
      </button>
    </Modal>
  );
}
