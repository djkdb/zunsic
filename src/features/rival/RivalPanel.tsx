import { RIVAL_MAP } from '@/data/rivals';
import { rivalReturn } from '@/engine/rivalEngine';
import { formatPct, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getValuation, isPreReveal } from '@/store/selectors';

/** "You vs rival" race card. */
export function RivalPanel() {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const def = RIVAL_MAP.get(game.rival.id);
  if (!def) return null;
  const day = isPreReveal(game) ? game.day - 1 : game.day;
  const mine = getValuation(game).returnPct;
  const theirs = rivalReturn(game.rival, day, game.startingCash);
  const gap = mine - theirs;
  const leading = gap >= 0;
  const tied = Math.abs(gap) < 0.0005;
  const total = Math.max(Math.abs(mine), Math.abs(theirs), 0.02);
  const action = game.rival.lastActionDay !== undefined && game.rival.lastActionDay <= day ? game.rival.lastAction : undefined;

  return (
    <section className="panel overflow-hidden" aria-label="라이벌 대결">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2">
        <h2 className="label">라이벌 대결</h2>
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${tied ? 'bg-[var(--color-panel-3)] text-[var(--color-muted)]' : leading ? 'bg-[var(--color-up-soft)] text-up' : 'bg-[var(--color-down-soft)] text-down'}`}>
          {tied ? '동률' : leading ? `▲ ${(gap * 100).toFixed(1)}%p 앞섬` : `▼ ${(-gap * 100).toFixed(1)}%p 뒤짐`}
        </span>
      </div>
      <div className="space-y-2 px-4 py-3">
        <Bar label="나" value={mine} total={total} highlight />
        <Bar label={`${def.emoji} ${def.name}`} value={theirs} total={total} />
        <p className="truncate text-[11px] text-[var(--color-dim)]" title={def.description}>
          {def.style}
          {action ? ` · 최근: ${action}` : ''}
        </p>
      </div>
    </section>
  );
}

function Bar({ label, value, total, highlight }: { label: string; value: number; total: number; highlight?: boolean }) {
  const width = Math.min(100, (Math.abs(value) / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className={highlight ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}>{label}</span>
        <span className={`num font-semibold ${trendClass(value)}`}>{formatPct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-panel-3)]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(2, width)}%`, background: value >= 0 ? 'var(--color-up)' : 'var(--color-down)', opacity: highlight ? 1 : 0.55 }}
        />
      </div>
    </div>
  );
}
