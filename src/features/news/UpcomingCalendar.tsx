import { useGameStore } from '@/store/gameStore';
import { getUpcomingCalendar } from '@/store/selectors';

/** Publicly scheduled events ahead — date and subject only, never the direction. */
export function UpcomingCalendar({ horizon = 3, compact }: { horizon?: number; compact?: boolean }) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const entries = getUpcomingCalendar(game, horizon);
  const body =
    entries.length === 0 ? (
      <p className="px-4 py-3 text-[12px] text-[var(--color-dim)]">앞으로 {horizon}일간 예정된 주요 일정이 없습니다.</p>
    ) : (
      <ul className="divide-y divide-[var(--color-line)]">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className={`num w-12 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-bold ${
                e.inDays === 1 ? 'bg-[var(--color-amber)] text-[#1b1203]' : 'bg-[var(--color-panel-3)] text-[var(--color-muted)]'
              }`}
            >
              {e.inDays === 1 ? '내일' : `D-${e.inDays}`}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{e.label}</span>
            <span className="shrink-0 font-mono text-[10px] text-[var(--color-dim)]">{e.day}일차</span>
          </li>
        ))}
      </ul>
    );
  if (compact) return body;
  return (
    <section className="panel overflow-hidden" aria-label="다가오는 일정">
      <div className="flex items-baseline justify-between border-b border-[var(--color-line)] px-4 py-2.5">
        <h2 className="label">다가오는 일정</h2>
        <span className="text-[10px] text-[var(--color-dim)]">결과 방향은 발표 전까지 알 수 없음</span>
      </div>
      {body}
    </section>
  );
}
