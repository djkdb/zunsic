import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatKRW } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: '🎯',
    title: '목표',
    body: '30일 동안 가상 자금을 최대한 불리세요. 30일째 장이 끝나면 보유 종목은 자동으로 정산되고 최종 성적이 나옵니다.',
  },
  {
    icon: '📰',
    title: '뉴스를 읽으세요',
    body: '매일 아침 속보가 나오면 관련 종목이 움직입니다. 점선 테두리의 “소문”은 내일의 힌트일 수도, 헛소문일 수도 있습니다.',
  },
  {
    icon: '📅',
    title: '일정을 확인하세요',
    body: '실적 발표·임상 결과·금리 결정은 며칠 전에 미리 공개됩니다. 방향은 모르지만 크게 움직일 날은 알 수 있습니다.',
  },
  {
    icon: '⚖️',
    title: '위험을 관리하세요',
    body: '한 종목에 몰빵하면 크게 벌 수도, 크게 잃을 수도 있습니다. 위험도가 높은 종목일수록 변동이 큽니다.',
  },
  {
    icon: '▸',
    title: '하루를 넘기세요',
    body: '거래를 마쳤다면 “다음 날”을 누르세요. PC에서는 N 키로도 넘길 수 있습니다.',
  },
];

/** First-game guide; reopenable from the "?" button. */
export function HowToPlay() {
  const open = useGameStore((s) => s.helpOpen);
  const setOpen = useGameStore((s) => s.setHelpOpen);
  const seen = useGameStore((s) => s.meta.settings.seenTutorial);
  const phase = useGameStore((s) => s.game?.phase);
  const startingCash = useGameStore((s) => s.game?.startingCash ?? 1_000_000);

  // Show once, the first time the market is open for a new player.
  useEffect(() => {
    if (!seen && phase === 'TRADING') setOpen(true);
  }, [seen, phase, setOpen]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} labelledBy="howto-title" className="w-full max-w-lg">
      <div className="max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-5 sm:p-6">
        <div className="label">게임 방법</div>
        <h2 id="howto-title" className="mt-1 text-xl font-extrabold">
          {formatKRW(startingCash)}으로 30일 버티기
        </h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-panel-3)] text-base" aria-hidden="true">
                {s.icon}
              </span>
              <div>
                <div className="text-sm font-bold">
                  {i + 1}. {s.title}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--color-muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-[var(--color-panel-2)] px-3 py-2 text-[11px] text-[var(--color-dim)]">
          모든 기업·뉴스·가격은 게임 안에서 만들어진 가상 데이터입니다. 실제 투자와 무관합니다.
        </p>
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => setOpen(false)} data-autofocus>
          시작하기 ▸
        </Button>
      </div>
    </Modal>
  );
}
