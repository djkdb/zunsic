import { useState, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router';
import { findStockByTicker, getStock } from '@/data/stocks';
import type { TradeType } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatKRW } from '@/lib/format';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useGameStore } from '@/store/gameStore';
import { TopBar } from '@/features/terminal/TopBar';
import { TickerTape } from '@/features/terminal/TickerTape';
import { Watchlist } from '@/features/market/Watchlist';
import { StockDetail } from '@/features/market/StockDetail';
import { MarketIndexCard } from '@/features/market/MarketIndexCard';
import { OrderPanel } from '@/features/trade/OrderPanel';
import { PortfolioSummary } from '@/features/portfolio/PortfolioSummary';
import { Holdings } from '@/features/portfolio/Holdings';
import { BreakingCard, NewsFeed } from '@/features/news/NewsFeed';
import { History } from '@/features/history/History';
import { FlowController } from '@/features/flow/FlowController';
import { OrderExecutedFlash } from '@/features/flow/OrderExecutedFlash';

export function GameScreen() {
  const hasGame = useGameStore((s) => !!s.game);
  const phase = useGameStore((s) => s.game?.phase);
  const desktop = useIsDesktop();
  if (!hasGame) return <Navigate to="/" replace />;
  if (phase === 'RESULT') return <Navigate to="/result" replace />;
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <TickerTape />
      {desktop ? <DesktopTerminal /> : <MobileGame />}
      <FlowController />
      <OrderExecutedFlash />
    </div>
  );
}

// ───────────────────────── Desktop: trading terminal ─────────────────────────

type BottomTab = 'NEWS' | 'HOLDINGS' | 'HISTORY';
const BOTTOM_TAB_LABEL: Record<BottomTab, string> = { HOLDINGS: '보유 종목', NEWS: '뉴스', HISTORY: '거래 내역' };

function DesktopTerminal() {
  const selected = useGameStore((s) => s.selectedStockId);
  const selectStock = useGameStore((s) => s.selectStock);
  const [tab, setTab] = useState<BottomTab>('HOLDINGS');

  return (
    <main className="grid flex-1 grid-cols-[240px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] gap-3 p-3 xl:grid-cols-[280px_minmax(0,1fr)_360px] 2xl:gap-4 2xl:p-4" style={{ height: 'calc(100dvh - 3.5rem - 30px)' }}>
      {/* Left: index + watchlist */}
      <aside className="flex min-h-0 flex-col gap-3" aria-label="시장">
        <MarketIndexCard chartHeight={110} />
        <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="label border-b border-[var(--color-line)] px-3 py-2">관심 종목</div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <Watchlist onSelect={selectStock} />
          </div>
        </div>
      </aside>

      {/* Center: chart + bottom tabs */}
      <section className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin" aria-label="종목 상세">
        <StockDetail stockId={selected} chartHeight={320} />
        <div className="panel min-h-[260px] overflow-hidden">
          <div role="tablist" aria-label="하단 패널" className="flex border-b border-[var(--color-line)]">
            {(['HOLDINGS', 'NEWS', 'HISTORY'] as BottomTab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-10 px-4 font-mono text-xs font-bold tracking-wider ${tab === t ? 'border-b-2 border-[var(--color-ink)] text-[var(--color-ink)]' : 'text-[var(--color-dim)] hover:text-[var(--color-muted)]'}`}
              >
                {BOTTOM_TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'NEWS' && <NewsFeed />}
            {tab === 'HOLDINGS' && <Holdings onSelect={selectStock} />}
            {tab === 'HISTORY' && <History />}
          </div>
        </div>
      </section>

      {/* Right: portfolio + order + breaking */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin" aria-label="포트폴리오 및 주문">
        <PortfolioSummary />
        <OrderPanel stockId={selected} showStockPicker key={selected} />
        <BreakingCard />
      </aside>
    </main>
  );
}

// ───────────────────────── Mobile: tabbed game ─────────────────────────

function MobileGame() {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pt-3 pb-24">
        <Routes>
          <Route index element={<MobileDashboard />} />
          <Route path="market" element={<MobileMarket />} />
          <Route path="stock/:ticker" element={<MobileStock />} />
          <Route path="portfolio" element={<MobilePortfolio />} />
          <Route path="news" element={<Section title="뉴스"><NewsFeed /></Section>} />
          <Route path="history" element={<Section title="거래 내역"><History /></Section>} />
          <Route path="*" element={<Navigate to="/play" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  );
}

function useOpenStock() {
  const navigate = useNavigate();
  const selectStock = useGameStore((s) => s.selectStock);
  return (id: string) => {
    selectStock(id);
    const s = getStock(id);
    if (s) navigate(`/play/stock/${s.ticker}`);
  };
}

function MobileDashboard() {
  const open = useOpenStock();
  return (
    <div className="flex flex-col gap-3">
      <PortfolioSummary hero />
      <BreakingCard />
      <MarketIndexCard chartHeight={110} />
      <Section title="관심 종목">
        <Watchlist onSelect={open} />
      </Section>
      <Section title="보유 종목">
        <Holdings onSelect={open} />
      </Section>
    </div>
  );
}

function MobileMarket() {
  const open = useOpenStock();
  return (
    <div className="flex flex-col gap-3">
      <MarketIndexCard chartHeight={140} />
      <Section title="전체 종목">
        <Watchlist onSelect={open} compact />
      </Section>
    </div>
  );
}

function MobilePortfolio() {
  const open = useOpenStock();
  return (
    <div className="flex flex-col gap-3">
      <PortfolioSummary hero />
      <Section title="보유 종목">
        <Holdings onSelect={open} />
      </Section>
    </div>
  );
}

function MobileStock() {
  const { ticker = '' } = useParams();
  const stock = findStockByTicker(ticker);
  const game = useGameStore((s) => s.game);
  const [sheet, setSheet] = useState<TradeType | null>(null);
  if (!stock) {
    return (
      <div className="panel p-6 text-center">
        <p className="font-mono text-sm text-[var(--color-down)]">오류 · 존재하지 않는 종목 “{ticker}”</p>
        <NavLink to="/play/market" className="mt-3 inline-block text-sm underline">
          종목 목록으로
        </NavLink>
      </div>
    );
  }
  const held = game?.holdings[stock.id]?.shares ?? 0;
  const trading = game?.phase === 'TRADING';
  return (
    <>
      <StockDetail stockId={stock.id} chartHeight={230} />
      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-[var(--color-line)] bg-[var(--color-bg)]/95 px-3 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1 font-mono text-[11px] text-[var(--color-dim)]">
            <div>현금 {formatKRW(game?.cash ?? 0)}</div>
            <div>보유 {held.toLocaleString('ko-KR')}주</div>
          </div>
          <Button variant="buy" size="lg" className="h-12 w-28" onClick={() => setSheet('BUY')} disabled={!trading}>
            ▲ 매수
          </Button>
          <Button variant="sell" size="lg" className="h-12 w-28" onClick={() => setSheet('SELL')} disabled={!trading || held === 0}>
            ▼ 매도
          </Button>
        </div>
      </div>
      <Modal open={sheet !== null} onClose={() => setSheet(null)} labelledBy="order-sheet-title" variant="sheet" className="w-full max-w-md">
        <div className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-[var(--color-line-strong)] bg-[var(--color-bg)] p-2 safe-bottom sm:rounded-2xl">
          <div className="flex items-center justify-between px-2 py-1.5">
            <h2 id="order-sheet-title" className="label">
              주문 · {stock.ticker}
            </h2>
            <button type="button" onClick={() => setSheet(null)} className="h-9 w-9 text-[var(--color-muted)]" aria-label="주문창 닫기">
              ✕
            </button>
          </div>
          {sheet && <OrderPanel stockId={stock.id} initialSide={sheet} onExecuted={() => setSheet(null)} />}
        </div>
      </Modal>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel overflow-hidden" aria-label={title}>
      <h2 className="label border-b border-[var(--color-line)] px-4 py-2.5">{title}</h2>
      {children}
    </section>
  );
}

const NAV = [
  { to: '/play', label: '홈', icon: '⌂', end: true },
  { to: '/play/market', label: '시장', icon: '▤', end: false },
  { to: '/play/portfolio', label: '포트폴리오', icon: '◔', end: false },
  { to: '/play/news', label: '뉴스', icon: '◉', end: false },
  { to: '/play/history', label: '거래내역', icon: '≡', end: false },
];

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-line)] bg-[var(--color-bg)]/95 backdrop-blur safe-bottom" aria-label="게임 메뉴">
      <ul className="mx-auto grid h-[60px] max-w-3xl grid-cols-5">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 font-mono text-[9px] font-bold tracking-wider ${isActive ? 'text-[var(--color-ink)]' : 'text-[var(--color-dim)]'}`
              }
            >
              <span aria-hidden="true" className="text-base leading-none">
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
