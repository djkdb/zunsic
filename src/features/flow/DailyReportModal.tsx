import type { ReactNode } from 'react';
import { getStock } from '@/data/stocks';
import { Button } from '@/components/ui/Button';
import { MarketStateBadge } from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { getUpcomingCalendar } from '@/store/selectors';
import { UpcomingCalendar } from '@/features/news/UpcomingCalendar';

export function DailyReportModal() {
  const game = useGameStore((s) => s.game);
  const next = useGameStore((s) => s.continueFromSummary);
  const skipReport = useGameStore((s) => s.meta.settings.skipReport);
  const updateSettings = useGameStore((s) => s.updateSettings);
  if (!game) return null;
  const upcoming = getUpcomingCalendar(game, 3);
  const report = game.reports.find((r) => r.day === game.day);
  const last = game.day >= game.totalDays;
  const news = game.news.filter((n) => report?.newsIds.includes(n.id));
  const pnl = report ? report.portfolioValue - (game.valueHistory[game.day - 1] ?? game.startingCash) : 0;

  return (
    <Modal open labelledBy="report-title" className="w-full max-w-lg" onClose={next}>
      <div className="max-h-[88dvh] overflow-y-auto rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] scrollbar-thin">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <div className="label">일일 리포트 · DAILY REPORT</div>
            <h2 id="report-title" className="num text-2xl font-extrabold">
              {game.day}일차 결산
            </h2>
          </div>
          {report && <MarketStateBadge state={report.marketState} showMood />}
        </div>

        {!report ? (
          <p className="p-5 text-sm text-[var(--color-dim)]">리포트를 불러올 수 없습니다.</p>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="시장" value={<PriceChange value={report.marketChange} className="text-xl font-bold" />} />
              <Metric label="내 포트폴리오" value={<PriceChange value={report.portfolioChange} className="text-xl font-bold" />} />
            </div>
            {report.tradeCount + Object.keys(game.holdings).length > 0 && (
              <p className="-mt-2 text-center text-[12px] text-[var(--color-muted)]">
                {Math.abs(report.portfolioChange - report.marketChange) < 0.0005
                  ? '오늘은 시장과 비슷하게 움직였습니다.'
                  : report.portfolioChange > report.marketChange
                    ? `시장보다 ${((report.portfolioChange - report.marketChange) * 100).toFixed(2)}%p 앞섰습니다.`
                    : `시장보다 ${((report.marketChange - report.portfolioChange) * 100).toFixed(2)}%p 뒤처졌습니다.`}
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-panel-2)] px-4 py-3">
              <span className="label">포트폴리오 평가액</span>
              <span className="text-right">
                <span className="num block text-lg font-bold">{formatKRW(report.portfolioValue)}</span>
                <span className={`num text-[11px] ${trendClass(pnl)}`}>오늘 {formatKRW(pnl, { sign: true })}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {report.best && (
                <Metric
                  label="최고 상승 종목"
                  value={
                    <span className="font-mono text-sm font-bold">
                      {getStock(report.best.stockId)?.ticker} <PriceChange value={report.best.change} className="text-sm" />
                    </span>
                  }
                />
              )}
              {report.worst && (
                <Metric
                  label="최대 하락 종목"
                  value={
                    <span className="font-mono text-sm font-bold">
                      {getStock(report.worst.stockId)?.ticker} <PriceChange value={report.worst.change} className="text-sm" />
                    </span>
                  }
                />
              )}
            </div>
            <div>
              <div className="label mb-1.5">오늘의 뉴스</div>
              {news.length ? (
                <ul className="space-y-1.5">
                  {news.slice(0, 5).map((n) => (
                    <li key={n.id} className="font-mono text-[12px] leading-snug text-[var(--color-muted)]">
                      <span className={n.kind === 'RUMOR' || n.kind === 'ANALYST' ? 'text-[var(--color-info)]' : 'text-[var(--color-amber)]'}>
                        {n.kind === 'RUMOR' || n.kind === 'ANALYST' ? '◌' : '●'}
                      </span>{' '}
                      {n.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-[var(--color-dim)]">특별한 뉴스 없이 조용한 하루였다.</p>
              )}
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="label">오늘 거래 횟수</span>
              <span className="num font-semibold">{report.tradeCount}회</span>
            </div>
            {!last && upcoming.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-[var(--color-amber)]/30">
                <div className="label bg-[var(--color-amber-soft)] px-4 py-2 !text-[var(--color-amber)]">다가오는 일정 · 방향은 발표 전까지 알 수 없음</div>
                <UpcomingCalendar compact />
              </div>
            )}
          </div>
        )}

        <div className="border-t border-[var(--color-line)] p-4">
          <Button variant={last ? 'amber' : 'primary'} size="lg" className="w-full" onClick={next} data-autofocus>
            {last ? '최종 정산 ▸' : `${game.day + 1}일차 장 시작 ▸`}
          </Button>
          {last ? (
            <p className="mt-2 text-center text-[11px] text-[var(--color-dim)]">모든 보유 종목은 최종 가격으로 자동 정산됩니다.</p>
          ) : (
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-[11px] text-[var(--color-dim)]">
              <input type="checkbox" checked={skipReport} onChange={(e) => updateSettings({ skipReport: e.target.checked })} className="accent-[var(--color-ink)]" />
              다음부터 일일 리포트 건너뛰기 (설정에서 변경 가능)
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] px-3 py-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
