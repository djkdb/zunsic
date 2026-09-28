import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DIFFICULTY_IDS } from '@/data/difficulties';
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
          ◂ BACK
        </button>
        <h1 className="font-mono text-3xl font-extrabold">SETTINGS</h1>

        <Group title="MOTION">
          <Choice<Settings['reducedMotion']>
            label="Reduced motion"
            description="애니메이션을 최소화합니다. SYSTEM은 기기 설정을 따릅니다."
            value={settings.reducedMotion}
            options={[
              ['system', 'SYSTEM'],
              ['on', 'ON'],
              ['off', 'OFF'],
            ]}
            onChange={(v) => update({ reducedMotion: v })}
          />
          <Choice<'on' | 'off'>
            label="Fast transitions"
            description="장 시작/마감 연출을 빠르게 진행합니다."
            value={settings.fastMode ? 'on' : 'off'}
            options={[
              ['off', 'OFF'],
              ['on', 'ON'],
            ]}
            onChange={(v) => update({ fastMode: v === 'on' })}
          />
        </Group>

        <Group title="GAME">
          <Choice
            label="Default difficulty"
            description="새 게임 설정 화면의 기본 난이도."
            value={settings.difficulty}
            options={DIFFICULTY_IDS.map((d) => [d, d] as const)}
            onChange={(v) => update({ difficulty: v })}
          />
          {game && game.phase !== 'RESULT' && (
            <div className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="text-sm font-semibold">Abandon current game</div>
                <div className="text-[12px] text-[var(--color-dim)]">
                  DAY {game.day}/{game.totalDays} · SEED {game.seed}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setAbandon(true)}>
                ABANDON
              </Button>
            </div>
          )}
        </Group>

        <Group title="DATA">
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-semibold text-[var(--color-down)]">RESET ALL DATA</div>
              <div className="text-[12px] text-[var(--color-dim)]">진행 중인 게임, 업적, 개인 기록, 설정을 모두 삭제합니다.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setStep(1)}>
              RESET
            </Button>
          </div>
        </Group>

        <p className="text-[11px] leading-relaxed text-[var(--color-dim)]">
          MARKET//30은 가상 금융 시뮬레이션 게임입니다. 실제 증권 계좌·주문·결제·투자 추천 기능은 없으며, 모든 데이터는 이 브라우저에만 저장됩니다.
        </p>
        <Link to="/" className="font-mono text-xs text-[var(--color-muted)] underline">
          HOME
        </Link>
      </div>

      <Modal open={step > 0} onClose={() => setStep(0)} labelledBy="reset-title" className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--color-down)]/60 bg-[var(--color-panel)] p-5">
          <h2 id="reset-title" className="font-mono text-lg font-bold text-[var(--color-down)]">
            {step === 1 ? 'RESET ALL DATA?' : 'ARE YOU ABSOLUTELY SURE?'}
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {step === 1 ? '모든 게임 데이터가 삭제됩니다.' : '이 작업은 되돌릴 수 없습니다. 업적과 개인 기록도 사라집니다.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setStep(0)} data-autofocus>
              CANCEL
            </Button>
            {step === 1 ? (
              <Button variant="danger" onClick={() => setStep(2)}>
                CONTINUE
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
                DELETE ALL
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={abandon} onClose={() => setAbandon(false)} labelledBy="abandon-title" className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-5">
          <h2 id="abandon-title" className="font-mono text-lg font-bold">
            ABANDON GAME?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">현재 게임 진행이 삭제됩니다. 기록에는 남지 않습니다.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setAbandon(false)} data-autofocus>
              CANCEL
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                abandonGame();
                setAbandon(false);
                navigate('/');
              }}
            >
              ABANDON
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
