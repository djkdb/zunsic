import type { StockDefinition } from '@/domain/types';

/**
 * Fictional companies. None of these represent real businesses.
 *
 * To add a company, append an entry here. The market engine, event scheduler,
 * charts, portfolio and scoring all read from this list — no other change needed.
 * Events find companies through `tags`, so tag new entries thoughtfully.
 */
export const STOCKS: readonly StockDefinition[] = [
  {
    id: 'nova',
    ticker: 'NOVA',
    name: 'NOVA TECH',
    sector: 'AI 소프트웨어',
    tags: ['ai', 'software', 'tech'],
    description:
      '가상의 AI 인프라 소프트웨어 기업. 대규모 언어 모델 플랫폼 "NOVA OS"를 운영하며, 기대감에 따라 주가가 크게 출렁인다.',
    initialPrice: 18200,
    volatility: 0.028,
    baseTrend: 0.0022,
    trendBias: 'GROWTH',
    eventSensitivity: 1.25,
    beta: 1.3,
    riskLevel: 'HIGH',
  },
  {
    id: 'qcor',
    ticker: 'QCOR',
    name: 'QUANTUM CORE',
    sector: '반도체',
    tags: ['semiconductor', 'ai', 'tech', 'hardware'],
    description:
      '가상의 차세대 AI 칩 설계 기업. 공급망과 수요 사이클에 민감하며, 기술 발표 하나로 시장 분위기를 바꾼다.',
    initialPrice: 31800,
    volatility: 0.026,
    baseTrend: 0.0018,
    trendBias: 'GROWTH',
    eventSensitivity: 1.15,
    beta: 1.35,
    riskLevel: 'HIGH',
  },
  {
    id: 'orbt',
    ticker: 'ORBT',
    name: 'ORBIT BIO',
    sector: '바이오',
    tags: ['biotech', 'healthcare'],
    description:
      '가상의 유전자 치료제 개발 바이오텍. 임상 결과 한 번에 주가가 급등하거나 폭락하는 초고위험 종목.',
    initialPrice: 12100,
    volatility: 0.042,
    baseTrend: 0.0008,
    trendBias: 'STABLE',
    eventSensitivity: 1.6,
    beta: 0.7,
    riskLevel: 'EXTREME',
  },
  {
    id: 'mrse',
    ticker: 'MRSE',
    name: 'MARS ENERGY',
    sector: '에너지',
    tags: ['energy', 'commodities'],
    description: '가상의 에너지 개발 기업. 유가와 원자재 뉴스에 반응하며, 경기 방어적 성격도 일부 가진다.',
    initialPrice: 46500,
    volatility: 0.019,
    baseTrend: 0.0006,
    trendBias: 'STABLE',
    eventSensitivity: 0.95,
    beta: 0.85,
    riskLevel: 'MEDIUM',
  },
  {
    id: 'pxlm',
    ticker: 'PXLM',
    name: 'PIXEL MOTORS',
    sector: '모빌리티',
    tags: ['mobility', 'ev', 'tech', 'hardware'],
    description:
      '가상의 전기차·자율주행 스타트업. 신차 공개와 리콜 뉴스에 크게 흔들리며, 성장 기대감이 주가를 지탱한다.',
    initialPrice: 24600,
    volatility: 0.033,
    baseTrend: 0.0015,
    trendBias: 'GROWTH',
    eventSensitivity: 1.3,
    beta: 1.2,
    riskLevel: 'HIGH',
  },
  {
    id: 'aura',
    ticker: 'AURA',
    name: 'AURORA MEDIA',
    sector: '미디어·엔터',
    tags: ['media', 'consumer', 'software'],
    description: '가상의 스트리밍·게임 콘텐츠 기업. 흥행작 여부에 따라 실적이 갈리는 중위험 종목.',
    initialPrice: 15400,
    volatility: 0.022,
    baseTrend: 0.001,
    trendBias: 'STABLE',
    eventSensitivity: 1.0,
    beta: 1.0,
    riskLevel: 'MEDIUM',
  },
  {
    id: 'bstn',
    ticker: 'BSTN',
    name: 'BASTION FINANCIAL',
    sector: '금융',
    tags: ['finance', 'rates'],
    description: '가상의 종합 금융 그룹. 금리 변화에 민감하지만 변동성이 낮아 포트폴리오의 완충 역할을 한다.',
    initialPrice: 38900,
    volatility: 0.012,
    baseTrend: 0.0007,
    trendBias: 'STABLE',
    eventSensitivity: 0.7,
    beta: 0.75,
    riskLevel: 'LOW',
  },
  {
    id: 'grnt',
    ticker: 'GRNT',
    name: 'GRANITE UTILITIES',
    sector: '유틸리티',
    tags: ['utilities', 'energy', 'defensive'],
    description: '가상의 전력·수도 인프라 기업. 성장은 느리지만 폭락장에서도 비교적 잘 버티는 방어주.',
    initialPrice: 27300,
    volatility: 0.009,
    baseTrend: 0.0005,
    trendBias: 'STABLE',
    eventSensitivity: 0.55,
    beta: 0.45,
    riskLevel: 'LOW',
  },
];

const STOCK_MAP: ReadonlyMap<string, StockDefinition> = new Map(STOCKS.map((s) => [s.id, s]));

export function getStock(id: string): StockDefinition | undefined {
  return STOCK_MAP.get(id);
}

export function findStockByTicker(ticker: string): StockDefinition | undefined {
  const upper = ticker.toUpperCase();
  return STOCKS.find((s) => s.ticker === upper || s.id === ticker.toLowerCase());
}

export function stocksWithTags(tags: readonly string[], stocks: readonly StockDefinition[] = STOCKS): StockDefinition[] {
  if (tags.length === 0) return [...stocks];
  return stocks.filter((s) => s.tags.some((t) => tags.includes(t)));
}

export const RISK_WEIGHT: Record<StockDefinition['riskLevel'], number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  EXTREME: 4,
};
