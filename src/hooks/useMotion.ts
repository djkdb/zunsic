import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useMediaQuery } from './useMediaQuery';

/** True when animations should be minimized (settings override the OS preference). */
export function useReducedMotion(): boolean {
  const pref = useGameStore((s) => s.meta.settings.reducedMotion);
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  return pref === 'on' ? true : pref === 'off' ? false : system;
}

/** Timing multiplier for presentation sequences (fast mode / reduced motion). */
export function useTimeScale(): number {
  const fast = useGameStore((s) => s.meta.settings.fastMode);
  const reduced = useReducedMotion();
  return reduced ? 0.35 : fast ? 0.5 : 1;
}

/** Mirror the motion setting on <html> so CSS can react. */
export function useMotionAttribute() {
  const pref = useGameStore((s) => s.meta.settings.reducedMotion);
  useEffect(() => {
    const el = document.documentElement;
    if (pref === 'on') el.dataset.motion = 'off';
    else if (pref === 'off') el.dataset.motion = 'on';
    else delete el.dataset.motion;
  }, [pref]);
}
