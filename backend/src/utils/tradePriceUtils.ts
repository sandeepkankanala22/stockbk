import type { OhlcvBar, TradeResult } from '../types/index.js';
import { dayjs, todayIso } from '../utils/dateParser.js';

/** Current price within ±pct of month-high buy price (active setup zone). */
export function isPriceNearBuyPrice(
  trade: TradeResult,
  bars: OhlcvBar[] | undefined,
  pctBand = 15
): boolean {
  if (trade.buyPrice == null || trade.buyPrice <= 0 || !bars || bars.length === 0) {
    return false;
  }
  const lastClose = bars[bars.length - 1].close;
  const diffPct = (Math.abs(lastClose - trade.buyPrice) / trade.buyPrice) * 100;
  return diffPct <= pctBand;
}

export function currentPriceFromBars(bars: OhlcvBar[] | undefined): number | null {
  if (!bars || bars.length === 0) return null;
  return bars[bars.length - 1].close;
}

export { todayIso, dayjs };
