import type { RivalId } from '@/domain/types';

/** Fictional AI rivals. Each trades the same market with a fixed, readable strategy. */
export interface RivalDefinition {
  id: RivalId;
  name: string;
  emoji: string;
  style: string;
  description: string;
  /** Lines when the rival is ahead / behind the player. */
  ahead: string[];
  behind: string[];
}

export const RIVALS: readonly RivalDefinition[] = [
  {
    id: 'INDEX_GRANNY',
    name: '인덱스 할머니',
    emoji: '👵',
    style: '분산 장기 보유',
    description: '첫날 모든 종목을 똑같이 나눠 사고 30일 내내 아무것도 안 한다. 시장 평균을 이기면 당신의 승리.',
    ahead: ['얘야, 자주 사고팔면 수수료만 나간단다', '할머니는 그냥 들고만 있었는데?', '느려도 꾸준한 게 이긴단다'],
    behind: ['요즘 젊은이들 제법이구나', '할머니도 가끔은 질 때가 있지', '그래도 끝까지 가봐야 안단다'],
  },
  {
    id: 'MOMENTUM_KIM',
    name: '단타왕 김대리',
    emoji: '🏃',
    style: '추세 추종 몰빵',
    description: '매일 전날 가장 많이 오른 종목에 전 재산을 옮긴다. 대박 아니면 쪽박.',
    ahead: ['오늘도 제가 이겼네요 😎', '달리는 말에 올라타야죠!', '타이밍이 전부입니다 ㅋㅋ'],
    behind: ['아 이번엔 고점에 물렸네…', '다음 종목이 진짜입니다', '잠깐만요, 곧 역전합니다'],
  },
  {
    id: 'CONTRARIAN_PARK',
    name: '역발상 박사',
    emoji: '🧐',
    style: '낙폭 과대 매수',
    description: '매일 가장 많이 떨어진 종목을 산다. “남들이 공포에 팔 때 산다.”',
    ahead: ['공포는 곧 기회였지요', '군중과 반대로 가면 보입니다', '통계적으로 제가 유리합니다'],
    behind: ['떨어지는 칼날이었군요…', '평균 회귀는 반드시 옵니다', '가설 수정 중입니다'],
  },
  {
    id: 'NEWS_HUNTER',
    name: '뉴스 헌터',
    emoji: '📡',
    style: '뉴스 반응 매매',
    description: '호재가 뜨면 사고 악재가 뜨면 판다. 속보 하나에 인생을 건다.',
    ahead: ['뉴스는 거짓말을 안 하죠', '속보 보자마자 샀습니다', '정보가 곧 돈입니다'],
    behind: ['이미 다 반영된 뉴스였나…', '찌라시에 당했습니다', '다음 속보를 기다린다'],
  },
];

export const RIVAL_MAP: ReadonlyMap<RivalId, RivalDefinition> = new Map(RIVALS.map((r) => [r.id, r]));
