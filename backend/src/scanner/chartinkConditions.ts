import type { MonthlyBar } from './monthlyBars.js';
import { computeScannerEmaMatrix, greatestEmaAt, leastEmaAt } from './emaUtils.js';

const MONTHS_OFFSET = 49;
const LONG_WINDOW = 200;
const SHORT_WINDOW = 100;

function rollingMaxHigh(highs: number[], endIdx: number, window: number): number | null {
  const start = endIdx - window + 1;
  if (start < 0) return null;
  let max = -Infinity;
  for (let i = start; i <= endIdx; i++) {
    max = Math.max(max, highs[i]);
  }
  return max;
}

function highsEqual(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  // Chartink uses exact equality; allow small OHLC rounding drift
  return Math.abs(a - b) <= scale * 0.005;
}

export interface TechnicalSignalMonth {
  index: number;
  bar: MonthlyBar;
}

/** Minimum months needed before first scannable candle. */
export const MIN_MONTHS_FOR_SCAN = LONG_WINDOW - 1;

/**
 * Chartink technical block (fundamentals applied separately):
 * - Close > Greatest(EMA20..55)
 * - Open < Least(EMA20..55)
 * - Max(200, High) = 49 months ago Max(100, High)
 * - High > 50% of 200-month highest high
 */
export function findTechnicalSignalMonths(
  monthly: MonthlyBar[],
  signalAfterDate: string | null = null
): TechnicalSignalMonth[] {
  if (monthly.length <= MIN_MONTHS_FOR_SCAN) return [];

  const closes = monthly.map((m) => m.close);
  const highs = monthly.map((m) => m.high);
  const emaMatrix = computeScannerEmaMatrix(closes);
  const signals: TechnicalSignalMonth[] = [];

  for (let i = MIN_MONTHS_FOR_SCAN; i < monthly.length; i++) {
    const bar = monthly[i];
    if (signalAfterDate && bar.date < signalAfterDate) continue;

    const greatestEma = greatestEmaAt(emaMatrix, i);
    const leastEma = leastEmaAt(emaMatrix, i);
    if (greatestEma == null || leastEma == null) continue;

    if (!(bar.close > greatestEma)) continue;
    if (!(bar.open < leastEma)) continue;

    const max200 = rollingMaxHigh(highs, i, LONG_WINDOW);
    const refIdx = i - MONTHS_OFFSET;
    const max100AtOffset = rollingMaxHigh(highs, refIdx, SHORT_WINDOW);
    if (max200 == null || max100AtOffset == null) continue;
    if (!highsEqual(max200, max100AtOffset)) continue;

    if (!(bar.high > max200 * 0.5)) continue;

    signals.push({ index: i, bar });
  }

  return signals;
}
