import pLimit from 'p-limit';
import { config } from '../config/defaults.js';
import { jobManagerService } from '../services/jobManagerService.js';
import type {
  BacktestPortfolioComparison,
  PortfolioSimConfig,
  TradeResult,
} from '../types/index.js';
import { resolveEntryExitPlan } from './portfolioExitResolver.js';
import { runPortfolioSimulation } from './portfolioSimulator.js';

export interface BacktestPortfolioRequest {
  backtestJobId: string;
  initialCapital: number;
  maxHoldings?: number;
  targetPercent?: number;
  stoplossPercent?: number;
}

export interface EntryCandidate {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  entryType: 'signal_buy' | 'pullback_buy';
  /** Backtest row id: symbol + signal (min) date */
  tradeKey: string;
}

export function buildSignalBuyEntries(trades: TradeResult[]): EntryCandidate[] {
  return trades
    .filter(
      (t) =>
        t.buyDate &&
        t.buyPrice != null &&
        t.status === 'SUCCESS' &&
        t.result !== 'NO_BREAKOUT' &&
        t.result !== 'ERROR'
    )
    .map((t) => ({
      symbol: t.symbol,
      entryDate: t.buyDate!,
      entryPrice: t.buyPrice!,
      entryType: 'signal_buy' as const,
      tradeKey: `${t.symbol}:${t.minDate}`,
    }));
}

/**
 * First pullback to buy price after FTT only (lowHitBuyAfterFttDate).
 * Later pullbacks before target are ignored — matches investor dashboard logic.
 */
export function buildPullbackBuyEntries(trades: TradeResult[]): EntryCandidate[] {
  return trades
    .filter(
      (t) =>
        t.lowHitBuyAfterFttDate &&
        t.lowHitBuyAfterFtt === true &&
        t.buyPrice != null &&
        t.targetHitDate &&
        t.firstHit === 'TARGET' &&
        t.status === 'SUCCESS' &&
        t.lowHitBuyAfterFttDate > t.targetHitDate
    )
    .map((t) => ({
      symbol: t.symbol,
      entryDate: t.lowHitBuyAfterFttDate!,
      entryPrice: t.buyPrice!,
      entryType: 'pullback_buy' as const,
      tradeKey: `${t.symbol}:${t.minDate}`,
    }));
}

/** One breakout buy + at most one first-FTT-pullback buy per backtest signal row. */
export function buildCombinedPortfolioEntries(trades: TradeResult[]): EntryCandidate[] {
  const signal = buildSignalBuyEntries(trades);
  const pullback = buildPullbackBuyEntries(trades);
  return dedupeEntries([...signal, ...pullback]);
}

function dedupeEntries(entries: EntryCandidate[]): EntryCandidate[] {
  const seen = new Set<string>();
  const out: EntryCandidate[] = [];
  for (const e of entries.sort((a, b) => a.entryDate.localeCompare(b.entryDate))) {
    const key = `${e.entryType}:${e.symbol}:${e.entryDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

async function resolvePlans(
  entries: EntryCandidate[],
  targetPercent: number,
  stoplossPercent: number
) {
  const limit = pLimit(config.scannerConcurrency);
  return (
    await Promise.all(
      entries.map((e) =>
        limit(() =>
          resolveEntryExitPlan(e.symbol, e.entryDate, e.entryPrice, targetPercent, stoplossPercent)
        )
      )
    )
  ).filter((p): p is NonNullable<typeof p> => p != null);
}

export async function runBacktestPortfolioComparison(
  request: BacktestPortfolioRequest
): Promise<BacktestPortfolioComparison> {
  const job = jobManagerService.getJob(request.backtestJobId);
  if (!job) {
    throw Object.assign(new Error('Backtest job not found'), { code: 'JOB_NOT_FOUND' });
  }
  if (job.status !== 'completed') {
    throw Object.assign(new Error('Backtest job not completed'), { code: 'JOB_NOT_READY' });
  }

  const simConfig: PortfolioSimConfig = {
    initialCapital: request.initialCapital,
    maxHoldings: request.maxHoldings ?? 20,
    targetPercent: request.targetPercent ?? job.config.targetPercent,
    stoplossPercent: request.stoplossPercent ?? job.config.stoplossPercent,
    enforceMaxHoldings: true,
  };

  const trades = job.results;
  const signalEntries = buildSignalBuyEntries(trades);
  const pullbackEntries = buildPullbackBuyEntries(trades);
  const combinedEntries = buildCombinedPortfolioEntries(trades);

  const [signalPlans, combinedPlans] = await Promise.all([
    resolvePlans(signalEntries, simConfig.targetPercent, simConfig.stoplossPercent),
    resolvePlans(combinedEntries, simConfig.targetPercent, simConfig.stoplossPercent),
  ]);

  const case1 = runPortfolioSimulation(signalPlans, simConfig, 'compound');
  const case2 = runPortfolioSimulation(signalPlans, simConfig, 'withdraw_principal');
  const case3Compound = runPortfolioSimulation(combinedPlans, simConfig, 'compound');
  const case3Withdraw = runPortfolioSimulation(combinedPlans, simConfig, 'withdraw_principal');

  const case4Config: PortfolioSimConfig = { ...simConfig, enforceMaxHoldings: false };
  const case4 = runPortfolioSimulation(combinedPlans, case4Config, 'compound');

  const dates = combinedPlans.map((p) => p.signalDate).sort();

  return {
    signalCount: signalEntries.length,
    pullbackEntryCount: pullbackEntries.length,
    combinedEntryCount: combinedEntries.length,
    simulationStart: dates[0] ?? null,
    simulationEnd: dates[dates.length - 1] ?? null,
    config: simConfig,
    case1,
    case2,
    case3Compound,
    case3Withdraw,
    case4,
  };
}
