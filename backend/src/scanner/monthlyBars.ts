import type { OhlcvBar } from '../types/index.js';

export interface MonthlyBar {
  /** Last trading day of the month (YYYY-MM-DD) */
  date: string;
  monthKey: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Aggregate daily OHLCV into calendar months. */
export function aggregateDailyToMonthly(bars: OhlcvBar[]): MonthlyBar[] {
  const byMonth = new Map<string, OhlcvBar[]>();
  for (const bar of bars) {
    const key = bar.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(bar);
    byMonth.set(key, list);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthBars]) => {
      const sorted = [...monthBars].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        date: last.date,
        monthKey,
        open: first.open,
        high: Math.max(...sorted.map((b) => b.high)),
        low: Math.min(...sorted.map((b) => b.low)),
        close: last.close,
      };
    });
}

/** Yahoo monthly bars — merge duplicate month keys (partial month updates). */
export function normalizeYahooMonthlyBars(bars: OhlcvBar[]): MonthlyBar[] {
  return aggregateDailyToMonthly(bars);
}
