import { dayjs } from '../utils/dateParser.js';
import { MIN_MONTHS_FOR_SCAN } from './chartinkConditions.js';

export type ScannerPeriod = '6m' | '1y' | '3y' | '5y' | 'all';

const PERIOD_MONTHS: Record<Exclude<ScannerPeriod, 'all'>, number> = {
  '6m': 6,
  '1y': 12,
  '3y': 36,
  '5y': 60,
};

/** Earliest signal date to include (inclusive), or null for all history. */
export function signalCutoffDate(period: ScannerPeriod, asOf = new Date()): string | null {
  if (period === 'all') return null;
  const months = PERIOD_MONTHS[period];
  return dayjs(asOf).subtract(months, 'month').format('YYYY-MM-DD');
}

/** How far back to fetch OHLC so rolling 200-month logic works inside the period. */
export function historyFetchStart(period: ScannerPeriod, asOf = new Date()): string {
  const warmup = MIN_MONTHS_FOR_SCAN + 60;
  if (period === 'all') return '2004-01-01';
  const months = PERIOD_MONTHS[period];
  return dayjs(asOf)
    .subtract(months + warmup, 'month')
    .startOf('month')
    .format('YYYY-MM-DD');
}

export function isValidScannerPeriod(value: unknown): value is ScannerPeriod {
  return value === '6m' || value === '1y' || value === '3y' || value === '5y' || value === 'all';
}

export const SCANNER_PERIOD_LABELS: Record<ScannerPeriod, string> = {
  '6m': '6 months',
  '1y': '1 year',
  '3y': '3 years',
  '5y': '5 years',
  all: 'All time',
};
