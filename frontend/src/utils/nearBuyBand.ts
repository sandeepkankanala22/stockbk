import type { TradeResult } from '../types';

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
  pctFromBuy: number | null | undefined,
  plusPct: number,
  minusPct: number
): string {
  if (pctFromBuy == null) return '—';
  const toPlus = Math.abs(pctFromBuy - plusPct);
  const toMinus = Math.abs(pctFromBuy + minusPct);
  return toPlus <= toMinus ? `+${plusPct}%` : `-${minusPct}%`;
}

export function getTop10NearBuyBand(
  results: TradeResult[],
  plusPct: number,
  minusPct: number
): TradeResult[] {
  return results
    .filter(
      (r) =>
        r.buyPrice != null &&
        r.pctFromBuyPrice != null &&
        r.result !== 'ERROR'
    )
    .map((r) => ({
      ...r,
      distToNearBand: distToNearBand(r.pctFromBuyPrice as number, plusPct, minusPct),
    }))
    .sort((a, b) => (a.distToNearBand ?? 999) - (b.distToNearBand ?? 999))
    .slice(0, 10);
}
