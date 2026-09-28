import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DIFFICULTIES, DIFFICULTY_IDS } from '@/data/difficulties';
import type { DifficultyId } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { formatKRW } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';

export function SetupScreen() {
  const defaultDifficulty = useGameStore((s) => s.meta.settings.difficulty);
  const newGame = useGameStore((s) => s.newGame);
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<DifficultyId>(defaultDifficulty);
  const [seedText, setSeedText] = useState('');
  const seed = seedText.trim() ? Number(seedText.trim()) : undefined;
  const seedValid = seed === undefined || (Number.isInteger(seed) && seed > 0 && seed < 2 ** 31);

  const start = () => {
    if (!seedValid) return;
    newGame(difficulty, seed);
    navigate('/play');
  };

  return (
    <div className="grid-bg min-h-dvh">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <Link to="/" className="font-mono text-xs text-[var(--color-muted)]">
          ◂ 뒤로
        </Link>
        <div>
          <div className="label">게임 설정</div>
          <h1 className="font-mono text-3xl font-extrabold">난이도 선택</h1>
        </div>
        <div role="radiogroup" aria-label="난이도" className="grid gap-3 sm:grid-cols-3">
          {DIFFICULTY_IDS.map((id) => {
            const d = DIFFICULTIES[id];
            const on = id === difficulty;
            return (
              <button
                key={id}
                role="radio"
                aria-checked={on}
                onClick={() => setDifficulty(id)}
                className={`rounded-xl border p-4 text-left transition-colors ${on ? 'border-[var(--color-ink)] bg-[var(--color-panel-2)]' : 'border-[var(--color-line)] bg-[var(--color-panel)] hover:border-[var(--color-line-strong)]'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-extrabold">{d.label}</span>
                  {id === 'NORMAL' && <span className="font-mono text-[9px] text-[var(--color-dim)]">기본</span>}
                </div>
                <div className="num mt-1 text-sm text-[var(--color-up)]">{formatKRW(d.startingCash)}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">{d.description}</p>
                <dl className="mt-3 space-y-0.5 font-mono text-[10px] text-[var(--color-dim)]">
                  <div>변동성 ×{d.volatilityMultiplier.toFixed(1)}</div>
                  <div>사건 강도 ×{d.eventSeverityMultiplier.toFixed(2)}</div>
                  <div>힌트 확률 {(d.hintRate * 100).toFixed(0)}%</div>
                  <div>점수 배율 ×{d.scoreMultiplier.toFixed(1)}</div>
                </dl>
              </button>
            );
          })}
        </div>
        <details className="panel p-4">
          <summary className="cursor-pointer font-mono text-xs text-[var(--color-muted)]">고급 · 시장 시드</summary>
          <p className="mt-2 text-[12px] text-[var(--color-dim)]">같은 시드는 같은 시장(가격 흐름·이벤트)을 만듭니다. 비워두면 매번 새로운 시장이 생성됩니다.</p>
          <label className="mt-3 block">
            <span className="sr-only">시드</span>
            <input
              type="text"
              inputMode="numeric"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="랜덤"
              aria-invalid={!seedValid}
              className="num h-10 w-full rounded-md border border-[var(--color-line-strong)] bg-[var(--color-panel-2)] px-3"
            />
          </label>
          {!seedValid && <p className="mt-1 text-[11px] text-[var(--color-down)]">1 ~ 2147483647 사이의 정수를 입력하세요.</p>}
        </details>
        <Button variant="primary" size="lg" className="h-14 text-base" onClick={start} disabled={!seedValid}>
          ▸ 게임 시작 · {DIFFICULTIES[difficulty].label}
        </Button>
      </div>
    </div>
  );
}
