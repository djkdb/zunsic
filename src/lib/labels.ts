import type { DifficultyId, MarketStateId, NewsKind, RiskLevel, Severity, TradeType, TrendBias } from '@/domain/types';

/** Korean display labels for domain enums. Ids stay in English; only the UI text changes. */

export const RISK_LABEL: Record<RiskLevel | 'NONE', string> = {
  NONE: '보유 없음',
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  EXTREME: '매우 높음',
};

export const MARKET_STATE_LABEL: Record<MarketStateId, string> = {
  BULL: '강세장',
  NEUTRAL: '보합',
  BEAR: '약세장',
  VOLATILE: '변동성 확대',
  CRASH: '폭락장',
  RALLY: '급등장',
};

export const MARKET_MOOD_LABEL: Record<MarketStateId, string> = {
  BULL: '강세',
  NEUTRAL: '중립',
  BEAR: '약세',
  VOLATILE: '불안',
  CRASH: '패닉',
  RALLY: '과열',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  MINOR: '경미',
  MODERATE: '보통',
  MAJOR: '중대',
  EXTREME: '초대형',
};

export const NEWS_KIND_LABEL: Record<NewsKind, string> = {
  BREAKING: '속보',
  MARKET: '시장',
  NEWS: '뉴스',
  RUMOR: '루머',
  ANALYST: '애널리스트',
};

export const SIDE_LABEL: Record<TradeType, string> = { BUY: '매수', SELL: '매도' };

export const DIFFICULTY_LABEL: Record<DifficultyId, string> = { CASUAL: '쉬움', NORMAL: '보통', HARD: '어려움' };

export const TREND_LABEL: Record<TrendBias, string> = {
  DECLINE: '하락세',
  STABLE: '안정',
  GROWTH: '성장',
  HYPER_GROWTH: '고성장',
};
