/** Career progression across games (stored locally). XP comes from each run's score. */
export interface LevelDefinition {
  level: number;
  title: string;
  emoji: string;
  xp: number;
}

export const LEVELS: readonly LevelDefinition[] = [
  { level: 1, title: '개미', emoji: '🐜', xp: 0 },
  { level: 2, title: '주린이', emoji: '🐣', xp: 400 },
  { level: 3, title: '개미 투자자', emoji: '📊', xp: 1200 },
  { level: 4, title: '차트 분석가', emoji: '📈', xp: 2500 },
  { level: 5, title: '단타 고수', emoji: '⚡', xp: 4200 },
  { level: 6, title: '슈퍼개미', emoji: '🦸', xp: 6500 },
  { level: 7, title: '큰손', emoji: '💰', xp: 9500 },
  { level: 8, title: '펀드매니저', emoji: '🎩', xp: 13500 },
  { level: 9, title: '전설의 투자자', emoji: '👑', xp: 19000 },
];

export function levelFor(xp: number): { current: LevelDefinition; next?: LevelDefinition; progress: number } {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (xp >= l.xp) current = l;
  const next = LEVELS.find((l) => l.xp > xp);
  const progress = next ? (xp - current.xp) / (next.xp - current.xp) : 1;
  return { current, next, progress };
}

/** XP earned by a finished run. */
export function xpForRun(score: number, wonRival: boolean): number {
  return Math.max(60, Math.round(score / 12)) + (wonRival ? 150 : 0);
}
