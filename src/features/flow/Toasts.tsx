import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore, type Toast } from '@/store/gameStore';

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[70] flex flex-col items-center gap-2 px-4 lg:top-auto lg:right-4 lg:bottom-4 lg:left-auto lg:items-end" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>,
    document.body,
  );
}

const STYLE: Record<Toast['kind'], { border: string; label: string; icon: string }> = {
  error: { border: 'var(--color-down)', label: 'text-[var(--color-down)]', icon: '⛔' },
  info: { border: 'var(--color-info)', label: 'text-[var(--color-info)]', icon: 'ℹ' },
  success: { border: 'var(--color-up)', label: 'text-up', icon: '✓' },
  achievement: { border: 'var(--color-amber)', label: 'text-[var(--color-amber)]', icon: '★' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGameStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), toast.kind === 'achievement' ? 5000 : 3800);
    return () => clearTimeout(t);
  }, [toast.id, toast.kind, dismiss]);
  const style = STYLE[toast.kind];
  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm animate-rise-in items-start gap-3 rounded-lg border bg-[var(--color-panel-2)] px-4 py-3 shadow-xl"
      style={{ borderColor: style.border }}
    >
      <span aria-hidden="true" className={style.label}>
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`font-mono text-xs font-bold tracking-wider ${style.label}`}>
          {toast.kind === 'achievement' ? `ACHIEVEMENT UNLOCKED · ${toast.title}` : toast.title}
        </div>
        {toast.message && <div className="mt-0.5 text-[12px] text-[var(--color-muted)]">{toast.message}</div>}
      </div>
      <button type="button" onClick={() => dismiss(toast.id)} className="text-[var(--color-dim)] hover:text-[var(--color-ink)]" aria-label="알림 닫기">
        ✕
      </button>
    </div>
  );
}
