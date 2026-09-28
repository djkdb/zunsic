import type { ReactNode } from 'react';
import { getStock } from '@/data/stocks';
import { Button } from '@/components/ui/Button';
import { MarketStateBadge } from '@/components/ui/Badges';
import { Modal } from '@/components/ui/Modal';
import { PriceChange } from '@/components/ui/PriceChange';
import { formatKRW, trendClass } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';

export function DailyReportModal() {
  const game = useGameStore((s) => s.game);
  const next = useGameStore((s) => s.continueFromSummary);
  if (!game) return null;
  const report = game.reports.find((r) => r.day === game.day);
  const last = game.day >= game.totalDays;
  const news = game.news.filter((n) => report?.newsIds.includes(n.id));
  const pnl = report ? report.portfolioValue - (game.valueHistory[game.day - 1] ?? game.startingCash) : 0;

  return (
    <Modal open labelledBy="report-title" className="w-full max-w-lg" onClose={next}>
      <div className="max-h-[88dvh] overflow-y-auto rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] scrollbar-thin">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <div className="label">DAILY REPORT</div>
            <h2 id="report-title" className="num text-2xl font-extrabold">
              DAY {String(game.day).padStart(2, '0')} SUMMARY
            </h2>
          </div>
          {report && <MarketStateBadge state={report.marketState} showMood />}
        </div>

        {!report ? (
          <p className="p-5 text-sm text-[var(--color-dim)]">리포트를 불러올 수 없습니다.</p>
        ) : (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="MARKET" value={<PriceChange value={report.marketChange} className="text-xl font-bold" />} />
              <Metric label="YOUR PORTFOLIO" value={<PriceChange value={report.portfolioChange} className="text-xl font-bold" />} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--color-panel-2)] px-4 py-3">
              <span className="label">PORTFOLIO VALUE</span>
              <span className="text-right">
                <span className="num block text-lg font-bold">{formatKRW(report.portfolioValue)}</span>
                <span className={`num text-[11px] ${trendClass(pnl)}`}>{formatKRW(pnl, { sign: true })} today</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {report.best && (
                <Metric
                  label="BEST PERFORMER"
                  value={
                    <span className="font-mono text-sm font-bold">
                      {getStock(report.best.stockId)?.ticker} <PriceChange value={report.best.change} className="text-sm" />
                    </span>
                  }
                />
              )}
              {report.worst && (
                <Metric
                  label="WORST PERFORMER"
                  value={
                    <span className="font-mono text-sm font-bold">
                      {getStock(report.worst.stockId)?.ticker} <PriceChange value={report.worst.change} className="text-sm" />
                    </span>
                  }
                />
              )}
            </div>
            <div>
              <div className="label mb-1.5">TODAY&apos;S NEWS</div>
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
              <span className="label">TRADES TODAY</span>
              <span className="num font-semibold">{report.tradeCount}</span>
            </div>
          </div>
        )}

        <div className="border-t border-[var(--color-line)] p-4">
          <Button variant={last ? 'amber' : 'primary'} size="lg" className="w-full" onClick={next} data-autofocus>
            {last ? 'FINAL SETTLEMENT ▸' : `DAY ${String(game.day + 1).padStart(2, '0')} ▸ MARKET OPEN`}
          </Button>
          {last && <p className="mt-2 text-center text-[11px] text-[var(--color-dim)]">모든 보유 종목은 최종 가격으로 자동 정산됩니다.</p>}
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
