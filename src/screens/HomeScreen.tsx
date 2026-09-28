import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ACHIEVEMENTS } from '@/data/achievements';
import { GAME_SUBTITLE, GAME_TITLE } from '@/domain/constants';
import { TRADING_STYLES, type TradingStyleId } from '@/engine/scoringEngine';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatKRW, formatPct } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getValuation } from '@/store/selectors';

export function HomeScreen() {
  const game = useGameStore((s) => s.game);
  const meta = useGameStore((s) => s.meta);
  const loadNotice = useGameStore((s) => s.loadNotice);
  const clearLoadNotice = useGameStore((s) => s.clearLoadNotice);
  const storageOk = useGameStore((s) => s.storageOk);
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);

  const inProgress = !!game && game.phase !== 'RESULT';
  const finishedGame = game?.phase === 'RESULT';
  const pb = meta.personalBest;
  const unlocked = Object.keys(meta.achievements).length;

  const startNew = () => (inProgress ? setConfirm(true) : navigate('/setup'));

  return (
    <div className="grid-bg min-h-dvh">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-16">
        {loadNotice && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-[var(--color-amber)]/50 bg-[var(--color-amber-soft)] px-4 py-3 text-sm text-[var(--color-amber)]">
            <span aria-hidden="true">⚠</span>
            <span className="flex-1">{loadNotice}</span>
            <button type="button" onClick={clearLoadNotice} aria-label="닫기">
              ✕
            </button>
          </div>
        )}
        {!storageOk && (
          <div role="status" className="rounded-lg border border-[var(--color-line-strong)] px-4 py-3 text-xs text-[var(--color-muted)]">
            브라우저 저장소를 사용할 수 없습니다. 게임은 플레이할 수 있지만 새로고침하면 진행 상황이 사라집니다.
          </div>
        )}

        <header className="text-center">
          <div className="label mb-4 animate-rise-in">A VIRTUAL STOCK MARKET GAME</div>
          <h1 className="animate-rise-in font-mono text-6xl font-extrabold tracking-tighter sm:text-8xl">
            MARKET<span className="text-[var(--color-up)]">//</span>30
          </h1>
          <p className="mt-4 animate-rise-in font-mono text-sm tracking-[0.25em] text-[var(--color-muted)] [animation-delay:120ms] sm:text-base">{GAME_SUBTITLE}</p>
          <div className="mx-auto mt-10 max-w-md animate-rise-in [animation-delay:240ms]">
            <div className="label">STARTING CAPITAL</div>
            <div className="num text-5xl font-extrabold sm:text-6xl">{formatKRW(1_000_000)}</div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-col gap-3 animate-rise-in [animation-delay:360ms]">
          <Button variant="primary" size="lg" className="h-14 text-base" onClick={startNew}>
            ▸ NEW GAME
          </Button>
          <Button variant="outline" size="lg" className="h-14 text-base" disabled={!inProgress} onClick={() => navigate('/play')} aria-describedby="continue-desc">
            CONTINUE
          </Button>
          <p id="continue-desc" className="text-center font-mono text-[11px] text-[var(--color-dim)]">
            {inProgress && game ? `DAY ${game.day}/${game.totalDays} · ${formatKRW(getValuation(game).totalValue)} · ${game.difficulty}` : '진행 중인 게임이 없습니다'}
          </p>
          {finishedGame && (
            <Link to="/result" className="text-center font-mono text-xs text-[var(--color-muted)] underline">
              마지막 결과 다시 보기
            </Link>
          )}
        </div>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Personal best">
          <BestCard label="BEST RETURN" value={pb.bestReturn === null ? '—' : formatPct(pb.bestReturn)} tone={pb.bestReturn ?? 0} />
          <BestCard label="BEST FINAL VALUE" value={pb.bestFinalValue === null ? '—' : formatKRW(pb.bestFinalValue)} />
          <BestCard label="BEST SCORE" value={pb.bestScore === null ? '—' : pb.bestScore.toLocaleString('ko-KR')} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-4" aria-label="Achievements">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label">ACHIEVEMENTS</h2>
              <span className="num text-xs text-[var(--color-muted)]">
                {unlocked}/{ACHIEVEMENTS.length}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACHIEVEMENTS.map((a) => {
                const on = !!meta.achievements[a.id];
                return (
                  <li
                    key={a.id}
                    title={a.description}
                    className={`rounded-lg border px-2.5 py-2 ${on ? 'border-[var(--color-amber)]/50 bg-[var(--color-amber-soft)]' : 'border-[var(--color-line)] opacity-50'}`}
                  >
                    <div className={`font-mono text-[11px] font-bold ${on ? 'text-[var(--color-amber)]' : 'text-[var(--color-dim)]'}`}>
                      <span aria-hidden="true">{on ? a.icon : '🔒'}</span> {a.title}
                      <span className="sr-only">{on ? ' (달성)' : ' (미달성)'}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] leading-snug text-[var(--color-dim)]">{a.description}</div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel p-4" aria-label="Recent runs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label">MY RECENT RUNS</h2>
              <span className="num text-xs text-[var(--color-muted)]">{pb.gamesPlayed} PLAYED</span>
            </div>
            {pb.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-dim)]">아직 완주한 게임이 없습니다. 첫 30일에 도전하세요.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {pb.recent.map((r) => (
                  <li key={r.finishedAt} className="flex items-center justify-between py-2 font-mono text-xs">
                    <span className="text-[var(--color-dim)]">
                      {new Date(r.finishedAt).toLocaleDateString('ko-KR')} · {r.difficulty}
                    </span>
                    <span className="text-[var(--color-muted)]">{TRADING_STYLES[r.style as TradingStyleId]?.label ?? r.style}</span>
                    <span className={r.returnPct >= 0 ? 'text-up' : 'text-down'}>{formatPct(r.returnPct)}</span>
                    <span className="font-bold">
                      {r.rank} · {r.score.toLocaleString('ko-KR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-[var(--color-dim)]">이 기기에 저장된 나의 기록만 표시합니다.</p>
          </section>
        </div>

        <footer className="flex flex-col items-center gap-3 text-center">
          <Link to="/settings" className="font-mono text-xs tracking-wider text-[var(--color-muted)] underline-offset-4 hover:underline">
            ⚙ SETTINGS
          </Link>
          <p className="max-w-xl text-[11px] leading-relaxed text-[var(--color-dim)]">
            {GAME_TITLE}는 완전히 가상의 투자 시뮬레이션 게임입니다. 모든 기업·가격·뉴스·거래는 게임 내부에서 생성된 허구의 데이터이며, 실제 금융 상품이나 투자 조언과 무관합니다. 실제 돈은 사용되지 않습니다.
          </p>
        </footer>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} labelledBy="newgame-title" className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-5">
          <h2 id="newgame-title" className="font-mono text-lg font-bold">
            START A NEW GAME?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            진행 중인 게임(DAY {game?.day}/{game?.totalDays})이 초기화됩니다. 업적과 개인 기록은 유지됩니다.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} data-autofocus>
              CANCEL
            </Button>
            <Button variant="danger" onClick={() => navigate('/setup')}>
              RESET & START
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BestCard({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="panel px-4 py-3 text-center">
      <div className="label">PERSONAL BEST · {label.replace('BEST ', '')}</div>
      <div className={`num mt-1 text-xl font-bold ${tone === undefined ? '' : tone >= 0 ? 'text-up' : 'text-down'}`}>{value}</div>
    </div>
  );
}
