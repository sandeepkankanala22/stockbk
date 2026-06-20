import type { FinanceSummary, BacktestConfig, DashboardSummary, TradeResult } from '../types/index.js';
import { dayjs } from '../utils/dateParser.js';
import { roundPrice } from '../backtest/priceUtils.js';

function resolveExitPrice(result: TradeResult): number | null {
  if (result.exitPrice != null) return result.exitPrice;
  if (result.buyPrice == null) return null;

  switch (result.result) {
    case 'TARGET':
      return result.targetPrice;
    case 'STOPLOSS':
      return result.stoplossPrice;
    case 'OPEN':
      return result.exitPrice;
    default:
      return null;
  }
}

export class FinanceService {
  enrichResults(results: TradeResult[], investmentAmount: number): TradeResult[] {
    return results.map((trade) => this.enrichTrade(trade, investmentAmount));
  }

  private enrichTrade(trade: TradeResult, investmentAmount: number): TradeResult {
    const base = {
      ...trade,
      investmentAmount: null as number | null,
      exitPrice: trade.exitPrice,
      exitValue: null as number | null,
      pnl: null as number | null,
      returnPercent: null as number | null,
    };

    if (
      trade.buyPrice == null ||
      trade.buyDate == null ||
      trade.result === 'NO_BREAKOUT' ||
      trade.result === 'ERROR' ||
      investmentAmount <= 0
    ) {
      return base;
    }

    const exit = resolveExitPrice(trade);
    if (exit == null || trade.buyPrice <= 0) {
      return base;
    }

    const quantity = investmentAmount / trade.buyPrice;
    const exitValue = roundPrice(quantity * exit, 2);
    const pnl = roundPrice(exitValue - investmentAmount, 2);
    const returnPercent = roundPrice((pnl / investmentAmount) * 100, 2);

    return {
      ...base,
      investmentAmount,
      exitPrice: exit,
      exitValue,
      pnl,
      returnPercent,
    };
  }

  computeFinanceSummary(
    results: TradeResult[],
    investmentAmount: number
  ): FinanceSummary | null {
    if (investmentAmount <= 0) return null;

    const executed = results.filter(
      (r) =>
        r.buyDate != null &&
        r.buyPrice != null &&
        r.exitValue != null &&
        r.result !== 'NO_BREAKOUT' &&
        r.result !== 'ERROR'
    );

    if (executed.length === 0) {
      return {
        investmentPerTrade: investmentAmount,
        totalInvested: 0,
        totalExitValue: 0,
        totalPnl: 0,
        roiPercent: 0,
        cagrPercent: null,
        periodStart: null,
        periodEnd: null,
        periodYears: null,
      };
    }

    const totalInvested = roundPrice(executed.length * investmentAmount, 2);
    const totalExitValue = roundPrice(
      executed.reduce((sum, r) => sum + (r.exitValue ?? 0), 0),
      2
    );
    const totalPnl = roundPrice(totalExitValue - totalInvested, 2);
    const roiPercent = roundPrice((totalPnl / totalInvested) * 100, 2);

    const buyDates = executed.map((r) => r.buyDate as string).sort();
    const endDates = executed
      .map((r) => r.resultDate ?? r.buyDate)
      .filter((d): d is string => d != null)
      .sort();

    const periodStart = buyDates[0] ?? null;
    const periodEnd = endDates[endDates.length - 1] ?? null;

    let cagrPercent: number | null = null;
    let periodYears: number | null = null;

    if (periodStart && periodEnd && totalInvested > 0) {
      const years = dayjs(periodEnd).diff(dayjs(periodStart), 'day') / 365.25;
      periodYears = roundPrice(years, 4);
      if (years > 0) {
        const growthFactor = totalExitValue / totalInvested;
        cagrPercent = roundPrice((Math.pow(growthFactor, 1 / years) - 1) * 100, 2);
      }
    }

    return {
      investmentPerTrade: investmentAmount,
      totalInvested,
      totalExitValue,
      totalPnl,
      roiPercent,
      cagrPercent,
      periodStart,
      periodEnd,
      periodYears,
    };
  }

  applyFinanceToSummary(
    summary: DashboardSummary,
    results: TradeResult[],
    config: BacktestConfig
  ): DashboardSummary {
    const finance = this.computeFinanceSummary(results, config.investmentAmount);
    return { ...summary, finance };
  }
}

export const financeService = new FinanceService();
