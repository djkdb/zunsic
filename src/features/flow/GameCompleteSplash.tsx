import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Modal } from '@/components/ui/Modal';
import { useTimeScale } from '@/hooks/useMotion';
import { useGameStore } from '@/store/gameStore';

export function GameCompleteSplash() {
  const showResult = useGameStore((s) => s.showResult);
  const total = useGameStore((s) => s.game?.totalDays ?? 30);
  const navigate = useNavigate();
  const scale = useTimeScale();
  useEffect(() => {
    const t = setTimeout(() => {
      showResult();
      navigate('/result');
    }, 2400 * scale);
    return () => clearTimeout(t);
  }, [showResult, navigate, scale]);
  const skip = () => {
    showResult();
    navigate('/result');
  };
  return (
    <Modal open labelledBy="complete-title" variant="overlay" className="w-full">
      <button type="button" data-autofocus onClick={skip} className="grid-bg flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center" aria-label="결과 보기">
        <div className="label animate-rise-in">{total}일차 · 폐장 · GAME OVER</div>
        <div id="complete-title" className="animate-stamp rounded-lg border-2 border-[var(--color-amber)] px-6 py-3 font-mono text-4xl font-extrabold tracking-[0.06em] text-[var(--color-amber)] sm:text-6xl">
          게임 종료
        </div>
        <div className="animate-rise-in font-mono text-sm tracking-[0.06em] text-[var(--color-muted)] [animation-delay:600ms]">{total}일 완주</div>
      </button>
    </Modal>
  );
}
