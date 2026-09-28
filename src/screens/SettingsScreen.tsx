import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DIFFICULTY_IDS } from '@/data/difficulties';
import { DIFFICULTY_LABEL } from '@/lib/labels';
import { playSfx } from '@/audio/sfx';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useGameStore } from '@/store/gameStore';
import type { Settings } from '@/persistence/storage';

export function SettingsScreen() {
  const settings = useGameStore((s) => s.meta.settings);
  const update = useGameStore((s) => s.updateSettings);
  const resetEverything = useGameStore((s) => s.resetEverything);
  const abandonGame = useGameStore((s) => s.abandonGame);
  const game = useGameStore((s) => s.game);
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [abandon, setAbandon] = useState(false);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-10">
        <button type="button" onClick={() => navigate(-1)} className="self-start font-mono text-xs text-[var(--color-muted)]">
          ◂ 뒤로
        </button>
        <h1 className="font-mono text-3xl font-extrabold">설정</h1>

        <Group title="사운드">
          <Choice<'on' | 'off'>
            label="효과음"
            description="매수·매도, 속보, 장 시작·마감, 결과 발표 효과음."
            value={settings.sound ? 'on' : 'off'}
            options={[
              ['on', '켜기'],
              ['off', '끄기'],
            ]}
            onChange={(v) => {
              update({ sound: v === 'on' });
              if (v === 'on') setTimeout(() => playSfx('buy'), 30);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <label htmlFor="volume" className="text-sm font-semibold">
              볼륨
            </label>
            <div className="flex items-center gap-3">
              <input
                id="volume"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.volume * 100)}
                disabled={!settings.sound}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
                onPointerUp={() => playSfx('sell')}
                onKeyUp={() => playSfx('tick')}
                className="w-40 accent-[var(--color-ink)] disabled:opacity-40"
              />
              <span className="num w-10 text-right text-xs text-[var(--color-muted)]">{Math.round(settings.volume * 100)}%</span>
            </div>
          </div>
        </Group>

        <Group title="화면 효과">
          <Choice<Settings['reducedMotion']>
            label="애니메이션 줄이기"
            description="움직임을 최소화합니다. '기기 설정'은 휴대폰/PC 설정을 따릅니다."
            value={settings.reducedMotion}
            options={[
              ['system', '기기 설정'],
              ['on', '켜기'],
              ['off', '끄기'],
            ]}
            onChange={(v) => update({ reducedMotion: v })}
          />
          <Choice<'on' | 'off'>
            label="빠른 연출"
            description="장 시작/마감 연출을 빠르게 진행합니다."
            value={settings.fastMode ? 'on' : 'off'}
            options={[
              ['off', '끄기'],
              ['on', '켜기'],
            ]}
            onChange={(v) => update({ fastMode: v === 'on' })}
          />
          <Choice<'on' | 'off'>
            label="일일 리포트 건너뛰기"
            description="장 마감 후 결산 화면 없이 바로 다음 날로 넘어갑니다. (마지막 날은 항상 표시)"
            value={settings.skipReport ? 'on' : 'off'}
            options={[
              ['off', '끄기'],
              ['on', '켜기'],
            ]}
            onChange={(v) => update({ skipReport: v === 'on' })}
          />
        </Group>

        <Group title="게임">
          <Choice
            label="기본 난이도"
            description="새 게임 설정 화면에서 기본으로 선택되는 난이도."
            value={settings.difficulty}
            options={DIFFICULTY_IDS.map((d) => [d, DIFFICULTY_LABEL[d]] as const)}
            onChange={(v) => update({ difficulty: v })}
          />
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-semibold">게임 방법 안내</div>
              <div className="text-[12px] text-[var(--color-dim)]">
                {settings.seenTutorial ? '다음에 장이 열릴 때 게임 방법을 다시 보여줍니다.' : '다음에 장이 열릴 때 표시됩니다.'}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => update({ seenTutorial: false })} disabled={!settings.seenTutorial}>
              다시 보기
            </Button>
          </div>
          {game && game.phase !== 'RESULT' && (
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold">현재 게임 포기</div>
                <div className="text-[12px] text-[var(--color-dim)]">
                  {game.day}/{game.totalDays}일차 · 시드 {game.seed}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setAbandon(true)}>
                포기
              </Button>
            </div>
          )}
        </Group>

        <Group title="데이터">
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--color-down)]">모든 데이터 초기화</div>
              <div className="text-[12px] text-[var(--color-dim)]">진행 중인 게임, 업적, 개인 기록, 설정을 모두 삭제합니다.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setStep(1)}>
              초기화
            </Button>
          </div>
        </Group>

        <p className="text-[11px] leading-relaxed text-[var(--color-dim)]">
          MARKET//30은 가상 금융 시뮬레이션 게임입니다. 실제 증권 계좌·주문·결제·투자 추천 기능은 없으며, 모든 데이터는 이 브라우저에만 저장됩니다.
        </p>
        <Link to="/" className="font-mono text-xs text-[var(--color-muted)] underline">
          홈으로
        </Link>
      </div>

      <Modal open={step > 0} onClose={() => setStep(0)} labelledBy="reset-title" className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--color-down)]/60 bg-[var(--color-panel)] p-5">
          <h2 id="reset-title" className="font-mono text-lg font-bold text-[var(--color-down)]">
            {step === 1 ? '모든 데이터를 초기화할까요?' : '정말로 삭제하시겠습니까?'}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {step === 1 ? '모든 게임 데이터가 삭제됩니다.' : '이 작업은 되돌릴 수 없습니다. 업적과 개인 기록도 사라집니다.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setStep(0)} data-autofocus>
              취소
            </Button>
            {step === 1 ? (
              <Button variant="danger" onClick={() => setStep(2)}>
                계속
              </Button>
            ) : (
              <Button
                variant="sell"
                onClick={() => {
                  resetEverything();
                  setStep(0);
                  navigate('/');
                }}
              >
                전부 삭제
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={abandon} onClose={() => setAbandon(false)} labelledBy="abandon-title" className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-5">
          <h2 id="abandon-title" className="font-mono text-lg font-bold">
            게임을 포기할까요?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">현재 게임 진행이 삭제됩니다. 기록에는 남지 않습니다.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setAbandon(false)} data-autofocus>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                abandonGame();
                setAbandon(false);
                navigate('/');
              }}
            >
              포기하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel px-4 py-1">
      <h2 className="label pt-3">{title}</h2>
      <div className="divide-y divide-[var(--color-line)]">{children}</div>
    </section>
  );
}

function Choice<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[12px] text-[var(--color-dim)]">{description}</div>
      </div>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-[var(--color-panel-2)] p-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`h-8 rounded-md px-3 font-mono text-[11px] font-bold ${value === v ? 'bg-[var(--color-ink)] text-[var(--color-bg)]' : 'text-[var(--color-muted)]'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
