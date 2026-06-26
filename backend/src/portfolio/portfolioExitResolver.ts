import { evaluateTrade } from '../backtest/tradeEvaluator.js';
import { calculateStoplossPrice, calculateTargetPrice, roundPrice } from '../backtest/priceUtils.js';
import type { OhlcvBar, ScannerSignal } from '../types/index.js';
import { yahooFinanceService } from '../services/yahooFinanceService.js';

export interface SignalExitPlan {
  signalKey: string;
  symbol: string;
  signalDate: string;
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
}

export function planKey(symbol: string, entryDate: string): string {
  return `${symbol}:${entryDate}`;
}

export async function resolveEntryExitPlan(
  symbol: string,
  entryDate: string,
  entryPrice: number,
  targetPercent: number,
  stoplossPercent: number
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
    'STOPLOSS_FIRST'
  );

  let fullExitDate: string | null = null;
  let fullExitPrice: number | null = null;
  let fullExitReason: 'TARGET' | 'STOPLOSS' | null = null;

  let partialTargetDate: string | null = null;
  let partialTargetPrice: number | null = null;
  let remainderSlDate: string | null = null;
  let remainderSlPrice: number | null = null;
  let slBeforeTargetDate: string | null = null;
  let slBeforeTargetPrice: number | null = null;

  if (evaluation.result === 'TARGET' && evaluation.resultDate) {
    fullExitDate = evaluation.resultDate;
    fullExitPrice = targetPrice;
    fullExitReason = 'TARGET';

    partialTargetDate = evaluation.resultDate;
    partialTargetPrice = targetPrice;

    remainderSlDate = findStoplossAfterDate(bars, evaluation.resultDate, stoplossPrice);
    remainderSlPrice = remainderSlDate ? stoplossPrice : null;
  } else if (evaluation.result === 'STOPLOSS' && evaluation.resultDate) {
    fullExitDate = evaluation.resultDate;
    fullExitPrice = stoplossPrice;
    fullExitReason = 'STOPLOSS';

    slBeforeTargetDate = evaluation.resultDate;
    slBeforeTargetPrice = stoplossPrice;
  }

  return {
    signalKey: planKey(symbol, entryDate),
    symbol,
    signalDate: entryDate,
    entryPrice,
    targetPrice,
    stoplossPrice,
    lastPrice: roundPrice(lastBar.close),
    lastDate: lastBar.date,
    fullExitDate,
    fullExitPrice,
    fullExitReason,
    partialTargetDate,
    partialTargetPrice,
    remainderSlDate,
    remainderSlPrice,
    slBeforeTargetDate,
    slBeforeTargetPrice,
  };
}

export async function resolveSignalExitPlan(
  signal: ScannerSignal,
  targetPercent: number,
  stoplossPercent: number
): Promise<SignalExitPlan | null> {
  return resolveEntryExitPlan(
    signal.symbol,
    signal.signalDate,
    signal.entryPrice,
    targetPercent,
    stoplossPercent
  );
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
