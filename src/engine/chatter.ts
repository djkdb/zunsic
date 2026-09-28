import { RIVAL_MAP } from '@/data/rivals';
import type { GameState, StockDefinition } from '@/domain/types';
import { createRng, mixSeed } from '@/lib/rng';
import { upcomingCalendarEvents } from './calendar';
import { rivalReturn } from './rivalEngine';
import { capitalBase, totalValueAt } from './portfolioEngine';

/**
 * "개미 토론방" — a fictional community reacting to the day's market.
 * Pure flavor: generated deterministically from market data (seed + day), never advice.
 */

export interface ChatMessage {
  id: string;
  nick: string;
  text: string;
  tone: 'up' | 'down' | 'neutral' | 'rival';
}

const NICKS = ['가즈아맨', '물타기장인', '익절요정', '존버왕', '차트도사', '새벽단타', '치킨값벌자', '월급루팡', '관망러', '주린이1호', '불개미', '떡상기원', '손절못해', '뉴스중독', '현금부자', '분산투자러'];

const T = {
  bigUp: ['{t} 가즈아!!! 🚀', '{t} 어제 샀어야 했는데 ㅠㅠ', '{t} 익절 각 잡는 중', '{t} {p} 실화냐', '{t} 들고 있는 사람 부럽다', '{t} 이제 타도 늦었나?', '오늘 치킨은 {t}이 쏜다 🍗'],
  bigDown: ['{t} 물렸다… 존버한다', '{t} 손절할까 말까', '{t} 이 가격이면 줍줍?', '{t} 무슨 일이야 ㄷㄷ', '{t} {p}… 멘탈 나감', '{t} 떨어지는 칼날 잡지 마라', '{t} 바닥인 줄 알았는데 지하실이 있었네'],
  crash: ['계좌가 녹는다 😇', '공포에 사라고 했다… 근데 무섭다', '현금이 왕이다', '오늘은 앱 안 켠다', '이럴 때 사는 게 진짜 고수', '다들 괜찮아…?'],
  rally: ['오늘은 다 오르네 ㅋㅋ', '이 맛에 주식한다', '불장이다 불장 🔥', '아무거나 사도 오르는 날', '익절 버튼 누를까 말까'],
  calm: ['오늘 장 너무 조용하다', '관망도 전략이다', '커피나 마시자 ☕', '폭풍 전의 고요?', '차트만 보다 하루 끝'],
  rumor: ['{t} 소문 들었음? 찌라시 아님?', '찌라시 믿다가 물린 사람 손 🙋', '{t} 루머 뜨자마자 들어가는 사람들 뭐임', '소문에 사서 뉴스에 팔라던데'],
  calendarStock: ['{t} 곧 발표인데 들고 갈 사람?', '{e} 앞두고 다들 긴장 중', '{e} 결과 나오기 전에 비중 줄일까'],
  calendarMarket: ['{e} 앞두고 다들 긴장 중', '{e}… 도박이다 도박', '{e} 결과에 따라 장 분위기 바뀔 듯'],
  bear: ['요즘 빨간불만 본다…', '약세장엔 현금도 종목이다', '반등은 언제 오나'],
  bull: ['요즘 장 좋다 👍', '분위기 탔을 때 수익 챙기자', '강세장엔 다 천재'],
};

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w)\}/g, (_, k: string) => vars[k] ?? '');
}

export function generateChatter(state: GameState, stocks: readonly StockDefinition[], count = 6): ChatMessage[] {
  const rng = createRng(mixSeed(state.seed, 7331, state.day));
  const msgs: ChatMessage[] = [];
  const nicks = rng.shuffle(NICKS);
  let n = 0;
  const push = (text: string, tone: ChatMessage['tone'], nick?: string) => {
    msgs.push({ id: `${state.day}-${msgs.length}`, nick: nick ?? nicks[n++ % nicks.length]!, text, tone });
  };
  const moves = stocks
    .map((s) => ({ s, c: (state.prices[s.id] ?? 0) / (state.prevPrices[s.id] || 1) - 1 }))
    .sort((a, b) => b.c - a.c);
  const pct = (c: number) => `${c >= 0 ? '+' : ''}${(c * 100).toFixed(1)}%`;

  if (state.marketState === 'CRASH') for (let i = 0; i < 2; i++) push(rng.pick(T.crash), 'down');
  if (state.marketState === 'RALLY') for (let i = 0; i < 2; i++) push(rng.pick(T.rally), 'up');

  const top = moves[0];
  const bottom = moves[moves.length - 1];
  if (top && top.c > 0.04) {
    push(fill(rng.pick(T.bigUp), { t: top.s.ticker, p: pct(top.c) }), 'up');
    if (top.c > 0.1) push(fill(rng.pick(T.bigUp), { t: top.s.ticker, p: pct(top.c) }), 'up');
  }
  if (bottom && bottom.c < -0.04) {
    push(fill(rng.pick(T.bigDown), { t: bottom.s.ticker, p: pct(bottom.c) }), 'down');
    if (bottom.c < -0.1) push(fill(rng.pick(T.bigDown), { t: bottom.s.ticker, p: pct(bottom.c) }), 'down');
  }

  const rumor = state.news.find((x) => x.day === state.day && (x.kind === 'RUMOR' || x.kind === 'ANALYST') && x.affected[0]);
  if (rumor) {
    const t = stocks.find((s) => s.id === rumor.affected[0])?.ticker ?? '';
    push(fill(rng.pick(T.rumor), { t }), 'neutral');
  }
  const cal = upcomingCalendarEvents(state, stocks, 2)[0];
  if (cal) {
    const t = stocks.find((s) => s.id === cal.stockIds[0])?.ticker ?? '';
    push(fill(rng.pick(t ? T.calendarStock : T.calendarMarket), { t, e: cal.label }), 'neutral');
  }

  // The rival chimes in.
  const def = RIVAL_MAP.get(state.rival.id);
  if (def && state.day > 1) {
    const mine = totalValueAt(state, state.prices) / capitalBase(state) - 1;
    const theirs = rivalReturn(state.rival, state.day, state.startingCash);
    push(rng.pick(theirs > mine ? def.ahead : def.behind), 'rival', `${def.emoji} ${def.name}`);
  }

  if (state.marketState === 'BEAR') push(rng.pick(T.bear), 'down');
  if (state.marketState === 'BULL') push(rng.pick(T.bull), 'up');
  while (msgs.length < 3) push(rng.pick(T.calm), 'neutral');
  return msgs.slice(0, count);
}
