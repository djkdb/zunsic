import { memo, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PricePoint, TradeType } from '@/domain/types';
import { useElementSize } from '@/hooks/useElementSize';
import { formatKRW, formatPct } from '@/lib/format';
import { tickClock } from './chartUtils';

export interface ChartMarker {
  day: number;
  type: TradeType;
  shares: number;
  price: number;
}

interface PriceChartProps {
  points: readonly PricePoint[];
  markers?: readonly ChartMarker[];
  height?: number;
  /** Dashed reference line (e.g. average purchase price). */
  reference?: { value: number; label: string };
  /** A second series drawn as a dashed line on the same scale (e.g. rival). */
  compare?: { values: readonly number[]; label: string };
  valueFormat?: (v: number) => string;
  ariaLabel: string;
  /** Show the H / L annotations. */
  showHighLow?: boolean;
  className?: string;
}

const PAD = { top: 16, right: 64, bottom: 24, left: 8 };

function downsample(points: readonly PricePoint[], max: number): PricePoint[] {
  if (points.length <= max) return [...points];
  const step = points.length / max;
  const out: PricePoint[] = [];
  for (let i = 0; i < max - 1; i++) {
    const p = points[Math.floor(i * step)];
    if (p) out.push(p);
  }
  const last = points[points.length - 1];
  if (last) out.push(last);
  return out;
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export const PriceChart = memo(function PriceChart({
  points,
  markers = [],
  height = 260,
  reference,
  compare,
  valueFormat = formatKRW,
  ariaLabel,
  showHighLow = true,
  className = '',
}: PriceChartProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const gradientId = useId();
  const [cursor, setCursor] = useState<number | null>(null);
  const width = size.width;

  const data = useMemo(() => downsample(points, width < 480 ? 64 : width < 900 ? 120 : 180), [points, width]);

  const geom = useMemo(() => {
    if (data.length < 2 || width <= 0) return null;
    const innerW = Math.max(10, width - PAD.left - PAD.right);
    const innerH = Math.max(10, height - PAD.top - PAD.bottom);
    const values = data.map((p) => p.price);
    if (reference) values.push(reference.value);
    if (compare) values.push(...compare.values.filter((v) => Number.isFinite(v)));
    let min = Math.min(...values);
    let max = Math.max(...values);
    const padV = (max - min || max * 0.02) * 0.1;
    min -= padV;
    max += padV;
    const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;
    const line = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
    const cmp = compare && compare.values.length > 1
      ? compare.values
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${x((i * (data.length - 1)) / (compare.values.length - 1)).toFixed(1)},${y(v).toFixed(1)}`)
          .join(' ')
      : null;
    const area = `${line} L${x(data.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;

    let hi = 0;
    let lo = 0;
    data.forEach((p, i) => {
      if (p.price > (data[hi]?.price ?? -Infinity)) hi = i;
      if (p.price < (data[lo]?.price ?? Infinity)) lo = i;
    });

    // X labels at day boundaries, thinned to fit.
    const dayStarts: number[] = [];
    data.forEach((p, i) => {
      if (i === 0 || data[i - 1]?.day !== p.day) dayStarts.push(i);
    });
    const maxLabels = Math.max(2, Math.floor(innerW / 64));
    const every = Math.ceil(dayStarts.length / maxLabels);
    const xLabels = dayStarts.filter((_, k) => k % every === 0);

    // Markers placed at the last point of their day.
    const lastIndexOfDay = new Map<number, number>();
    data.forEach((p, i) => lastIndexOfDay.set(p.day, i));
    const grouped = new Map<string, { index: number; type: TradeType; shares: number; price: number }>();
    for (const m of markers) {
      const idx = lastIndexOfDay.get(m.day);
      if (idx === undefined) continue;
      const key = `${m.day}-${m.type}`;
      const g = grouped.get(key);
      if (g) g.shares += m.shares;
      else grouped.set(key, { index: idx, type: m.type, shares: m.shares, price: m.price });
    }

    return {
      x,
      y,
      line,
      area,
      innerW,
      innerH,
      hi,
      lo,
      xLabels,
      yTicks: niceTicks(min, max, height < 180 ? 3 : 4),
      markers: [...grouped.values()],
      cmp,
    };
  }, [data, width, height, reference, markers, compare]);

  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const up = last >= first;
  const stroke = up ? 'var(--color-up)' : 'var(--color-down)';

  const handlePointer = (e: PointerEvent<SVGRectElement>) => {
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setCursor(Math.round(Math.min(1, Math.max(0, rel)) * (data.length - 1)));
  };
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const delta = e.key === 'ArrowLeft' ? -1 : 1;
      setCursor((c) => Math.min(data.length - 1, Math.max(0, (c ?? data.length - 1) + delta)));
    } else if (e.key === 'Escape') setCursor(null);
  };

  const cursorPoint = cursor !== null ? data[cursor] : undefined;
  const summary = data.length
    ? `${ariaLabel}. 현재 ${valueFormat(last)}, 기간 변동 ${formatPct(first ? last / first - 1 : 0)}. 좌우 화살표로 탐색.`
    : ariaLabel;

  return (
    <div
      ref={ref}
      className={`relative w-full select-none outline-none ${className}`}
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={summary}
      onKeyDown={handleKey}
      onBlur={() => setCursor(null)}
    >
      {!geom ? (
        <div className="label flex h-full items-center justify-center">차트 데이터 없음</div>
      ) : (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid + y labels */}
          {geom.yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + geom.innerW} y1={geom.y(v)} y2={geom.y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
              <text x={width - PAD.right + 8} y={geom.y(v) + 3} className="fill-[var(--color-dim)] font-mono text-[10px]">
                {valueFormat(v).replace('₩', '')}
              </text>
            </g>
          ))}
          {/* x labels */}
          {geom.xLabels.map((i) => (
            <text key={i} x={geom.x(i)} y={height - 6} textAnchor="middle" className="fill-[var(--color-dim)] font-mono text-[10px]">
              {`${data[i]?.day ?? ''}일`}
            </text>
          ))}

          {reference && (
            <g>
              <line
                x1={PAD.left}
                x2={PAD.left + geom.innerW}
                y1={geom.y(reference.value)}
                y2={geom.y(reference.value)}
                stroke="var(--color-info)"
                strokeOpacity="0.7"
                strokeDasharray="5 4"
              />
              <text x={PAD.left + 4} y={geom.y(reference.value) - 4} className="fill-[var(--color-info)] font-mono text-[10px]">
                {reference.label}
              </text>
            </g>
          )}

          <path d={geom.area} fill={`url(#${gradientId})`} style={{ transition: 'd 500ms ease' }} />
          {geom.cmp && compare && (
            <g>
              <path d={geom.cmp} fill="none" stroke="var(--color-amber)" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x={PAD.left + 4} y={PAD.top + 10} className="fill-[var(--color-amber)] font-mono text-[10px]">
                - - {compare.label}
              </text>
            </g>
          )}
          <path
            d={geom.line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ transition: 'd 500ms ease' }}
          />

          {showHighLow && height >= 180 && (
            <>
              <HiLo x={geom.x(geom.hi)} y={geom.y(data[geom.hi]?.price ?? 0)} label={`고 ${valueFormat(data[geom.hi]?.price ?? 0)}`} above width={width} />
              <HiLo x={geom.x(geom.lo)} y={geom.y(data[geom.lo]?.price ?? 0)} label={`저 ${valueFormat(data[geom.lo]?.price ?? 0)}`} width={width} />
            </>
          )}

          {/* trade markers */}
          {geom.markers.map((m) => {
            const cx = geom.x(m.index);
            const cy = geom.y(data[m.index]?.price ?? m.price);
            const buy = m.type === 'BUY';
            return (
              <g key={`${m.index}-${m.type}`} transform={`translate(${cx},${cy + (buy ? 14 : -14)})`}>
                <path d={buy ? 'M0,-7 L6,4 L-6,4 Z' : 'M0,7 L6,-4 L-6,-4 Z'} fill={buy ? 'var(--color-up)' : 'var(--color-down)'} stroke="var(--color-bg)" strokeWidth="1.5" />
                <text y={buy ? 16 : -10} textAnchor="middle" className="font-mono text-[9px] font-semibold" fill={buy ? 'var(--color-up)' : 'var(--color-down)'}>
                  {buy ? '매수' : '매도'}
                </text>
              </g>
            );
          })}

          {/* last price tag */}
          <g transform={`translate(${width - PAD.right + 2},${geom.y(last)})`}>
            <rect x="0" y="-9" width={PAD.right - 4} height="18" rx="3" fill={stroke} />
            <text x={(PAD.right - 4) / 2} y="4" textAnchor="middle" className="fill-[var(--color-bg)] font-mono text-[10px] font-bold">
              {valueFormat(last).replace('₩', '')}
            </text>
          </g>
          <circle cx={geom.x(data.length - 1)} cy={geom.y(last)} r="3.5" fill={stroke} />

          {/* crosshair */}
          {cursorPoint && cursor !== null && (
            <g pointerEvents="none">
              <line x1={geom.x(cursor)} x2={geom.x(cursor)} y1={PAD.top} y2={PAD.top + geom.innerH} stroke="var(--color-muted)" strokeDasharray="3 3" />
              <circle cx={geom.x(cursor)} cy={geom.y(cursorPoint.price)} r="4.5" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2" />
            </g>
          )}

          <rect
            x={PAD.left}
            y={0}
            width={geom.innerW}
            height={height}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={handlePointer}
            onPointerMove={handlePointer}
            onPointerLeave={() => setCursor(null)}
            onPointerCancel={() => setCursor(null)}
          />
        </svg>
      )}

      {cursorPoint && cursor !== null && geom && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-md border border-[var(--color-line-strong)] bg-[var(--color-panel-2)]/95 px-2.5 py-1.5 shadow-lg"
          style={{
            left: Math.min(Math.max(geom.x(cursor) - 70, 4), Math.max(4, width - PAD.right - 144)),
          }}
        >
          <div className="label !text-[10px]">
            {cursorPoint.day}일차 · {tickClock(cursorPoint.tick)}
          </div>
          <div className="num text-sm font-semibold text-[var(--color-ink)]">{valueFormat(cursorPoint.price)}</div>
          <div className={`num text-[11px] ${cursorPoint.price >= first ? 'text-up' : 'text-down'}`}>
            {cursorPoint.price >= first ? '▲' : '▼'} {formatPct(first ? cursorPoint.price / first - 1 : 0)}
          </div>
        </div>
      )}
    </div>
  );
});

function HiLo({ x, y, label, above, width }: { x: number; y: number; label: string; above?: boolean; width: number }) {
  const anchor = x > width - PAD.right - 60 ? 'end' : x < 60 ? 'start' : 'middle';
  return (
    <g>
      <circle cx={x} cy={y} r="2.5" fill="var(--color-muted)" />
      <text x={x} y={above ? y - 7 : y + 14} textAnchor={anchor} className="fill-[var(--color-muted)] font-mono text-[10px]">
        {label}
      </text>
    </g>
  );
}
