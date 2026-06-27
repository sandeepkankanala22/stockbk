import pLimit from 'p-limit';
import { config } from '../config/defaults.js';
import { cacheService } from '../cache/cacheService.js';
import type { OhlcvBar } from '../types/index.js';
import { startOfMonthIso, todayIso } from '../utils/dateParser.js';
import { isRateLimitError, withRetry } from '../utils/retry.js';
import { toYahooSymbols, toYahooSymbolsPreferBare } from '../utils/symbolUtils.js';
import { fetchYahooChart } from './yahooChartClient.js';

type FetchResult = { bars: OhlcvBar[]; error?: string };

export class YahooFinanceService {
  private limit = pLimit(config.yahooConcurrency);
  private inflight = new Map<string, Promise<FetchResult>>();
  private queueTail: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;
  private rateLimitUntil = 0;

  private async waitForRateLimitCooldown(): Promise<void> {
    const wait = this.rateLimitUntil - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  private scheduleThrottled<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      await this.waitForRateLimitCooldown();
      const now = Date.now();
      const wait = Math.max(0, config.yahooMinIntervalMs - (now - this.lastRequestAt));
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastRequestAt = Date.now();
      return fn();
    };

    const next = this.queueTail.then(run, run);
    this.queueTail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async fetchFromYahoo(
    yahooSymbol: string,
    period1: string,
    period2: string
  ): Promise<FetchResult> {
    const fetchStart = Date.now();
    try {
      const bars = await this.limit(() =>
        this.scheduleThrottled(() =>
          withRetry(
            () => fetchYahooChart(yahooSymbol, period1, period2),
            config.yahooRetryAttempts,
            config.yahooRetryBaseDelayMs,
            config.yahooRateLimitWaitMs
          )
        )
      );

      if (bars.length === 0) {
        return { bars: [], error: 'Symbol Not Found' };
      }

      cacheService.set(yahooSymbol, period1, period2, bars);
      void cacheService.setToDisk(yahooSymbol, bars);

      // #region agent log
      fetch('http://127.0.0.1:7542/ingest/38dceb47-4325-4db9-870b-5ac797cdab44',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d96eef'},body:JSON.stringify({sessionId:'d96eef',location:'yahooFinanceService.ts:fetchFromYahoo',message:'Yahoo fetch success',data:{yahooSymbol,barCount:bars.length,elapsedMs:Date.now()-fetchStart,cached:false,source:'direct-api'},timestamp:Date.now(),hypothesisId:'FIX',runId:'direct-api'})}).catch(()=>{});
      // #endregion

      return { bars };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (isRateLimitError(error)) {
        this.rateLimitUntil = Date.now() + config.yahooRateLimitWaitMs;
      }
      // #region agent log
      fetch('http://127.0.0.1:7542/ingest/38dceb47-4325-4db9-870b-5ac797cdab44',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d96eef'},body:JSON.stringify({sessionId:'d96eef',location:'yahooFinanceService.ts:fetchFromYahoo',message:'Yahoo fetch failed',data:{yahooSymbol,period1,period2,errMsg,elapsedMs:Date.now()-fetchStart,source:'direct-api'},timestamp:Date.now(),hypothesisId:'B',runId:'direct-api'})}).catch(()=>{});
      // #endregion
      if (isRateLimitError(error)) {
        return { bars: [], error: 'Yahoo rate limit exceeded - wait and retry' };
      }
      return { bars: [], error: errMsg.includes('HTTP') ? 'Symbol Not Found' : errMsg };
    }
  }

  async fetchHistoricalData(
    yahooSymbol: string,
    minDate: string
  ): Promise<FetchResult> {
    const period1 = startOfMonthIso(minDate);
    const period2 = todayIso();
    const cacheKey = `${yahooSymbol}:${period1}:${period2}`;

    const cached = cacheService.get(yahooSymbol, period1, period2);
    if (cached) {
      return { bars: cached };
    }

    const diskCached = await cacheService.getFromDisk(yahooSymbol);
    if (diskCached && diskCached.length > 0) {
      cacheService.set(yahooSymbol, period1, period2, diskCached);
      return { bars: diskCached };
    }

    const inflight = this.inflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = this.fetchFromYahoo(yahooSymbol, period1, period2);
    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /** Try NSE (.NS) then BSE (.BO) for bare symbols. */
  async fetchForSymbol(
    symbol: string,
    minDate: string,
    options?: { preferBare?: boolean }
  ): Promise<FetchResult> {
    const candidates = options?.preferBare
      ? toYahooSymbolsPreferBare(symbol)
      : toYahooSymbols(symbol);
    let lastError: string | undefined;

    for (const yahooSymbol of candidates) {
      const result = await this.fetchHistoricalData(yahooSymbol, minDate);
      if (!result.error && result.bars.length > 0) {
        return result;
      }
      if (result.error) {
        lastError = result.error;
        if (result.error.includes('rate limit')) {
          return result;
        }
      }
    }

    return {
      bars: [],
      error: lastError ?? 'Symbol not found on NSE or BSE',
    };
  }

  /** Monthly OHLC for scanner (interval=1mo). */
  async fetchMonthlyForSymbol(
    symbol: string,
    startDate: string,
    options?: { preferBare?: boolean }
  ): Promise<FetchResult> {
    const candidates = options?.preferBare
      ? toYahooSymbolsPreferBare(symbol)
      : toYahooSymbols(symbol);
    const period1 = startOfMonthIso(startDate);
    const period2 = todayIso();
    let lastError: string | undefined;

    for (const yahooSymbol of candidates) {
      const cacheKey = `${yahooSymbol}:mo:${period1}:${period2}`;
      const cached = cacheService.get(yahooSymbol, `mo:${period1}`, period2);
      if (cached) {
        return { bars: cached };
      }

      const inflight = this.inflight.get(cacheKey);
      if (inflight) {
        const result = await inflight;
        if (!result.error && result.bars.length > 0) return result;
      }

      const promise = this.scheduleThrottled(() =>
        withRetry(
          () => fetchYahooChart(yahooSymbol, period1, period2, '1mo'),
          config.yahooRetryAttempts,
          config.yahooRetryBaseDelayMs,
          config.yahooRateLimitWaitMs
        )
      )
        .then((bars) => {
          if (bars.length === 0) {
            return { bars: [], error: 'Symbol Not Found' } as FetchResult;
          }
          cacheService.set(yahooSymbol, `mo:${period1}`, period2, bars);
          return { bars } as FetchResult;
        })
        .catch((error) => {
          const errMsg = error instanceof Error ? error.message : String(error);
          if (isRateLimitError(error)) {
            this.rateLimitUntil = Date.now() + config.yahooRateLimitWaitMs;
            return { bars: [], error: 'Yahoo rate limit exceeded - wait and retry' };
          }
          return { bars: [], error: errMsg };
        });

      this.inflight.set(cacheKey, promise);
      try {
        const result = await promise;
        if (!result.error && result.bars.length > 0) {
          return result;
        }
        if (result.error) {
          lastError = result.error;
          if (result.error.includes('rate limit')) return result;
        }
      } finally {
        this.inflight.delete(cacheKey);
      }
    }

    return { bars: [], error: lastError ?? 'Symbol not found on NSE or BSE' };
  }
}

export const yahooFinanceService = new YahooFinanceService();
