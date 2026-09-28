import { memo } from 'react';
import { STOCKS } from '@/data/stocks';
import { generateChatter, type ChatMessage } from '@/engine/chatter';
import { useGameStore } from '@/store/gameStore';
import { isPreReveal } from '@/store/selectors';

const TONE: Record<ChatMessage['tone'], string> = {
  up: 'text-up',
  down: 'text-down',
  neutral: 'text-[var(--color-muted)]',
  rival: 'text-[var(--color-amber)]',
};

/** "개미 토론방" — fictional community reactions (flavor only, not advice). */
export const Chatter = memo(function Chatter({ limit = 6 }: { limit?: number }) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const view = isPreReveal(game) ? { ...game, day: game.day - 1, prices: game.prevPrices } : game;
  const msgs = generateChatter(view, STOCKS, limit);
  return (
    <div>
      <ul className="divide-y divide-[var(--color-line)]" aria-live="off">
        {msgs.map((m) => (
          <li key={m.id} className="flex gap-2.5 px-4 py-2.5">
            <span className={`shrink-0 text-[12px] font-bold ${TONE[m.tone]}`}>{m.nick}</span>
            <span className="min-w-0 text-[13px] text-[var(--color-ink)]">{m.text}</span>
          </li>
        ))}
      </ul>
      <p className="px-4 py-2 text-[10px] text-[var(--color-dim)]">가상 커뮤니티의 반응입니다. 투자 조언이 아닙니다.</p>
    </div>
  );
});
