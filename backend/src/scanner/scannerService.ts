import pLimit from 'p-limit';
import { config } from '../config/defaults.js';
import type { ScannerSignal } from '../types/index.js';
import { yahooFinanceService } from '../services/yahooFinanceService.js';
import { findTechnicalSignalMonths, MIN_MONTHS_FOR_SCAN } from './chartinkConditions.js';
import { aggregateDailyToMonthly, normalizeYahooMonthlyBars } from './monthlyBars.js';
import { buildSignalMetrics } from './signalMetrics.js';
import {
  historyFetchStart,
  signalCutoffDate,
  type ScannerPeriod,
} from './scannerPeriod.js';
import {
  resolveScannerSymbols,
  isInternationalUniverse,
  type ScannerSector,
  type ScannerUniverse,
} from './scannerUniverse.js';

export interface ScannerProgress {
  total: number;
  completed: number;
  currentSymbol: string;
  percentComplete: number;
  signalsFound: number;
  newSignals?: ScannerSignal[];
}

export class ScannerService {
  async scanAll(
    period: ScannerPeriod,
    universe: ScannerUniverse,
    sector: ScannerSector,
    customSymbols: string[] | undefined,
    onProgress: (progress: ScannerProgress) => void
  ): Promise<ScannerSignal[]> {
    const symbols = await resolveScannerSymbols(universe, sector, customSymbols);
    const limit = pLimit(config.scannerConcurrency);
    const allSignals: ScannerSignal[] = [];
    let completed = 0;
    const cutoff = signalCutoffDate(period);
    const fetchStart = historyFetchStart(period);

    const tasks = symbols.map((row) =>
      limit(async () => {
        onProgress({
          total: symbols.length,
          completed,
          currentSymbol: row.symbol,
          percentComplete: Math.round((completed / symbols.length) * 100),
          signalsFound: allSignals.length,
        });

        try {
          const symbolSignals = await this.scanSymbol(
            row.symbol,
            row.company,
            fetchStart,
            cutoff,
            isInternationalUniverse(universe)
          );
          if (symbolSignals.length > 0) {
            allSignals.push(...symbolSignals);
            onProgress({
              total: symbols.length,
              completed,
              currentSymbol: row.symbol,
              percentComplete: Math.round((completed / symbols.length) * 100),
              signalsFound: allSignals.length,
              newSignals: symbolSignals,
            });
          }
        } catch {
          // skip symbol on error
        } finally {
          completed += 1;
          onProgress({
            total: symbols.length,
            completed,
            currentSymbol: row.symbol,
            percentComplete: Math.round((completed / symbols.length) * 100),
            signalsFound: allSignals.length,
          });
        }
      })
    );

    await Promise.all(tasks);

    return allSignals.sort((a, b) => a.signalDate.localeCompare(b.signalDate));
  }

  async scanSymbol(
    symbol: string,
    company: string,
    fetchStart: string,
    signalAfterDate: string | null,
    preferBare = false
  ): Promise<ScannerSignal[]> {
    let monthly = await this.loadMonthlyBars(symbol, fetchStart, preferBare);
    if (monthly.length <= MIN_MONTHS_FOR_SCAN) return [];

    const technical = findTechnicalSignalMonths(monthly, signalAfterDate);
    if (technical.length === 0) return [];

    return technical.map((hit) => buildSignalMetrics(symbol, company, monthly, hit.index));
  }

  private async loadMonthlyBars(symbol: string, fetchStart: string, preferBare = false) {
    const fetchOpts = preferBare ? { preferBare: true } : undefined;
    const dailyResult = await yahooFinanceService.fetchForSymbol(symbol, fetchStart, fetchOpts);
    if (!dailyResult.error && dailyResult.bars.length > 0) {
      const fromDaily = aggregateDailyToMonthly(dailyResult.bars);
      if (fromDaily.length > MIN_MONTHS_FOR_SCAN) return fromDaily;
    }

    const monthlyResult = await yahooFinanceService.fetchMonthlyForSymbol(
      symbol,
      fetchStart,
      fetchOpts
    );
    if (!monthlyResult.error && monthlyResult.bars.length > 0) {
      const monthly = normalizeYahooMonthlyBars(monthlyResult.bars);
      if (monthly.length > MIN_MONTHS_FOR_SCAN) return monthly;
    }

    if (!dailyResult.error && dailyResult.bars.length > 0) {
      return aggregateDailyToMonthly(dailyResult.bars);
    }

    return [];
  }
}

export const scannerService = new ScannerService();
