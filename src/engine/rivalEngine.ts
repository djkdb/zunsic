import type { GameState, RivalId, RivalState, StockDefinition } from '@/domain/types';

/**
 * Rival engine — a fictional AI trader playing the same market with a fixed strategy.
 * It trades at the same daily prices as the player and never sees the future.
 * Fully deterministic (depends only on market data), so a seed replays the same rival.
 */

export function createRival(id: RivalId, startingCash: number): RivalState {
  return { id, cash: startingCash, holdings: {}, valueHistory: [startingCash] };
}

export function rivalValue(rival: Pick<RivalState, 'cash' | 'holdings'>, prices: Record<string, number>): number {
  let v = rival.cash;
  for (const [id, shares] of Object.entries(rival.holdings)) v += shares * (prices[id] ?? 0);
  return v;
}

type Market = Pick<GameState, 'day' | 'prices' | 'prevPrices' | 'news'>;

function sellAll(r: RivalState, prices: Record<string, number>): RivalState {
  return { ...r, cash: rivalValue(r, prices), holdings: {} };
}

function buy(r: RivalState, stockId: string, budget: number, prices: Record<string, number>): { rival: RivalState; shares: number } {
  const price = prices[stockId] ?? 0;
  const shares = price > 0 ? Math.floor(Math.min(budget, r.cash) / price) : 0;
  if (shares <= 0) return { rival: r, shares: 0 };
  return {
    rival: { ...r, cash: r.cash - shares * price, holdings: { ...r.holdings, [stockId]: (r.holdings[stockId] ?? 0) + shares } },
    shares,
  };
}

function ranked(market: Market, stocks: readonly StockDefinition[]) {
  return stocks
    .map((s) => ({ s, change: (market.prices[s.id] ?? 0) / (market.prevPrices[s.id] || 1) - 1 }))
    .sort((a, b) => b.change - a.change);
}

/** Let the rival act on today's prices, then record its value. */
export function stepRival(rival: RivalState, market: Market, stocks: readonly StockDefinition[]): RivalState {
  const { prices, day } = market;
  let r = rival;
  let action: string | undefined;

  switch (rival.id) {
    case 'INDEX_GRANNY': {
      if (day === 1 && Object.keys(r.holdings).length === 0) {
        const budget = r.cash / stocks.length;
        for (const s of stocks) r = buy(r, s.id, budget, prices).rival;
        action = '전 종목 균등 매수';
      }
      break;
    }
    case 'MOMENTUM_KIM': {
      const top = ranked(market, stocks)[0];
      if (top && !(Object.keys(r.holdings).length === 1 && r.holdings[top.s.id])) {
        r = sellAll(r, prices);
        const res = buy(r, top.s.id, r.cash, prices);
        r = res.rival;
        action = `${top.s.ticker} ${res.shares.toLocaleString('ko-KR')}주 몰빵`;
      }
      break;
    }
    case 'CONTRARIAN_PARK': {
      const list = ranked(market, stocks);
      const worst = list[list.length - 1];
      if (worst && worst.change < -0.01 && !r.holdings[worst.s.id]) {
        r = sellAll(r, prices);
        const res = buy(r, worst.s.id, r.cash * 0.7, prices);
        r = res.rival;
        action = `${worst.s.ticker} 저가 매수 (${(worst.change * 100).toFixed(1)}%)`;
      }
      break;
    }
    case 'NEWS_HUNTER': {
      const todays = market.news.filter((n) => n.day === day && n.direction && n.eventUid && n.kind !== 'RUMOR' && n.kind !== 'ANALYST');
      const bad = new Set(todays.filter((n) => n.direction === -1).flatMap((n) => n.affected));
      const good = todays.filter((n) => n.direction === 1).flatMap((n) => n.affected.slice(0, 2));
      const sold: string[] = [];
      for (const id of Object.keys(r.holdings)) {
        if (bad.has(id)) {
          r = { ...r, cash: r.cash + (r.holdings[id] ?? 0) * (prices[id] ?? 0), holdings: Object.fromEntries(Object.entries(r.holdings).filter(([k]) => k !== id)) };
          sold.push(stocks.find((s) => s.id === id)?.ticker ?? id);
        }
      }
      const bought: string[] = [];
      for (const id of [...new Set(good)]) {
        if (r.holdings[id]) continue;
        const res = buy(r, id, rivalValue(r, prices) * 0.35, prices);
        r = res.rival;
        if (res.shares) bought.push(stocks.find((s) => s.id === id)?.ticker ?? id);
      }
      if (sold.length || bought.length) {
        action = [bought.length ? `${bought.join('·')} 매수` : '', sold.length ? `${sold.join('·')} 매도` : ''].filter(Boolean).join(', ');
      }
      break;
    }
  }

  const valueHistory = [...r.valueHistory];
  valueHistory[day] = rivalValue(r, prices);
  return { ...r, valueHistory, ...(action ? { lastAction: action, lastActionDay: day } : {}) };
}

export function rivalReturn(rival: RivalState, day: number, startingCash: number): number {
  const v = rival.valueHistory[day] ?? rival.valueHistory[rival.valueHistory.length - 1] ?? startingCash;
  return startingCash > 0 ? v / startingCash - 1 : 0;
}
