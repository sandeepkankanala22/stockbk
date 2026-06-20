import type { OhlcvBar } from '../types/index.js';
import { dayjs, isInCalendarMonth, nextMonthStartIso } from '../utils/dateParser.js';

export interface MonthHighResult {
  price: number;
  date: string;
}

export function calculateMonthHigh(bars: OhlcvBar[], minDate: string): MonthHighResult | null {
  const ref = dayjs(minDate);
  const year = ref.year();
  const month = ref.month();

  const monthBars = bars.filter((bar) => isInCalendarMonth(bar.date, year, month));
  if (monthBars.length === 0) return null;

  let maxHigh = -Infinity;
  let maxDate = monthBars[0].date;

  for (const bar of monthBars) {
    if (bar.high > maxHigh) {
      maxHigh = bar.high;
      maxDate = bar.date;
    }
  }

  return { price: maxHigh, date: maxDate };
}

export function findFirstTradingDayNextMonth(bars: OhlcvBar[], minDate: string): string | null {
  const nextMonthStart = nextMonthStartIso(minDate);
  const nextMonth = dayjs(nextMonthStart);
  const targetYear = nextMonth.year();
  const targetMonth = nextMonth.month();

  for (const bar of bars) {
    if (isInCalendarMonth(bar.date, targetYear, targetMonth)) {
      return bar.date;
    }
  }

  return null;
}

export interface BreakoutResult {
  date: string;
  high: number;
}

export function findBreakoutDate(
  bars: OhlcvBar[],
  startScanDate: string,
  buyPrice: number
): BreakoutResult | null {
  for (const bar of bars) {
    if (bar.date < startScanDate) continue;
    if (bar.high > buyPrice) {
      return { date: bar.date, high: bar.high };
    }
  }
  return null;
}

export function getBarsFromDate(bars: OhlcvBar[], fromDate: string): OhlcvBar[] {
  return bars.filter((bar) => bar.date >= fromDate);
}
