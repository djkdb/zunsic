import { GAME_SUBTITLE, GAME_TITLE } from '@/domain/constants';
import { formatKRW, formatPct } from '@/lib/format';

/** Only aggregate, non-sensitive numbers go on the share card (no trade log). */
export interface ShareCardData {
  finalValue: number;
  returnPct: number;
  trades: number;
  bestTrade: { ticker: string; pnl: number } | null;
  maxDrawdown: number;
  style: string;
  score: number;
  rank: string;
  difficulty: string;
  values: number[];
  /** e.g. "VS 단타왕 김대리 · 승리" */
  rival?: string;
}

const W = 1080;
const H = 1350;

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }
  const mono = '"JetBrains Mono", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", ui-monospace, sans-serif';
  const up = data.returnPct >= 0;
  const accent = up ? '#34c77b' : '#ef5a5a';

  // Background + grid
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(33,40,52,0.6)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const pad = 84;
  ctx.textBaseline = 'alphabetic';
  // Title
  ctx.fillStyle = '#e8eaed';
  ctx.font = `800 76px ${mono}`;
  ctx.fillText('MARKET', pad, 150);
  const mw = ctx.measureText('MARKET').width;
  ctx.fillStyle = '#34c77b';
  ctx.fillText('//', pad + mw, 150);
  ctx.fillStyle = '#e8eaed';
  ctx.fillText('30', pad + mw + ctx.measureText('//').width, 150);
  ctx.fillStyle = '#9aa3b2';
  ctx.font = `600 26px ${mono}`;
  ctx.fillText(GAME_SUBTITLE, pad, 200);

  // Final value
  label(ctx, '최종 자산', pad, 330, mono);
  ctx.fillStyle = '#e8eaed';
  ctx.font = `800 108px ${mono}`;
  ctx.fillText(formatKRW(data.finalValue), pad, 440);

  label(ctx, '수익률', pad, 530, mono);
  ctx.fillStyle = accent;
  ctx.font = `800 132px ${mono}`;
  ctx.fillText(`${up ? '▲' : '▼'} ${formatPct(data.returnPct)}`, pad, 660);

  // Sparkline of portfolio value
  const chartTop = 710;
  const chartH = 180;
  const vals = data.values.filter((v) => Number.isFinite(v));
  if (vals.length > 1) {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const x = (i: number) => pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = (v: number) => chartTop + chartH - ((v - min) / span) * chartH;
    const grad = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH);
    grad.addColorStop(0, up ? 'rgba(52,199,123,0.3)' : 'rgba(239,90,90,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.lineTo(x(vals.length - 1), chartTop + chartH);
    ctx.lineTo(x(0), chartTop + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    vals.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Stats grid
  const stats: [string, string, string?][] = [
    ['거래 횟수', `${data.trades}회`],
    ['최고의 거래', data.bestTrade ? formatKRW(data.bestTrade.pnl, { sign: true }) : '—', data.bestTrade?.ticker],
    ['최대 낙폭', `-${(data.maxDrawdown * 100).toFixed(1)}%`],
    ['점수', `${data.score.toLocaleString('ko-KR')}`, `${data.rank}등급`],
  ];
  const gy = 950;
  const cw = (W - pad * 2) / 2;
  stats.forEach(([l, v, sub], i) => {
    const cx = pad + (i % 2) * cw;
    const cy = gy + Math.floor(i / 2) * 150;
    label(ctx, l, cx, cy, mono);
    ctx.fillStyle = '#e8eaed';
    ctx.font = `700 52px ${mono}`;
    ctx.fillText(v, cx, cy + 62);
    if (sub) {
      ctx.fillStyle = '#9aa3b2';
      ctx.font = `600 24px ${mono}`;
      ctx.fillText(sub, cx, cy + 100);
    }
  });

  // Footer
  ctx.fillStyle = '#f5b83d';
  ctx.font = `800 30px ${mono}`;
  ctx.fillText(`투자 스타일 · ${data.style}${data.rival ? `   ${data.rival}` : ''}`, pad, H - 96);
  ctx.fillStyle = '#626c7d';
  ctx.font = `500 22px ${mono}`;
  ctx.fillText(`난이도 ${data.difficulty} · 100% 가상 머니 게임 · ${GAME_TITLE}`, pad, H - 56);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, mono: string) {
  ctx.fillStyle = '#626c7d';
  ctx.font = `600 26px ${mono}`;
  ctx.fillText(text, x, y);
}

export function shareText(data: ShareCardData): string {
  return [
    `${GAME_TITLE} — 30일 가상 주식 투자 게임`,
    `최종 자산 ${formatKRW(data.finalValue)}`,
    `수익률 ${formatPct(data.returnPct)}`,
    `거래 ${data.trades}회${data.bestTrade ? ` · 최고의 거래 ${formatKRW(data.bestTrade.pnl, { sign: true })}` : ''}`,
    `점수 ${data.score.toLocaleString('ko-KR')} (${data.rank}등급) · ${data.style}`,
    ...(data.rival ? [data.rival] : []),
    '(100% 가상 머니 게임)',
  ].join('\n');
}
