import type { GameState, Holding, Result, StockDefinition, TradeError, TradeType, Transaction } from '@/domain/types';
import { averageIn } from './portfolioEngine';

/**
 * Trading engine — order validation and execution. Pure: returns a new GameState.
 * Every order goes through `validateOrder`, so the UI can preview with the exact same rules.
 */

export interface OrderRequest {
  type: TradeType;
  stockId: string;
  shares: number;
}

export interface OrderPreview {
  type: TradeType;
  stock: StockDefinition;
  shares: number;
  price: number;
  total: number;
  cashAfter: number;
  sharesAfter: number;
  /** BUY: new average price. SELL: unchanged avg. */
  avgPriceAfter: number;
  /** SELL only. */
  expectedPnL?: number;
  maxShares: number;
}

const err = (code: TradeError['code'], message: string): { ok: false; error: TradeError } => ({
  ok: false,
  error: { code, message },
});

export function maxBuyable(cash: number, price: number): number {
  if (price <= 0) return 0;
  return Math.max(0, Math.floor(cash / price));
}

export function validateOrder(
  state: GameState,
  order: OrderRequest,
  stocks: readonly StockDefinition[],
): Result<OrderPreview, TradeError> {
  if (state.phase === 'GAME_COMPLETE' || state.phase === 'RESULT' || state.day > state.totalDays) {
    return err('GAME_OVER', '게임이 종료되어 더 이상 거래할 수 없습니다.');
  }
  if (state.phase !== 'TRADING') return err('MARKET_CLOSED', '지금은 거래 시간이 아닙니다.');

  const stock = stocks.find((s) => s.id === order.stockId);
  if (!stock) return err('UNKNOWN_STOCK', `존재하지 않는 종목입니다: ${String(order.stockId)}`);

  const price = state.prices[stock.id];
  if (price === undefined || !Number.isFinite(price) || price <= 0) {
    return err('UNKNOWN_STOCK', `${stock.ticker}의 가격 정보가 없습니다.`);
  }

  const shares = order.shares;
  if (!Number.isFinite(shares) || !Number.isInteger(shares)) {
    return err('INVALID_QUANTITY', '수량은 정수로 입력해야 합니다.');
  }
  if (shares <= 0) return err('INVALID_QUANTITY', '1주 이상 입력해야 합니다.');

  const holding = state.holdings[stock.id];
  const held = holding?.shares ?? 0;
  const total = shares * price;

  if (order.type === 'BUY') {
    const max = maxBuyable(state.cash, price);
    if (total > state.cash) {
      return err('INSUFFICIENT_CASH', `현금이 부족합니다. 최대 ${max.toLocaleString('ko-KR')}주까지 매수 가능.`);
    }
    return {
      ok: true,
      value: {
        type: 'BUY',
        stock,
        shares,
        price,
        total,
        cashAfter: state.cash - total,
        sharesAfter: held + shares,
        avgPriceAfter: averageIn(holding, shares, price),
        maxShares: max,
      },
    };
  }

  if (shares > held) {
    return err('INSUFFICIENT_SHARES', `보유 수량(${held.toLocaleString('ko-KR')}주)보다 많이 매도할 수 없습니다.`);
  }
  const avg = holding?.avgPrice ?? 0;
  return {
    ok: true,
    value: {
      type: 'SELL',
      stock,
      shares,
      price,
      total,
      cashAfter: state.cash + total,
      sharesAfter: held - shares,
      avgPriceAfter: avg,
      expectedPnL: (price - avg) * shares,
      maxShares: held,
    },
  };
}

export interface ExecutionResult {
  state: GameState;
  transaction: Transaction;
}

export function executeOrder(
  state: GameState,
  order: OrderRequest,
  stocks: readonly StockDefinition[],
  opts: { settlement?: boolean; skipPhaseCheck?: boolean } = {},
): Result<ExecutionResult, TradeError> {
  const checked = validateOrder(opts.skipPhaseCheck ? { ...state, phase: 'TRADING' } : state, order, stocks);
  if (!checked.ok) return checked;
  const p = checked.value;
  const holdings: Record<string, Holding> = { ...state.holdings };
  const prev = holdings[p.stock.id];
  const id = `tx-${state.txCounter + 1}`;
  let transaction: Transaction;
  let cash = state.cash;
  let realizedPnL = state.realizedPnL;

  if (p.type === 'BUY') {
    cash -= p.total;
    holdings[p.stock.id] = {
      stockId: p.stock.id,
      shares: p.sharesAfter,
      avgPrice: p.avgPriceAfter,
      openedDay: prev && prev.shares > 0 ? prev.openedDay : state.day,
    };
    transaction = { id, day: state.day, stockId: p.stock.id, ticker: p.stock.ticker, type: 'BUY', shares: p.shares, price: p.price, total: p.total };
  } else {
    const pnl = p.expectedPnL ?? 0;
    cash += p.total;
    realizedPnL += pnl;
    if (p.sharesAfter > 0 && prev) {
      holdings[p.stock.id] = { ...prev, shares: p.sharesAfter };
    } else {
      delete holdings[p.stock.id];
    }
    transaction = {
      id,
      day: state.day,
      stockId: p.stock.id,
      ticker: p.stock.ticker,
      type: 'SELL',
      shares: p.shares,
      price: p.price,
      total: p.total,
      realizedPnL: pnl,
      avgPriceAtSale: p.avgPriceAfter,
      holdingDays: prev ? state.day - prev.openedDay : 0,
      ...(opts.settlement ? { settlement: true } : {}),
    };
  }

  return {
    ok: true,
    value: {
      state: {
        ...state,
        cash,
        holdings,
        realizedPnL,
        transactions: [...state.transactions, transaction],
        txCounter: state.txCounter + 1,
      },
      transaction,
    },
  };
}
