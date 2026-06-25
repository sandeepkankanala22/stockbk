import type { MonthlyBar } from './monthlyBars.js';
import type { ScannerSignal } from '../types/index.js';

function pctChange(from: number, to: number): number {
  return Math.round(((to / from - 1) * 100) * 100) / 100;
}

function closeAtOffset(monthly: MonthlyBar[], index: number, monthsForward: number): number | null {
  const target = index + monthsForward;
  if (target >= monthly.length) return null;
  return monthly[target].close;
}

export function buildSignalMetrics(
  symbol: string,
  company: string,
  monthly: MonthlyBar[],
  signalIndex: number
): ScannerSignal {
  const entryBar = monthly[signalIndex];
  const entry = entryBar.close;
  const lastBar = monthly[monthly.length - 1];
  const current = lastBar.close;

  let maxHigh = entry;
  let minLow = entry;
  for (let i = signalIndex + 1; i < monthly.length; i++) {
    maxHigh = Math.max(maxHigh, monthly[i].high);
    minLow = Math.min(minLow, monthly[i].low);
  }

  const c3 = closeAtOffset(monthly, signalIndex, 3);
  const c6 = closeAtOffset(monthly, signalIndex, 6);
  const c12 = closeAtOffset(monthly, signalIndex, 12);

  return {
    symbol,
    company,
    signalDate: entryBar.date,
    entryPrice: Math.round(entry * 100) / 100,
    currentPrice: Math.round(current * 100) / 100,
    returnPct: pctChange(entry, current),
    return3mPct: c3 != null ? pctChange(entry, c3) : null,
    return6mPct: c6 != null ? pctChange(entry, c6) : null,
    return12mPct: c12 != null ? pctChange(entry, c12) : null,
    maxGainPct: pctChange(entry, maxHigh),
    maxDrawdownPct: pctChange(entry, minLow),
  };
}
