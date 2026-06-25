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

export function pctFromBuyPrice(buyPrice: number, latestClose: number): number {
  return Math.round(((latestClose - buyPrice) / buyPrice) * 10000) / 100;
}

/** Smallest distance to +plusPct or -minusPct from buy price. */
export function distToNearBand(
  pctFromBuy: number,
  plusPct: number,
  minusPct: number
): number {
  return (
    Math.round(Math.min(Math.abs(pctFromBuy - plusPct), Math.abs(pctFromBuy + minusPct)) * 100) /
    100
  );
}

export function nearestBandLabel(
  pctFromBuy: number,
  plusPct: number,
  minusPct: number
): string {
  const toPlus = Math.abs(pctFromBuy - plusPct);
  const toMinus = Math.abs(pctFromBuy + minusPct);
  return toPlus <= toMinus ? `+${plusPct}%` : `-${minusPct}%`;
}

export function priceMetricsFromBars(
  buyPrice: number,
  bars: OhlcvBar[],
  plusPct: number,
  minusPct: number
): { latestClosePrice: number; pctFromBuyPrice: number; distToNearBand: number } | null {
  if (buyPrice <= 0 || bars.length === 0) return null;
  const latestClose = bars[bars.length - 1].close;
  const pct = pctFromBuyPrice(buyPrice, latestClose);
  return {
    latestClosePrice: Math.round(latestClose * 100) / 100,
    pctFromBuyPrice: pct,
    distToNearBand: distToNearBand(pct, plusPct, minusPct),
  };
}

export { todayIso, dayjs };
