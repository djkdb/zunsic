import { memo, useMemo } from 'react';

interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
}

export const Sparkline = memo(function Sparkline({ values, width = 64, height = 24 }: SparklineProps) {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
      .join(' ');
  }, [values, width, height]);
  const up = (values[values.length - 1] ?? 0) >= (values[0] ?? 0);
  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      <path d={path} fill="none" stroke={up ? 'var(--color-up)' : 'var(--color-down)'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
});
