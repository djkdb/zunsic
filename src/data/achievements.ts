export type AchievementId =
  | 'FIRST_TRADE'
  | 'UP_10'
  | 'DOUBLE'
  | 'DIAMOND_HANDS'
  | 'DAY_TRADER'
  | 'RISK_TAKER'
  | 'SURVIVOR'
  | 'PERFECT_RUN'
  | 'BUY_THE_DIP'
  | 'SNIPER'
  | 'MARKET_BEATER'
  | 'FULL_30';

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'FIRST_TRADE', title: 'FIRST TRADE', description: '첫 거래를 체결했다.', icon: '◆' },
  { id: 'UP_10', title: '10% UP', description: '총자산 +10% 달성.', icon: '▲' },
  { id: 'DOUBLE', title: 'DOUBLE', description: '총자산을 2배로 불렸다.', icon: '✕2' },
  { id: 'DIAMOND_HANDS', title: 'DIAMOND HANDS', description: '한 종목을 10일 이상 계속 보유했다.', icon: '◇' },
  { id: 'DAY_TRADER', title: 'DAY TRADER', description: '한 게임에서 20회 이상 거래했다.', icon: '⇄' },
  { id: 'RISK_TAKER', title: 'RISK TAKER', description: '총자산의 70% 이상을 고위험 종목에 투자했다.', icon: '⚠' },
  { id: 'SURVIVOR', title: 'SURVIVOR', description: '폭락장에서 포지션을 유지하고도 수익으로 마감했다.', icon: '⛨' },
  { id: 'PERFECT_RUN', title: 'PERFECT RUN', description: '손실 거래 없이(3회 이상 매도) 수익으로 클리어했다.', icon: '★' },
  { id: 'BUY_THE_DIP', title: 'BUY THE DIP', description: '폭락한 날 매수했다.', icon: '↘' },
  { id: 'SNIPER', title: 'SNIPER', description: '단일 거래로 ₩100,000 이상 수익을 실현했다.', icon: '⌖' },
  { id: 'MARKET_BEATER', title: 'MARKET BEATER', description: '시장 지수보다 5%p 이상 높은 수익률로 마감했다.', icon: '⇡' },
  { id: 'FULL_30', title: '30 DAYS', description: '30일 게임을 끝까지 완주했다.', icon: '30' },
];

export const ACHIEVEMENT_MAP: ReadonlyMap<string, AchievementDefinition> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
