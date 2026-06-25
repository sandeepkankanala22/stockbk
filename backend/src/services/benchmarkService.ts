import type { PricePathPoint } from '../types/index.js';
import { buildBenchmarkPath } from '../backtest/pricePathBuilder.js';
import { yahooFinanceService } from './yahooFinanceService.js';

export interface BenchmarkSeries {
  label: string;
  startDate: string;
  points: PricePathPoint[];
}

const NIFTY_SYMBOL = '^NSEI';

export async function fetchNifty50Benchmark(
  startDate: string
): Promise<BenchmarkSeries | null> {
  const { bars, error } = await yahooFinanceService.fetchHistoricalData(NIFTY_SYMBOL, startDate);
  if (error || bars.length === 0) return null;

  const points = buildBenchmarkPath(bars, startDate);
  if (points.length === 0) return null;

  return {
    label: 'NIFTY 50',
    startDate,
    points,
  };
}

export function earliestBuyDate(
  trades: { buyDate: string | null }[]
): string | null {
  let earliest: string | null = null;
  for (const t of trades) {
    if (!t.buyDate) continue;
    if (!earliest || t.buyDate < earliest) earliest = t.buyDate;
  }
  return earliest;
}
