import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ACHIEVEMENT_MAP } from '@/data/achievements';
import { getStock, STOCKS } from '@/data/stocks';
import type { PricePoint } from '@/domain/types';
import { computeFinalStats, TRADING_STYLES } from '@/engine/scoringEngine';
import { PriceChart } from '@/components/chart/PriceChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { RiskBadge } from '@/components/ui/Badges';
import { RIVAL_MAP } from '@/data/rivals';
import { levelFor } from '@/data/levels';
import { Button } from '@/components/ui/Button';
import { directionSymbol, formatKRW, formatPct, trendClass } from '@/lib/format';
import { DIFFICULTY_LABEL } from '@/lib/labels';
import { useTimeScale } from '@/hooks/useMotion';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { playSfx } from '@/audio/sfx';
import { useGameStore } from '@/store/gameStore';
import { ShareDialog } from '@/features/share/ShareDialog';
import type { ShareCardData } from '@/features/share/shareCard';

/** Stages of the sequential reveal. */
const STAGE_TIMES = [0, 500, 1200, 2600, 3300, 3900, 4500, 5100];

export function ResultScreen() {
  const game = useGameStore((s) => s.game);
  const finished = useGameStore((s) => s.finished);
  const showResult = useGameStore((s) => s.showResult);
  const navigate = useNavigate();
  const scale = useTimeScale();
  const [stage, setStage] = useState(0);
  const [share, setShare] = useState(false);

  // Recover when landing directly (e.g. after a reload) on a completed game.
  useEffect(() => {
    if (game?.phase === 'GAME_COMPLETE') showResult();
  }, [game?.phase, showResult]);

  useEffect(() => {
    const timers = STAGE_TIMES.map((t, i) => setTimeout(() => setStage(i + 1), t * scale));
    return () => timers.forEach(clearTimeout);
  }, [scale]);

  const stats = useMemo(() => {
    if (finished) return finished.stats;
    if (game && (game.phase === 'RESULT' || game.phase === 'GAME_COMPLETE')) return computeFinalStats(game, STOCKS);
    return null;
  }, [finished, game]);

  const xpBefore = finished?.xpBefore ?? 0;
  const xpGained = finished?.xpGained ?? 0;
  const leveledUp = levelFor(xpBefore + xpGained).current.level > levelFor(xpBefore).current.level;
  // Sound track of the reveal: count-up ticks → win/lose sting → record sparkle.
  const outcome = stats ? (stats.returnPct >= 0 ? 'win' : 'lose') : null;
  const isRecord = !!finished && !finished.firstRun && (finished.records.bestReturn || finished.records.bestFinalValue || finished.records.bestScore);
  useEffect(() => {
    if (stage === 3) playSfx('count');
    if (stage === 4 && outcome) playSfx(outcome);
    if (stage === 5 && isRecord) playSfx('record');
    if (stage === 8 && leveledUp) playSfx('levelUp');
  }, [stage, outcome, isRecord, leveledUp]);

  const valuePoints = useMemo<PricePoint[]>(
    () => (game ? game.valueHistory.slice(0, game.day + 1).map((price, day) => ({ day, tick: 12, price })) : []),
    [game],
  );

  if (!game || !stats) return <Navigate to="/" replace />;
  if (game.phase !== 'RESULT' && game.phase !== 'GAME_COMPLETE') return <Navigate to="/play" replace />;

  const records = finished?.records;
  const firstRun = finished?.firstRun ?? false;
  const anyRecord = !firstRun && !!records && (records.bestReturn || records.bestFinalValue || records.bestScore);
  const style = TRADING_STYLES[stats.style.primary];
  const secondary = stats.style.secondary ? TRADING_STYLES[stats.style.secondary] : null;
  const runAchievements = game.runAchievements.map((id) => ACHIEVEMENT_MAP.get(id)).filter((a) => !!a);
  const newIds = new Set(finished?.newAchievements ?? []);

  const shareData: ShareCardData = {
    finalValue: stats.finalValue,
    returnPct: stats.returnPct,
    trades: stats.totalTrades,
    bestTrade: stats.bestTrade && stats.bestTrade.pnl > 0 ? { ticker: stats.bestTrade.ticker, pnl: stats.bestTrade.pnl } : null,
    maxDrawdown: stats.drawdown.maxDrawdown,
    style: style.label,
    score: stats.score.total,
    rank: stats.score.rank,
    difficulty: DIFFICULTY_LABEL[game.difficulty],
    values: valuePoints.map((p) => p.price),
    rival: `VS ${RIVAL_MAP.get(stats.rival.id)?.name ?? ''} · ${stats.rival.won && stats.totalTrades > 0 ? '승리' : '패배'}`,
  };

  const playAgain = () => navigate('/setup');
  const revealAll = () => setStage(STAGE_TIMES.length);

  return (
    <div className="grid-bg min-h-dvh">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:py-12">
        {/* 1. header */}
        <header className="text-center">
          <div className="label animate-rise-in">{game.totalDays}일 완주 · MARKET CLOSED</div>
          <h1 className="mt-2 animate-stamp font-mono text-4xl font-extrabold tracking-[0.06em] sm:text-6xl">장 마감</h1>
          <div className="mt-1 font-mono text-sm tracking-[0.1em] text-[var(--color-muted)]">최종 결과</div>
        </header>

        {/* 2-4. capital → final → return */}
        <section className="panel p-5 text-center sm:p-8" aria-label="최종 결과">
          {stage >= 2 && (
            <div className="animate-rise-in">
              <div className="label">시작 자금</div>
              <div className="num text-xl text-[var(--color-muted)] sm:text-2xl">{formatKRW(stats.startingCapital)}</div>
            </div>
          )}
          {stage >= 3 && (
            <div className="mt-5 animate-rise-in">
              <div className="label">최종 자산</div>
              <FinalValueCounter from={stats.startingCapital} to={stats.finalValue} />
            </div>
          )}
          {stage >= 4 && (
            <div className={`mt-3 animate-stamp font-mono text-[clamp(2rem,10vw,3rem)] font-extrabold whitespace-nowrap ${trendClass(stats.returnPct)}`}>
              {directionSymbol(stats.returnPct)} {formatPct(stats.returnPct)}
              <div className="num mt-1 text-sm font-semibold">{formatKRW(stats.totalPnL, { sign: true })}</div>
            </div>
          )}
          {stage >= 5 && anyRecord && (
            <div className="mt-4 inline-flex animate-stamp items-center gap-2 rounded-md border-2 border-[var(--color-amber)] px-4 py-1.5 font-mono text-lg font-extrabold tracking-[0.06em] text-[var(--color-amber)]">
              ★ 신기록
            </div>
          )}
          {stage >= 5 && firstRun && (
            <div className="mt-4 inline-flex animate-stamp items-center gap-2 rounded-md border border-[var(--color-line-strong)] px-3 py-1 font-mono text-sm font-bold text-[var(--color-muted)]">
              첫 완주 기록 등록
            </div>
          )}
          {stage >= 5 && (
            <div className="mt-4 font-mono text-[12px] text-[var(--color-dim)]">
              시장 지수 <span className={trendClass(stats.indexReturn)}>{formatPct(stats.indexReturn)}</span> ·{' '}
              {stats.returnPct >= stats.indexReturn ? '시장보다 높은 수익을 냈습니다' : '시장 수익률에 못 미쳤습니다'}
            </div>
          )}
        </section>

        {/* 5. stats */}
        {stage >= 6 && (
          <section className="grid animate-rise-in grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4" aria-label="성과 지표">
            <StatCell label="최대 낙폭 (MDD)" value={`-${(stats.drawdown.maxDrawdown * 100).toFixed(2)}%`} tone={-1} sub={stats.drawdown.maxDrawdown > 0 ? `${formatKRW(stats.drawdown.peak)} → ${formatKRW(stats.drawdown.trough)}` : '낙폭 없음'} />
            <StatCell
              label="최고의 거래"
              value={stats.bestTrade ? formatKRW(stats.bestTrade.pnl, { sign: true }) : '—'}
              tone={stats.bestTrade?.pnl}
              sub={stats.bestTrade ? `${getStock(stats.bestTrade.stockId)?.ticker} · ${stats.bestTrade.day}일차` : undefined}
            />
            <StatCell
              label="최악의 거래"
              value={stats.worstTrade ? formatKRW(stats.worstTrade.pnl, { sign: true }) : '—'}
              tone={stats.worstTrade?.pnl}
              sub={stats.worstTrade ? `${getStock(stats.worstTrade.stockId)?.ticker} · ${stats.worstTrade.day}일차` : undefined}
            />
            <StatCell label="승률" value={stats.sellCount ? `${(stats.winRate * 100).toFixed(0)}%` : '—'} sub={`매도 ${stats.sellCount}회 기준`} />
            <StatCell label="총 거래 횟수" value={`${stats.totalTrades}회`} />
            <StatCell label="하루 최대 수익" value={stats.bestDay ? formatKRW(stats.bestDay.change, { sign: true }) : '—'} tone={stats.bestDay?.change} sub={stats.bestDay ? `${stats.bestDay.day}일차 · ${formatPct(stats.bestDay.pct)}` : undefined} />
            <StatCell label="하루 최대 손실" value={stats.worstDay ? formatKRW(stats.worstDay.change, { sign: true }) : '—'} tone={stats.worstDay?.change} sub={stats.worstDay ? `${stats.worstDay.day}일차 · ${formatPct(stats.worstDay.pct)}` : undefined} />
            <StatCell label="포트폴리오 위험도" value={<RiskBadge level={stats.riskLevel} />} sub={`평균 ${stats.avgRiskScore.toFixed(0)}/100`} />
          </section>
        )}

        {stage >= 6 && (
          <section className="panel animate-rise-in p-4" aria-label="포트폴리오 가치 변화">
            <div className="label mb-2">포트폴리오 평가액 · 30일</div>
            <PriceChart
              points={valuePoints}
              height={200}
              ariaLabel="포트폴리오 가치 변화"
              reference={{ value: stats.startingCapital, label: '시작' }}
              compare={{ values: stats.rival.values, label: `라이벌 ${RIVAL_MAP.get(stats.rival.id)?.name ?? ''}` }}
            />
          </section>
        )}

        {/* 6. style + score */}
        {stage >= 7 && (
          <div className="grid animate-rise-in gap-4 sm:grid-cols-2">
            <section className="panel p-5" aria-label="트레이딩 스타일">
              <div className="label">나의 투자 스타일</div>
              <div className="mt-2 font-mono text-2xl font-extrabold text-[var(--color-amber)]">{style.label}</div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{style.description}</p>
              {secondary && <p className="mt-2 font-mono text-[11px] text-[var(--color-dim)]">보조 성향 · {secondary.label}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-1 font-mono text-[10px] text-[var(--color-dim)]">
                <div>평균 보유 {stats.style.metrics.avgHoldingDays.toFixed(1)}일</div>
                <div>고위험 비중 {(stats.style.metrics.highRiskShare * 100).toFixed(0)}%</div>
                <div>평균 보유 종목 {stats.style.metrics.avgDistinct.toFixed(1)}개</div>
                <div>현금 비중 {(stats.style.metrics.cashRatio * 100).toFixed(0)}%</div>
              </dl>
            </section>
            <section className="panel p-5" aria-label="점수">
              <div className="flex items-start justify-between">
                <div>
                  <div className="label">점수</div>
                  <AnimatedNumber value={stats.score.total} format={(v) => Math.round(v).toLocaleString('ko-KR')} className="text-4xl font-extrabold" flash={false} duration={1000} />
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-xl border-2 border-[var(--color-ink)] font-mono text-3xl font-extrabold">{stats.score.rank}</div>
              </div>
              <dl className="mt-3 space-y-1 font-mono text-[11px]">
                <ScoreRow label="수익률" value={stats.score.returnPts} />
                <ScoreRow label="리스크 관리" value={stats.score.riskControl} />
                <ScoreRow label="꾸준함" value={stats.score.consistency} />
                <ScoreRow label="거래 효율" value={stats.score.efficiency} />
                <ScoreRow label="남은 찬스 카드" value={stats.score.cardBonus} />
                <div className="flex justify-between text-[var(--color-dim)]">
                  <dt>난이도 보정 ({DIFFICULTY_LABEL[game.difficulty]})</dt>
                  <dd>×{stats.score.multiplier.toFixed(1)}</dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {stage >= 6 && <RivalDuel stats={stats} />}

        {stage >= 8 && finished && finished.xpGained > 0 && <XpGain before={xpBefore} gained={xpGained} leveledUp={leveledUp} />}

        {stage >= 8 && runAchievements.length > 0 && (
          <section className="panel animate-rise-in p-4" aria-label="이번 게임 업적">
            <div className="label mb-2">이번 게임에서 달성한 업적</div>
            <ul className="flex flex-wrap gap-2">
              {runAchievements.map((a) => (
                <li key={a.id} className="rounded-md border border-[var(--color-amber)]/50 bg-[var(--color-amber-soft)] px-2.5 py-1.5 font-mono text-[11px] font-bold text-[var(--color-amber)]" title={a.description}>
                  {a.icon} {a.title}
                  {newIds.has(a.id) && <span className="ml-1.5 rounded bg-[var(--color-amber)] px-1 text-[9px] text-[#1b1203]">신규</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="sticky bottom-3 z-10 grid grid-cols-3 gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]/90 p-2 backdrop-blur">
          <Button variant="primary" size="lg" onClick={playAgain}>
            다시 하기
          </Button>
          <Button variant="amber" size="lg" onClick={() => setShare(true)}>
            결과 공유
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/')}>
            홈
          </Button>
        </div>
        {stage < STAGE_TIMES.length && (
          <button type="button" onClick={revealAll} className="mx-auto font-mono text-[11px] text-[var(--color-dim)] underline">
            전체 보기
          </button>
        )}
        <p className="text-center text-[11px] text-[var(--color-dim)]">시드 {game.seed} · 같은 시드로 같은 시장을 다시 플레이할 수 있습니다 (게임 설정 › 고급).</p>
      </main>
      <ShareDialog open={share} onClose={() => setShare(false)} data={shareData} />
    </div>
  );
}

/** Counts from the starting capital up (or down) to the final value. */
function FinalValueCounter({ from, to }: { from: number; to: number }) {
  const shown = useDelayedValue(from, to, 150);
  return (
    <>
      <AnimatedNumber value={shown} format={formatKRW} duration={1300} flash={false} className="block text-[clamp(2.25rem,12vw,4.5rem)] font-extrabold tracking-tight" />
      <span className="sr-only" aria-live="polite">
        최종 자산 {formatKRW(to)}, 시작 자산 {formatKRW(from)}
      </span>
    </>
  );
}

function StatCell({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: string; tone?: number }) {
  const color = tone === undefined || tone === 0 ? '' : tone > 0 ? 'text-up' : 'text-down';
  return (
    <div className="bg-[var(--color-panel)] px-3 py-3">
      <div className="label !text-[10px]">{label}</div>
      <div className={`num mt-1 text-base font-bold ${color}`}>{value}</div>
      {sub && <div className="num mt-0.5 text-[10px] text-[var(--color-dim)]">{sub}</div>}
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--color-dim)]">{label}</dt>
      <dd className={value < 0 ? 'text-down' : 'text-[var(--color-muted)]'}>
        {value >= 0 ? '+' : ''}
        {value.toLocaleString('ko-KR')}
      </dd>
    </div>
  );
}

function RivalDuel({ stats }: { stats: ReturnType<typeof computeFinalStats> }) {
  const def = RIVAL_MAP.get(stats.rival.id);
  if (!def) return null;
  const won = stats.rival.won && stats.totalTrades > 0;
  return (
    <section
      className={`panel animate-rise-in p-5 text-center ${won ? 'border-[var(--color-up)]/50' : 'border-[var(--color-down)]/40'}`}
      aria-label="라이벌 대결 결과"
    >
      <div className="label">라이벌 대결</div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="text-2xl" aria-hidden="true">🙂</div>
          <div className="text-sm font-bold">나</div>
          <div className={`num text-lg font-extrabold ${trendClass(stats.returnPct)}`}>{formatPct(stats.returnPct)}</div>
        </div>
        <div className="font-mono text-sm font-extrabold text-[var(--color-dim)]">VS</div>
        <div>
          <div className="text-2xl" aria-hidden="true">{def.emoji}</div>
          <div className="text-sm font-bold">{def.name}</div>
          <div className={`num text-lg font-extrabold ${trendClass(stats.rival.returnPct)}`}>{formatPct(stats.rival.returnPct)}</div>
        </div>
      </div>
      <div className={`mt-3 animate-stamp font-mono text-2xl font-extrabold ${won ? 'text-up' : 'text-down'}`}>{won ? '승리!' : stats.totalTrades === 0 ? '기권' : '패배'}</div>
      <p className="mt-1 text-[12px] text-[var(--color-muted)]">“{won ? def.behind[0] : def.ahead[0]}”</p>
    </section>
  );
}

function XpGain({ before, gained, leveledUp }: { before: number; gained: number; leveledUp: boolean }) {
  const after = levelFor(before + gained);
  return (
    <section className="panel animate-rise-in p-4" aria-label="경험치">
      <div className="flex items-center justify-between">
        <div className="label">경험치</div>
        <span className="num text-sm font-bold text-[var(--color-amber)]">+{gained.toLocaleString('ko-KR')} XP</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">{after.current.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">
            Lv.{after.current.level} {after.current.title}
            {leveledUp && <span className="ml-2 animate-stamp rounded bg-[var(--color-amber)] px-1.5 py-0.5 text-[10px] text-[#1b1203]">LEVEL UP!</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-panel-3)]">
            <div className="h-full rounded-full bg-[var(--color-amber)] transition-[width] duration-1000" style={{ width: `${Math.round(after.progress * 100)}%` }} />
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--color-dim)]">
            {after.next ? `다음 칭호 “${after.next.title}”까지 ${(after.next.xp - before - gained).toLocaleString('ko-KR')} XP` : '최고 칭호 달성!'}
          </div>
        </div>
      </div>
    </section>
  );
}
