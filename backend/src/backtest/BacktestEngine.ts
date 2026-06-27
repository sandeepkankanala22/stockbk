import type {
  BacktestConfig,
  InputRow,
  SymbolJob,
  TradeResult,
} from '../types/index.js';
import pLimit from 'p-limit';
import { config as appConfig } from '../config/defaults.js';
import { excelParserService } from '../services/excelParserService.js';
import { yahooFinanceService } from '../services/yahooFinanceService.js';
import { toYahooSymbol } from '../utils/symbolUtils.js';
import { priceMetricsFromBars } from '../utils/tradePriceUtils.js';
import {
  calculateMonthHigh,
  findBreakoutDate,
  findFirstTradingDayNextMonth,
} from './dateUtils.js';
import { calculateStoplossPrice, calculateTargetPrice, roundPrice } from './priceUtils.js';
import { evaluateTrade } from './tradeEvaluator.js';
import {
  analyzeHitSequence,
  analyzeScenario2Recovery,
} from './stoplossAnalysis.js';
import { analyzeInvestorPaths } from './investorPathAnalysis.js';
import { buildAthEvents, buildPricePath } from './pricePathBuilder.js';

export type ProgressCallback = (completed: number, total: number, currentSymbol: string) => void;

export class BacktestEngine {
  extractUniqueSymbols(rows: InputRow[]): SymbolJob[] {
    return excelParserService.extractSymbolJobs(rows).map(({ symbol, minDate }) => ({
      symbol,
      minDate,
      yahooSymbol: toYahooSymbol(symbol),
    }));
  }

  async processSymbol(symbolJob: SymbolJob, config: BacktestConfig): Promise<TradeResult> {
    const base: TradeResult = {
      symbol: symbolJob.symbol,
      minDate: symbolJob.minDate,
      buyPrice: null,
      buyDate: null,
      targetPrice: null,
      stoplossPrice: null,
      result: 'NO_BREAKOUT',
      resultDate: null,
      days: null,
      status: 'SUCCESS',
      errorMessage: null,
      monthHighDate: null,
      breakoutCandleHigh: null,
      exitPrice: null,
      latestClosePrice: null,
      pctFromBuyPrice: null,
      distToNearBand: null,
      investmentAmount: null,
      exitValue: null,
      pnl: null,
      returnPercent: null,
      stoplossHitTillDate: null,
      stoplossHitDate: null,
      stoplossHitDays: null,
      targetHitTillDate: null,
      targetHitDate: null,
      targetHitDays: null,
      firstHit: null,
      firstHitDate: null,
      firstHitDays: null,
      stoplossAfterTargetHit: null,
      stoplossAfterTargetDate: null,
      targetAfterStoplossHit: null,
      targetAfterStoplossDate: null,
      recoveredToBuyAfterSl: null,
      recoveryDate: null,
      secondStoplossHit: null,
      secondStoplossHitDate: null,
      newAthAfterFtt: null,
      lowHitBuyAfterFtt: null,
      lowHitSlAfterFtt: null,
      targetAfterPullbackHit: null,
      targetAfterPullbackDate: null,
      stoplossAfterPullbackHit: null,
      stoplossAfterPullbackDate: null,
      firstHitAfterPullback: null,
      firstHitAfterPullbackDate: null,
      firstHitAfterPullbackDays: null,
      targetAfterRecovery: null,
      newAthAfterRecoveryTarget: null,
      newAthAfterFttDate: null,
      lowHitBuyAfterFttDate: null,
      targetAfterRecoveryDate: null,
      newAthAfterRecoveryTargetDate: null,
      pricePath: null,
      athEvents: null,
    };

    const { bars, error } = await yahooFinanceService.fetchForSymbol(
      symbolJob.symbol,
      symbolJob.minDate
    );

    if (error || bars.length === 0) {
      return {
        ...base,
        result: 'ERROR',
        status: 'ERROR',
        errorMessage: error ?? 'Symbol Not Found',
      };
    }

    const monthHigh = calculateMonthHigh(bars, symbolJob.minDate);
    if (!monthHigh) {
      return {
        ...base,
        result: 'ERROR',
        status: 'ERROR',
        errorMessage: 'No trading data in min date month',
      };
    }

    const buyPrice = roundPrice(monthHigh.price);
    const targetPrice = roundPrice(calculateTargetPrice(buyPrice, config.targetPercent));
    const stoplossPrice = roundPrice(calculateStoplossPrice(buyPrice, config.stoplossPercent));
    const priceMetrics = priceMetricsFromBars(
      buyPrice,
      bars,
      config.nearBuyPlusPct,
      config.nearBuyMinusPct
    );

    const startScanDate = findFirstTradingDayNextMonth(bars, symbolJob.minDate);
    if (!startScanDate) {
      return {
        ...base,
        buyPrice,
        targetPrice,
        stoplossPrice,
        monthHighDate: monthHigh.date,
        result: 'NO_BREAKOUT',
        ...priceMetrics,
      };
    }

    const breakout = findBreakoutDate(bars, startScanDate, buyPrice);
    if (!breakout) {
      return {
        ...base,
        buyPrice,
        targetPrice,
        stoplossPrice,
        monthHighDate: monthHigh.date,
        result: 'NO_BREAKOUT',
        ...priceMetrics,
      };
    }

    const evaluation = evaluateTrade(
      bars,
      breakout.date,
      targetPrice,
      stoplossPrice,
      config.sameDayHitMode
    );

    const hitSeq = analyzeHitSequence(
      bars,
      breakout.date,
      targetPrice,
      stoplossPrice,
      config.sameDayHitMode
    );
    const scenario2 = analyzeScenario2Recovery(
      bars,
      breakout.date,
      buyPrice,
      stoplossPrice,
      targetPrice,
      config.sameDayHitMode
    );
    const investorPaths = analyzeInvestorPaths(
      bars,
      buyPrice,
      targetPrice,
      stoplossPrice,
      hitSeq,
      scenario2,
      config.sameDayHitMode
    );

    let exitPrice: number | null = null;
    if (evaluation.result === 'TARGET') {
      exitPrice = targetPrice;
    } else if (evaluation.result === 'STOPLOSS') {
      exitPrice = stoplossPrice;
    } else if (evaluation.result === 'OPEN') {
      exitPrice = roundPrice(bars[bars.length - 1].close);
    }

    return {
      ...base,
      buyPrice,
      buyDate: breakout.date,
      targetPrice,
      stoplossPrice,
      result: evaluation.result,
      resultDate: evaluation.resultDate,
      days: evaluation.days,
      monthHighDate: monthHigh.date,
      breakoutCandleHigh: roundPrice(breakout.high),
      exitPrice,
      ...priceMetrics,
      stoplossHitTillDate: hitSeq.stoplossHitTillDate,
      stoplossHitDate: hitSeq.stoplossHitDate,
      stoplossHitDays: hitSeq.stoplossHitDays,
      targetHitTillDate: hitSeq.targetHitTillDate,
      targetHitDate: hitSeq.targetHitDate,
      targetHitDays: hitSeq.targetHitDays,
      firstHit: hitSeq.firstHit,
      firstHitDate: hitSeq.firstHitDate,
      firstHitDays: hitSeq.firstHitDays,
      stoplossAfterTargetHit: hitSeq.stoplossAfterTargetHit,
      stoplossAfterTargetDate: hitSeq.stoplossAfterTargetDate,
      targetAfterStoplossHit: hitSeq.targetAfterStoplossHit,
      targetAfterStoplossDate: hitSeq.targetAfterStoplossDate,
      recoveredToBuyAfterSl: scenario2?.recoveredToBuyAfterSl ?? null,
      recoveryDate: scenario2?.recoveryDate ?? null,
      secondStoplossHit: scenario2?.secondStoplossHit ?? null,
      secondStoplossHitDate: scenario2?.secondStoplossHitDate ?? null,
      newAthAfterFtt: investorPaths.newAthAfterFtt,
      lowHitBuyAfterFtt: investorPaths.lowHitBuyAfterFtt,
      lowHitSlAfterFtt: investorPaths.lowHitSlAfterFtt,
      targetAfterPullbackHit: investorPaths.targetAfterPullbackHit,
      targetAfterPullbackDate: investorPaths.targetAfterPullbackDate,
      stoplossAfterPullbackHit: investorPaths.stoplossAfterPullbackHit,
      stoplossAfterPullbackDate: investorPaths.stoplossAfterPullbackDate,
      firstHitAfterPullback: investorPaths.firstHitAfterPullback,
      firstHitAfterPullbackDate: investorPaths.firstHitAfterPullbackDate,
      firstHitAfterPullbackDays: investorPaths.firstHitAfterPullbackDays,
      targetAfterRecovery: investorPaths.targetAfterRecovery,
      newAthAfterRecoveryTarget: investorPaths.newAthAfterRecoveryTarget,
      newAthAfterFttDate: investorPaths.newAthAfterFttDate,
      lowHitBuyAfterFttDate: investorPaths.lowHitBuyAfterFttDate,
      targetAfterRecoveryDate: investorPaths.targetAfterRecoveryDate,
      newAthAfterRecoveryTargetDate: investorPaths.newAthAfterRecoveryTargetDate,
      pricePath: buildPricePath(bars, breakout.date, buyPrice),
      athEvents: buildAthEvents(bars, breakout.date, buyPrice),
    };
  }

  async generateResults(
    symbolJobs: SymbolJob[],
    config: BacktestConfig,
    onProgress?: ProgressCallback
  ): Promise<TradeResult[]> {
    const total = symbolJobs.length;
    let completed = 0;
    const limit = pLimit(appConfig.symbolConcurrency);

    const results = await Promise.all(
      symbolJobs.map((job) =>
        limit(async () => {
          onProgress?.(completed, total, job.symbol);
          const result = await this.processSymbol(job, config);
          completed++;
          onProgress?.(completed, total, job.symbol);
          return result;
        })
      )
    );

    return results;
  }
}

export const backtestEngine = new BacktestEngine();
