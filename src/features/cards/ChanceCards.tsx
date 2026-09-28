import { useState } from 'react';
import { CARD_IDS, cardAvailability, SHIELD_THRESHOLD, UNUSED_CARD_BONUS } from '@/engine/cardEngine';
import { STOCKS } from '@/data/stocks';
import type { CardId } from '@/domain/types';
import { useGameStore } from '@/store/gameStore';

const CARDS: Record<CardId, { icon: string; name: string; desc: string }> = {
  ANALYST: { icon: '📊', name: '애널리스트 리포트', desc: '다가오는 일정 하나의 결과 전망(호재/악재)을 알려준다. 적중률 약 80%.' },
  SHIELD: { icon: '🛡', name: '손실 방어권', desc: `다음 날 한 종목이 ${SHIELD_THRESHOLD * 100}% 넘게 떨어지면 초과 손실을 보험금으로 돌려받는다.` },
  PAPER: { icon: '🗞', name: '내일 신문', desc: '내일 아침 헤드라인을 하루 먼저 읽는다.' },
};

/** Three one-shot chance cards. */
export function ChanceCards() {
  const game = useGameStore((s) => s.game);
  const activate = useGameStore((s) => s.activateCard);
  const [confirm, setConfirm] = useState<CardId | null>(null);
  if (!game) return null;
  const left = CARD_IDS.filter((c) => game.cards[c]?.usedDay === undefined).length;

  return (
    <section className="panel overflow-hidden" aria-label="찬스 카드">
      <div className="flex items-baseline justify-between border-b border-[var(--color-line)] px-4 py-2.5">
        <h2 className="label">찬스 카드 · 각 1회</h2>
        <span className="text-[10px] text-[var(--color-dim)]">남은 카드 1장당 +{UNUSED_CARD_BONUS}점</span>
      </div>
      <ul className="divide-y divide-[var(--color-line)]">
        {CARD_IDS.map((id) => {
          const card = CARDS[id];
          const use = game.cards[id] ?? {};
          const used = use.usedDay !== undefined;
          const avail = cardAvailability(game, id, STOCKS);
          return (
            <li key={id} className={`px-4 py-3 ${used ? 'bg-[var(--color-panel-2)]/40' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg ${used ? 'bg-[var(--color-panel-3)] grayscale' : 'bg-[var(--color-amber-soft)]'}`} aria-hidden="true">
                  {card.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold">{card.name}</div>
                  <p className="text-[11px] leading-snug text-[var(--color-dim)]">{card.desc}</p>
                  <CardResult id={id} />
                </div>
                {!used && (
                  <button
                    type="button"
                    disabled={!avail.ok}
                    title={avail.ok ? undefined : avail.reason}
                    onClick={() => {
                      if (confirm === id) {
                        activate(id);
                        setConfirm(null);
                      } else setConfirm(id);
                    }}
                    onBlur={() => setConfirm((c) => (c === id ? null : c))}
                    className={`h-9 shrink-0 rounded-lg px-3 font-mono text-[11px] font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      confirm === id ? 'bg-[var(--color-amber)] text-[#1b1203]' : 'border border-[var(--color-amber)]/60 text-[var(--color-amber)] hover:bg-[var(--color-amber-soft)]'
                    }`}
                  >
                    {confirm === id ? '정말 사용?' : '사용'}
                  </button>
                )}
              </div>
              {!used && !avail.ok && <p className="mt-1 pl-12 text-[10px] text-[var(--color-dim)]">{avail.reason}</p>}
            </li>
          );
        })}
      </ul>
      {left === 0 && <p className="px-4 pb-3 text-[11px] text-[var(--color-dim)]">모든 카드를 사용했습니다.</p>}
    </section>
  );
}

function CardResult({ id }: { id: CardId }) {
  const game = useGameStore((s) => s.game);
  if (!game) return null;
  const use = game.cards[id];
  if (!use || use.usedDay === undefined) return null;
  if (id === 'ANALYST' && use.analyst) {
    const good = use.analyst.outlook === 1;
    return (
      <p className={`mt-1.5 rounded-md px-2 py-1 text-[12px] font-semibold ${good ? 'bg-[var(--color-up-soft)] text-up' : 'bg-[var(--color-down-soft)] text-down'}`}>
        {use.analyst.eventDay}일차 {use.analyst.label}: {good ? '▲ 긍정적 전망' : '▼ 부정적 전망'}
      </p>
    );
  }
  if (id === 'PAPER' && use.paper) {
    return (
      <div className="mt-1.5 rounded-md border border-dashed border-[var(--color-line-strong)] px-2 py-1.5">
        <div className="font-mono text-[10px] text-[var(--color-dim)]">{use.paper.day}일차 조간 헤드라인</div>
        {use.paper.items.length === 0 ? (
          <p className="text-[12px] text-[var(--color-muted)]">특별한 뉴스가 없는 조용한 하루가 될 것이다.</p>
        ) : (
          use.paper.items.map((it) => (
            <p key={it.title} className="text-[12px] font-semibold leading-snug">
              {it.title}
            </p>
          ))
        )}
      </div>
    );
  }
  if (id === 'SHIELD') {
    const log = game.cardLog.find((l) => l.card === 'SHIELD');
    const pending = use.usedDay === game.day && game.phase !== 'DAY_START' && game.phase !== 'NEWS_EVENT';
    return (
      <p className="mt-1.5 text-[12px] font-semibold text-[var(--color-info)]">
        {pending ? `🛡 발동 대기 — ${game.day + 1}일차 개장에 적용` : log ? `✓ ${log.text}` : `✓ ${(use.usedDay ?? 0) + 1}일차: 보험금 지급 대상 없음`}
      </p>
    );
  }
  return null;
}
