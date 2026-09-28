import { useEffect, useState } from 'react';

/** Starts at `initial`, switches to `target` after `delay` ms (drives count-up on mount). */
export function useDelayedValue(initial: number, target: number, delay: number): number {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => setValue(target), delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return value;
}
