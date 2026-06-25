import type { OhlcvBar } from '../types/index.js';

export interface PricePathPoint {
  date: string;
  pct: number;
}

export interface AthEventPoint {
  date: string;
  pct: number;
}

function pctFromPrice(price: number, buyPrice: number): number {
  return Math.round((price / buyPrice - 1) * 10000) / 100;
}

/** Daily % from buy price (close) starting at buy date. */
export function buildPricePath(
  bars: OhlcvBar[],
  buyDate: string,
  buyPrice: number
): PricePathPoint[] {
  return bars
    .filter((b) => b.date >= buyDate)
    .map((b) => ({
      date: b.date,
      pct: pctFromPrice(b.close, buyPrice),
    }));
}

/** Each bar where high sets a new all-time high (includes pre-buy history). */
export function buildAthEvents(
  bars: OhlcvBar[],
  buyDate: string,
  buyPrice: number
): AthEventPoint[] {
  const events: AthEventPoint[] = [];
  let runningMax = -Infinity;

  for (const bar of bars) {
    if (bar.date < buyDate) {
      runningMax = Math.max(runningMax, bar.high);
      continue;
    }
    if (bar.high > runningMax) {
      runningMax = bar.high;
      events.push({
        date: bar.date,
        pct: pctFromPrice(bar.high, buyPrice),
      });
    }
  }

  return events;
}

/** Benchmark line (% from first close on/after startDate). */
export function buildBenchmarkPath(
  bars: OhlcvBar[],
  startDate: string
): PricePathPoint[] {
  const fromStart = bars.filter((b) => b.date >= startDate);
  if (fromStart.length === 0) return [];

  const baseClose = fromStart[0].close;
  return fromStart.map((b) => ({
    date: b.date,
    pct: pctFromPrice(b.close, baseClose),
  }));
}
