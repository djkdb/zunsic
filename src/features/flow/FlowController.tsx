import { useGameStore } from '@/store/gameStore';
import { BreakingNewsOverlay } from './BreakingNewsOverlay';
import { DailyReportModal } from './DailyReportModal';
import { DayStartSplash } from './DayStartSplash';
import { GameCompleteSplash } from './GameCompleteSplash';
import { MarketClosedSplash } from './MarketClosedSplash';

/** Renders the presentation layer for the current phase of the game state machine. */
export function FlowController() {
  const phase = useGameStore((s) => s.game?.phase);
  const day = useGameStore((s) => s.game?.day);
  switch (phase) {
    case 'DAY_START':
      return <DayStartSplash key={`start-${day}`} />;
    case 'NEWS_EVENT':
      return <BreakingNewsOverlay key={`news-${day}`} />;
    case 'MARKET_CLOSED':
      return <MarketClosedSplash key={`closed-${day}`} />;
    case 'DAY_SUMMARY':
      return <DailyReportModal key={`summary-${day}`} />;
    case 'GAME_COMPLETE':
      return <GameCompleteSplash />;
    default:
      return null;
  }
}
