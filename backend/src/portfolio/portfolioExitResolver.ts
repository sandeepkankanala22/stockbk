import { evaluateTrade } from '../backtest/tradeEvaluator.js';
import { calculateStoplossPrice, calculateTargetPrice, roundPrice } from '../backtest/priceUtils.js';
import type {
  OhlcvBar,
  PortfolioEntryType,
  SameDayHitMode,
  ScannerSignal,
  TradeResult,
} from '../types/index.js';
import { yahooFinanceService } from '../services/yahooFinanceService.js';

export type { PortfolioEntryType };

export interface BacktestEntryInput {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  entryType: 'signal_buy' | 'pullback_buy';
  tradeKey: string;
}

export interface SignalExitPlan {
  signalKey: string;
  symbol: string;
  signalDate: string;
  entryType: PortfolioEntryType;
  entryPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  lastPrice: number;
  lastDate: string;
  fullExitDate: string | null;
  fullExitPrice: number | null;
  fullExitReason: 'TARGET' | 'STOPLOSS' | null;
  partialTargetDate: string | null;
  partialTargetPrice: number | null;
  remainderSlDate: string | null;
  remainderSlPrice: number | null;
  slBeforeTargetDate: string | null;
  slBeforeTargetPrice: number | null;
  priceSeries: Array<{ date: string; close: number }>;
}

export function planKey(symbol: string, entryDate: string): string {
  return `${symbol}:${entryDate}`;
}

function findStoplossAfterDate(
  bars: OhlcvBar[],
  afterDate: string,
  stoplossPrice: number
): string | null {
  for (const bar of bars) {
    if (bar.date <= afterDate) continue;
    if (bar.low <= stoplossPrice) return bar.date;
  }
  return null;
}

function pricesMatchTrade(
  trade: TradeResult,
  entryPrice: number,
  targetPercent: number,
  stoplossPercent: number
): boolean {
  const targetPrice = roundPrice(calculateTargetPrice(entryPrice, targetPercent));
  const stoplossPrice = roundPrice(calculateStoplossPrice(entryPrice, stoplossPercent));
  return trade.targetPrice === targetPrice && trade.stoplossPrice === stoplossPrice;
}

function buildPriceSeries(
  bars: OhlcvBar[],
  entryDate: string
): Array<{ date: string; close: number }> {
  return bars
    .filter((b) => b.date >= entryDate)
    .map((b) => ({ date: b.date, close: roundPrice(b.close) }));
}

function applyTargetExit(
  plan: Pick<
    SignalExitPlan,
    | 'fullExitDate'
    | 'fullExitPrice'
    | 'fullExitReason'
    | 'partialTargetDate'
    | 'partialTargetPrice'
    | 'remainderSlDate'
    | 'remainderSlPrice'
  >,
  targetDate: string,
  targetPrice: number,
  bars: OhlcvBar[],
  stoplossPrice: number
): void {
  plan.fullExitDate = targetDate;
  plan.fullExitPrice = targetPrice;
  plan.fullExitReason = 'TARGET';
  plan.partialTargetDate = targetDate;
  plan.partialTargetPrice = targetPrice;
  plan.remainderSlDate = findStoplossAfterDate(bars, targetDate, stoplossPrice);
  plan.remainderSlPrice = plan.remainderSlDate ? stoplossPrice : null;
}

function applyStoplossExit(
  plan: Pick<
    SignalExitPlan,
    'fullExitDate' | 'fullExitPrice' | 'fullExitReason' | 'slBeforeTargetDate' | 'slBeforeTargetPrice'
  >,
  stopDate: string,
  stoplossPrice: number
): void {
  plan.fullExitDate = stopDate;
  plan.fullExitPrice = stoplossPrice;
  plan.fullExitReason = 'STOPLOSS';
  plan.slBeforeTargetDate = stopDate;
  plan.slBeforeTargetPrice = stoplossPrice;
}

/** Build exit plan from backtest Phase 1 / Phase 2 fields (matches investor dashboard logic). */
export function buildPlanFromBacktestEntry(
  entry: BacktestEntryInput,
  trade: TradeResult,
  targetPercent: number,
  stoplossPercent: number,
  bars: OhlcvBar[]
): SignalExitPlan {
  const entryPrice = entry.entryPrice;
  const targetPrice = roundPrice(calculateTargetPrice(entryPrice, targetPercent));
  const stoplossPrice = roundPrice(calculateStoplossPrice(entryPrice, stoplossPercent));
  const lastBar = bars[bars.length - 1];

  const plan: SignalExitPlan = {
    signalKey: planKey(entry.symbol, entry.entryDate),
    symbol: entry.symbol,
    signalDate: entry.entryDate,
    entryType: entry.entryType === 'pullback_buy' ? 'pullback' : 'breakout',
    entryPrice,
    targetPrice,
    stoplossPrice,
    lastPrice: roundPrice(lastBar?.close ?? entryPrice),
    lastDate: lastBar?.date ?? entry.entryDate,
    fullExitDate: null,
    fullExitPrice: null,
    fullExitReason: null,
    partialTargetDate: null,
    partialTargetPrice: null,
    remainderSlDate: null,
    remainderSlPrice: null,
    slBeforeTargetDate: null,
    slBeforeTargetPrice: null,
    priceSeries: buildPriceSeries(bars, entry.entryDate),
  };

  if (entry.entryType === 'signal_buy') {
    if (trade.firstHit === 'TARGET' && trade.firstHitDate) {
      applyTargetExit(plan, trade.firstHitDate, targetPrice, bars, stoplossPrice);
      if (trade.stoplossAfterTargetDate) {
        plan.remainderSlDate = trade.stoplossAfterTargetDate;
        plan.remainderSlPrice = stoplossPrice;
      }
    } else if (trade.firstHit === 'STOPLOSS' && trade.firstHitDate) {
      applyStoplossExit(plan, trade.firstHitDate, stoplossPrice);
    }
    return plan;
  }

  if (trade.firstHitAfterPullback === 'TARGET' && trade.firstHitAfterPullbackDate) {
    applyTargetExit(plan, trade.firstHitAfterPullbackDate, targetPrice, bars, stoplossPrice);
  } else if (trade.firstHitAfterPullback === 'STOPLOSS' && trade.firstHitAfterPullbackDate) {
    applyStoplossExit(plan, trade.firstHitAfterPullbackDate, stoplossPrice);
  } else if (
    trade.targetAfterPullbackHit &&
    trade.targetAfterPullbackDate &&
    !trade.firstHitAfterPullback
  ) {
    applyTargetExit(plan, trade.targetAfterPullbackDate, targetPrice, bars, stoplossPrice);
    if (trade.stoplossAfterPullbackHit && trade.stoplossAfterPullbackDate) {
      if (trade.stoplossAfterPullbackDate > trade.targetAfterPullbackDate) {
        plan.remainderSlDate = trade.stoplossAfterPullbackDate;
        plan.remainderSlPrice = stoplossPrice;
      }
    }
  } else if (
    trade.stoplossAfterPullbackHit &&
    trade.stoplossAfterPullbackDate &&
    !trade.firstHitAfterPullback
  ) {
    applyStoplossExit(plan, trade.stoplossAfterPullbackDate, stoplossPrice);
  }

  return plan;
}

export async function resolveEntryExitPlan(
  symbol: string,
  entryDate: string,
  entryPrice: number,
  targetPercent: number,
  stoplossPercent: number,
  sameDayHitMode: SameDayHitMode = 'STOPLOSS_FIRST'
): Promise<SignalExitPlan | null> {
  const { bars, error } = await yahooFinanceService.fetchForSymbol(symbol, entryDate);
  if (error || bars.length === 0) return null;

  const targetPrice = roundPrice(calculateTargetPrice(entryPrice, targetPercent));
  const stoplossPrice = roundPrice(calculateStoplossPrice(entryPrice, stoplossPercent));
  const lastBar = bars[bars.length - 1];

  const evaluation = evaluateTrade(
    bars,
    entryDate,
    targetPrice,
    stoplossPrice,
    sameDayHitMode
  );

  const plan: SignalExitPlan = {
    signalKey: planKey(symbol, entryDate),
    symbol,
    signalDate: entryDate,
    entryType: 'breakout',
    entryPrice,
    targetPrice,
    stoplossPrice,
    lastPrice: roundPrice(lastBar.close),
    lastDate: lastBar.date,
    fullExitDate: null,
    fullExitPrice: null,
    fullExitReason: null,
    partialTargetDate: null,
    partialTargetPrice: null,
    remainderSlDate: null,
    remainderSlPrice: null,
    slBeforeTargetDate: null,
    slBeforeTargetPrice: null,
    priceSeries: buildPriceSeries(bars, entryDate),
  };

  if (evaluation.result === 'TARGET' && evaluation.resultDate) {
    applyTargetExit(plan, evaluation.resultDate, targetPrice, bars, stoplossPrice);
  } else if (evaluation.result === 'STOPLOSS' && evaluation.resultDate) {
    applyStoplossExit(plan, evaluation.resultDate, stoplossPrice);
  }

  return plan;
}

export async function resolveBacktestEntryPlan(
  entry: BacktestEntryInput,
  trade: TradeResult | undefined,
  targetPercent: number,
  stoplossPercent: number,
  sameDayHitMode: SameDayHitMode
): Promise<SignalExitPlan | null> {
  const { bars, error } = await yahooFinanceService.fetchForSymbol(entry.symbol, entry.entryDate);
  if (error || bars.length === 0) return null;

  const useStoredExits =
    trade &&
    pricesMatchTrade(trade, entry.entryPrice, targetPercent, stoplossPercent) &&
    (entry.entryType === 'signal_buy'
      ? trade.firstHit != null || trade.result === 'OPEN'
      : trade.lowHitBuyAfterFttDate != null);

  if (useStoredExits) {
    return buildPlanFromBacktestEntry(entry, trade, targetPercent, stoplossPercent, bars);
  }

  const plan = await resolveEntryExitPlan(
    entry.symbol,
    entry.entryDate,
    entry.entryPrice,
    targetPercent,
    stoplossPercent,
    sameDayHitMode
  );
  if (!plan) return null;
  return {
    ...plan,
    entryType: entry.entryType === 'pullback_buy' ? 'pullback' : 'breakout',
  };
}

export async function resolveSignalExitPlan(
  signal: ScannerSignal,
  targetPercent: number,
  stoplossPercent: number,
  sameDayHitMode: SameDayHitMode = 'STOPLOSS_FIRST'
): Promise<SignalExitPlan | null> {
  return resolveEntryExitPlan(
    signal.symbol,
    signal.signalDate,
    signal.entryPrice,
    targetPercent,
    stoplossPercent,
    sameDayHitMode
  );
}
