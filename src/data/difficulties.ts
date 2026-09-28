import type { DifficultyConfig, DifficultyId } from '@/domain/types';

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  CASUAL: {
    id: 'CASUAL',
    label: '쉬움',
    description: '잔잔한 시장, 더 많은 힌트, 여유 자금. 처음 플레이한다면 추천.',
    startingCash: 1_500_000,
    volatilityMultiplier: 0.8,
    eventSeverityMultiplier: 0.85,
    instability: -0.05,
    hintRate: 0.65,
    scoreMultiplier: 0.8,
  },
  NORMAL: {
    id: 'NORMAL',
    label: '보통',
    description: '₩1,000,000으로 시작하는 표준 시장. 기회와 위험이 균형을 이룬다.',
    startingCash: 1_000_000,
    volatilityMultiplier: 1,
    eventSeverityMultiplier: 1,
    instability: 0,
    hintRate: 0.45,
    scoreMultiplier: 1,
  },
  HARD: {
    id: 'HARD',
    label: '어려움',
    description: '거친 변동성, 강한 충격, 드문 힌트. 살아남는 것 자체가 실력.',
    startingCash: 1_000_000,
    volatilityMultiplier: 1.3,
    eventSeverityMultiplier: 1.2,
    instability: 0.08,
    hintRate: 0.25,
    scoreMultiplier: 1.3,
  },
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'NORMAL';
export const DIFFICULTY_IDS: DifficultyId[] = ['CASUAL', 'NORMAL', 'HARD'];
