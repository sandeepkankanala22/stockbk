import type {
  CaseDashboardStats,
  DashboardAnalytics,
  DashboardSummary,
  Scenario2Summary,
  TimingStats,
  TradeResult,
} from '../types/index.js';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function pct(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 10000) / 100;
}

function daysToMonths(days: number): number {
  return Math.round((days / 30.44) * 100) / 100;
}

function computeTimingStats(values: number[]): TimingStats {
  if (values.length === 0) {
    return {
      count: 0,
      minDays: null,
      maxDays: null,
      avgDays: null,
      minMonths: null,
      maxMonths: null,
      avgMonths: null,
    };
  }
  const minDays = Math.min(...values);
  const maxDays = Math.max(...values);
  const avgDays = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
  return {
    count: values.length,
    minDays,
    maxDays,
    avgDays,
    minMonths: daysToMonths(minDays),
    maxMonths: daysToMonths(maxDays),
    avgMonths: daysToMonths(avgDays),
  };
}

function buildCaseStats(
  subset: TradeResult[],
  actionableTotal: number,
  followUpFilter: (r: TradeResult) => boolean
): CaseDashboardStats {
  const firstHitCount = subset.length;
  const followUpCount = subset.filter(followUpFilter).length;
  const targetDays = subset
    .filter((r) => r.targetHitDays != null)
    .map((r) => r.targetHitDays as number);
  const stoplossDays = subset
    .filter((r) => r.stoplossHitDays != null)
    .map((r) => r.stoplossHitDays as number);

  return {
    firstHitCount,
    firstHitPct: pct(firstHitCount, actionableTotal),
    followUpCount,
    followUpPct: pct(followUpCount, firstHitCount),
    daysToFirstTarget: computeTimingStats(targetDays),
    daysToFirstStoploss: computeTimingStats(stoplossDays),
  };
}

export class StatisticsService {
  computeSummary(results: TradeResult[]): DashboardSummary {
    const totalSymbols = results.length;
    const targetHits = results.filter((r) => r.result === 'TARGET').length;
    const stoplossHits = results.filter((r) => r.result === 'STOPLOSS').length;
    const noBreakouts = results.filter((r) => r.result === 'NO_BREAKOUT').length;
    const openTrades = results.filter((r) => r.result === 'OPEN').length;
    const errors = results.filter((r) => r.result === 'ERROR').length;

    const closedTrades = results.filter(
      (r) => (r.result === 'TARGET' || r.result === 'STOPLOSS') && r.days !== null
    );
    const holdingDays = closedTrades.map((r) => r.days as number);

    const winRate =
      targetHits + stoplossHits > 0
        ? (targetHits / (targetHits + stoplossHits)) * 100
        : 0;

    const averageHoldingDays =
      holdingDays.length > 0
        ? holdingDays.reduce((sum, d) => sum + d, 0) / holdingDays.length
        : 0;

    const medianHoldingDays = median(holdingDays);

    let bestTrade = null;
    let worstTrade = null;

    if (closedTrades.length > 0) {
      const sorted = [...closedTrades].sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      bestTrade = {
        symbol: best.symbol,
        days: best.days as number,
        result: best.result,
      };
      worstTrade = {
        symbol: worst.symbol,
        days: worst.days as number,
        result: worst.result,
      };
    }

    const actionableTrades = results.filter(
      (r) => r.buyDate != null && r.result !== 'ERROR' && r.result !== 'NO_BREAKOUT'
    );
    const stoplossHitTillDateCount = actionableTrades.filter(
      (r) => r.stoplossHitTillDate === true
    ).length;
    const stoplossHitTillDatePct = pct(stoplossHitTillDateCount, actionableTrades.length);

    const scenario2 = this.computeScenario2Summary(actionableTrades);
    const analytics = this.computeAnalytics(actionableTrades, totalSymbols);

    return {
      totalSymbols,
      targetHits,
      stoplossHits,
      noBreakouts,
      openTrades,
      errors,
      winRate: Math.round(winRate * 100) / 100,
      averageHoldingDays: Math.round(averageHoldingDays * 100) / 100,
      medianHoldingDays: Math.round(medianHoldingDays * 100) / 100,
      bestTrade,
      worstTrade,
      stoplossHitTillDateCount,
      stoplossHitTillDatePct,
      scenario2,
      analytics,
      mindmapTree: null,
      finance: null,
    };
  }

  private computeAnalytics(
    actionableTrades: TradeResult[],
    totalStocks: number
  ): DashboardAnalytics | null {
    if (actionableTrades.length === 0) return null;

    const neverHitStoplossCount = actionableTrades.filter(
      (r) => r.stoplossHitTillDate === false
    ).length;

    const overallTargetDays = actionableTrades
      .filter((r) => r.targetHitDays != null)
      .map((r) => r.targetHitDays as number);
    const overallStoplossDays = actionableTrades
      .filter((r) => r.stoplossHitDays != null)
      .map((r) => r.stoplossHitDays as number);

    const case1Trades = actionableTrades.filter((r) => r.firstHit === 'TARGET');
    const case2Trades = actionableTrades.filter((r) => r.firstHit === 'STOPLOSS');

    return {
      totalStocks,
      actionableStocks: actionableTrades.length,
      neverHitStoploss: {
        count: neverHitStoplossCount,
        pct: pct(neverHitStoplossCount, actionableTrades.length),
      },
      overall: {
        daysToFirstTarget: computeTimingStats(overallTargetDays),
        daysToFirstStoploss: computeTimingStats(overallStoplossDays),
      },
      case1: buildCaseStats(
        case1Trades,
        actionableTrades.length,
        (r) => r.stoplossAfterTargetHit === true
      ),
      case2: buildCaseStats(
        case2Trades,
        actionableTrades.length,
        (r) => r.targetAfterStoplossHit === true
      ),
    };
  }

  private computeScenario2Summary(actionableTrades: TradeResult[]): Scenario2Summary | null {
    const eligibleTrades = actionableTrades.filter((r) => r.stoplossHitTillDate === true);
    if (eligibleTrades.length === 0) return null;

    const recoveredToBuyCount = eligibleTrades.filter(
      (r) => r.recoveredToBuyAfterSl === true
    ).length;
    const secondStoplossHitCount = eligibleTrades.filter(
      (r) => r.secondStoplossHit === true
    ).length;

    return {
      eligibleTrades: eligibleTrades.length,
      recoveredToBuyCount,
      recoveredToBuyPct: pct(recoveredToBuyCount, eligibleTrades.length),
      secondStoplossHitCount,
      secondStoplossHitPct: pct(secondStoplossHitCount, recoveredToBuyCount),
    };
  }
}

export const statisticsService = new StatisticsService();
