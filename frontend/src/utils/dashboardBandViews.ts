import type { TradeResult } from '../types';
import { getDashboardResults } from './symbolDateSelection';
import { resolveFirstHitAfterPullback } from './investorDashboardBuilder';

export type BandSortMode = 'nearest' | 'highest' | 'lowest' | 'symbol';

export interface BandStockRow {
  symbol: string;
  signalDate: string;
  buyDate: string | null;
  buyPrice: number | null;
  latestClose: number | null;
  pctFromBuy: number;
  pullbackDate: string | null;
  fttDate: string | null;
  result: string;
}

export interface BandRiskReward {
  phaseLabel: string;
  targetLabel: string;
  stopLabel: string;
  openLabel: string;
  targetHits: number;
  stoplossHits: number;
  openPending: number;
  total: number;
  targetPct: number;
  stoplossPct: number;
  openPct: number;
}

export interface BandPanelData {
  id: 'boughtInBand' | 'fttPullbackInBand' | 'noBuyOpen';
  title: string;
  subtitle: string;
  rows: BandStockRow[];
  totalInUniverse: number;
  riskReward: BandRiskReward;
}

function toRow(trade: TradeResult, pct: number): BandStockRow {
  return {
    symbol: trade.symbol,
    signalDate: trade.minDate,
    buyDate: trade.buyDate,
    buyPrice: trade.buyPrice,
    latestClose: trade.latestClosePrice,
    pctFromBuy: pct,
    pullbackDate: trade.lowHitBuyAfterFttDate,
    fttDate: trade.firstHit === 'TARGET' ? trade.targetHitDate : null,
    result: trade.result,
  };
}

export function isWithinTargetStopBand(
  pct: number | null | undefined,
  targetPercent: number,
  stoplossPercent: number
): boolean {
  if (pct == null) return false;
  return pct >= -stoplossPercent && pct <= targetPercent;
}

export function sortBandRows(rows: BandStockRow[], mode: BandSortMode): BandStockRow[] {
  const sorted = [...rows];
  switch (mode) {
    case 'nearest':
      sorted.sort(
        (a, b) =>
          Math.abs(a.pctFromBuy) - Math.abs(b.pctFromBuy) ||
          a.symbol.localeCompare(b.symbol)
      );
      break;
    case 'highest':
      sorted.sort(
        (a, b) => b.pctFromBuy - a.pctFromBuy || a.symbol.localeCompare(b.symbol)
      );
      break;
    case 'lowest':
      sorted.sort(
        (a, b) => a.pctFromBuy - b.pctFromBuy || a.symbol.localeCompare(b.symbol)
      );
      break;
    case 'symbol':
      sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
      break;
  }
  return sorted;
}

export function isBoughtPendingNoFttFsl(trade: TradeResult): boolean {
  if (!trade.buyDate || trade.result === 'ERROR' || trade.result === 'NO_BREAKOUT') {
    return false;
  }
  if (trade.firstHit === 'TARGET' || trade.firstHit === 'STOPLOSS') {
    return false;
  }
  if (trade.lowHitBuyAfterFtt === true && trade.lowHitBuyAfterFttDate) {
    return false;
  }
  return true;
}

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function buildRiskReward(
  phaseLabel: string,
  targetLabel: string,
  stopLabel: string,
  openLabel: string,
  targetHits: number,
  stoplossHits: number,
  openPending: number
): BandRiskReward {
  const total = targetHits + stoplossHits + openPending;
  return {
    phaseLabel,
    targetLabel,
    stopLabel,
    openLabel,
    targetHits,
    stoplossHits,
    openPending,
    total,
    targetPct: pct(targetHits, total),
    stoplossPct: pct(stoplossHits, total),
    openPct: pct(openPending, total),
  };
}

function isActionableBought(trade: TradeResult): boolean {
  return (
    trade.buyDate != null && trade.result !== 'ERROR' && trade.result !== 'NO_BREAKOUT'
  );
}

function isFttPullbackUniverse(trade: TradeResult): boolean {
  return (
    trade.buyDate != null &&
    trade.firstHit === 'TARGET' &&
    trade.lowHitBuyAfterFtt === true &&
    trade.lowHitBuyAfterFttDate != null
  );
}

function isNoBuyUniverse(trade: TradeResult): boolean {
  return (
    trade.result === 'NO_BREAKOUT' ||
    (trade.buyPrice != null && !trade.buyDate && trade.result !== 'ERROR')
  );
}

export function buildThreeBandPanels(
  results: TradeResult[],
  targetPercent: number,
  stoplossPercent: number
): BandPanelData[] {
  const { rows } = getDashboardResults(results);

  const bought = rows.filter(
    (r) =>
      isBoughtPendingNoFttFsl(r) &&
      r.pctFromBuyPrice != null &&
      isWithinTargetStopBand(r.pctFromBuyPrice, targetPercent, stoplossPercent)
  );

  const fttPullback = rows.filter(
    (r) =>
      r.buyDate != null &&
      r.firstHit === 'TARGET' &&
      r.lowHitBuyAfterFtt === true &&
      r.lowHitBuyAfterFttDate != null &&
      r.pctFromBuyPrice != null &&
      isWithinTargetStopBand(r.pctFromBuyPrice, targetPercent, stoplossPercent)
  );

  const noBuy = rows.filter(
    (r) =>
      r.result === 'NO_BREAKOUT' ||
      (r.buyPrice != null && !r.buyDate && r.result !== 'ERROR')
  );

  const boughtUniverse = rows.filter((r) => isBoughtPendingNoFttFsl(r));
  const fttPullbackUniverse = rows.filter(isFttPullbackUniverse);
  const signalBuyUniverse = rows.filter(isActionableBought);
  const noBuyUniverse = rows.filter(isNoBuyUniverse);

  const phase1Ftt = signalBuyUniverse.filter((r) => r.firstHit === 'TARGET').length;
  const phase1Fsl = signalBuyUniverse.filter((r) => r.firstHit === 'STOPLOSS').length;
  const phase1Open = signalBuyUniverse.filter(
    (r) => r.firstHit !== 'TARGET' && r.firstHit !== 'STOPLOSS'
  ).length;

  const phase2Target = fttPullbackUniverse.filter(
    (r) => resolveFirstHitAfterPullback(r) === 'TARGET'
  ).length;
  const phase2Sl = fttPullbackUniverse.filter(
    (r) => resolveFirstHitAfterPullback(r) === 'STOPLOSS'
  ).length;
  const phase2Open = fttPullbackUniverse.filter(
    (r) => resolveFirstHitAfterPullback(r) === 'OPEN'
  ).length;

  return [
    {
      id: 'boughtInBand',
      title: 'Bought — in ± band',
      subtitle: `Bought, no FTT/FSL yet (excludes pullbacks); between −${stoplossPercent}% and +${targetPercent}% from buy`,
      rows: bought.map((t) => toRow(t, t.pctFromBuyPrice!)),
      totalInUniverse: boughtUniverse.length,
      riskReward: buildRiskReward(
        'Past — all signal buys (Phase 1)',
        'Hit target (FTT)',
        'Hit stop loss (FSL)',
        'Open / pending',
        phase1Ftt,
        phase1Fsl,
        phase1Open
      ),
    },
    {
      id: 'fttPullbackInBand',
      title: 'FTT → pullback — in ± band',
      subtitle: `Hit FTT, fell back to buy price; now between −${stoplossPercent}% and +${targetPercent}% from buy`,
      rows: fttPullback.map((t) => toRow(t, t.pctFromBuyPrice!)),
      totalInUniverse: fttPullbackUniverse.length,
      riskReward: buildRiskReward(
        'Past — after pullback (Phase 2)',
        'Target after pullback',
        'Stop loss after pullback',
        'Open / pending',
        phase2Target,
        phase2Sl,
        phase2Open
      ),
    },
    {
      id: 'noBuyOpen',
      title: 'Signal — no buy yet',
      subtitle: 'Month-high buy price never touched; % is latest close vs signal month high',
      rows: noBuy
        .filter((t) => t.pctFromBuyPrice != null)
        .map((t) => toRow(t, t.pctFromBuyPrice!)),
      totalInUniverse: noBuyUniverse.length,
      riskReward: buildRiskReward(
        'Past — no buy yet',
        'Hit target (FTT)',
        'Hit stop loss (FSL)',
        'Awaiting buy',
        0,
        0,
        noBuyUniverse.length
      ),
    },
  ];
}
