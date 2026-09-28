import { memo, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useMotion';

interface AnimatedNumberProps {
  value: number;
  format: (v: number) => string;
  className?: string;
  /** Count-up duration in ms. 0 disables the count-up (flash only). */
  duration?: number;
  flash?: boolean;
  testId?: string;
}

/**
 * Number that counts from its previous value to the new one and flashes green/red.
 * Updates the DOM directly inside requestAnimationFrame — no React re-render per frame.
 */
export const AnimatedNumber = memo(function AnimatedNumber({
  value,
  format,
  className = '',
  duration = 700,
  flash = true,
  testId,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduced = useReducedMotion();
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    const from = prev.current;
    prev.current = value;
    if (!el) return;
    if (from === value) {
      el.textContent = formatRef.current(value);
      return;
    }
    if (flash) {
      el.classList.remove('animate-flash-up', 'animate-flash-down');
      void el.offsetWidth; // restart animation
      el.classList.add(value > from ? 'animate-flash-up' : 'animate-flash-down');
    }
    if (reduced || duration <= 0) {
      el.textContent = formatRef.current(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = formatRef.current(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = formatRef.current(value);
    };
  }, [value, duration, flash, reduced]);

  return (
    <span ref={ref} className={`num rounded-sm ${className}`} data-testid={testId} data-value={value}>
      {format(value)}
    </span>
  );
});
