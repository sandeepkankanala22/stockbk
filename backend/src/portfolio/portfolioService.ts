import pLimit from 'p-limit';
import { config } from '../config/defaults.js';
import { scannerJobManager } from '../scanner/scannerJobManager.js';
import { scannerService } from '../scanner/scannerService.js';
import type {
  PortfolioComparisonResponse,
  PortfolioSimConfig,
  ScannerPeriod,
  ScannerSector,
  ScannerSignal,
  ScannerUniverse,
} from '../types/index.js';
import { resolveSignalExitPlan } from './portfolioExitResolver.js';
import { runPortfolioSimulation } from './portfolioSimulator.js';

export interface PortfolioSimulateRequest {
  scannerJobId?: string;
  scan?: {
    period: ScannerPeriod;
    universe: ScannerUniverse;
    sector: ScannerSector;
    symbols?: string[];
  };
  initialCapital: number;
  maxHoldings?: number;
  targetPercent?: number;
  stoplossPercent?: number;
}

function buildConfig(body: PortfolioSimulateRequest): PortfolioSimConfig {
  return {
    initialCapital: body.initialCapital,
    maxHoldings: body.maxHoldings ?? 20,
    targetPercent: body.targetPercent ?? 30,
    stoplossPercent: body.stoplossPercent ?? 30,
  };
}

async function loadSignals(request: PortfolioSimulateRequest): Promise<ScannerSignal[]> {
  if (request.scannerJobId) {
    const job = scannerJobManager.getJob(request.scannerJobId);
    if (!job) {
      throw Object.assign(new Error('Scanner job not found'), { code: 'JOB_NOT_FOUND' });
    }
    if (job.status !== 'completed') {
      throw Object.assign(new Error('Scanner job not completed yet'), { code: 'JOB_NOT_READY' });
    }
    return job.signals;
  }

  if (request.scan) {
    const { period, universe, sector, symbols } = request.scan;
    return scannerService.scanAll(period, universe, sector, symbols, () => undefined);
  }

  throw Object.assign(new Error('Provide scannerJobId or scan parameters'), {
    code: 'MISSING_SIGNALS',
  });
}

export async function runPortfolioComparison(
  request: PortfolioSimulateRequest
): Promise<PortfolioComparisonResponse> {
  const simConfig = buildConfig(request);
  const signals = await loadSignals(request);

  if (signals.length === 0) {
    const empty = runPortfolioSimulation([], simConfig, 'compound');
    return {
      signalCount: 0,
      simulationStart: null,
      simulationEnd: null,
      compound: empty,
      withdrawPrincipal: runPortfolioSimulation([], simConfig, 'withdraw_principal'),
    };
  }

  const limit = pLimit(config.scannerConcurrency);
  const plans = (
    await Promise.all(
      signals.map((signal) =>
        limit(() =>
          resolveSignalExitPlan(signal, simConfig.targetPercent, simConfig.stoplossPercent)
        )
      )
    )
  ).filter((p): p is NonNullable<typeof p> => p != null);

  const compound = runPortfolioSimulation(plans, simConfig, 'compound');
  const withdrawPrincipal = runPortfolioSimulation(plans, simConfig, 'withdraw_principal');

  const dates = plans.map((p) => p.signalDate).sort();

  return {
    signalCount: signals.length,
    simulationStart: dates[0] ?? null,
    simulationEnd: dates[dates.length - 1] ?? null,
    compound,
    withdrawPrincipal,
  };
}
