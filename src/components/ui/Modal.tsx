import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  /** Full-screen dramatic overlay vs. centered dialog. */
  variant?: 'dialog' | 'overlay' | 'sheet';
}

/** Accessible modal: focus moves in, Tab is trapped, Escape closes (when allowed), focus is restored. */
export function Modal({ open, onClose, labelledBy, children, className = '', variant = 'dialog' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusFirst = () => {
      const target = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
      target?.focus({ preventScroll: true });
    };
    const t = setTimeout(focusFirst, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  const layout =
    variant === 'overlay'
      ? 'items-center justify-center bg-[var(--color-bg)]/92 backdrop-blur-sm'
      : variant === 'sheet'
        ? 'items-end justify-center bg-black/60 sm:items-center'
        : 'items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]';
  return createPortal(
    <div className={`fixed inset-0 z-50 flex animate-fade-in ${layout}`} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={className}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
