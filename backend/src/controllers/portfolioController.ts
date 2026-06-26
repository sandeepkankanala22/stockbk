import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.js';
import { isValidScannerPeriod } from '../scanner/scannerPeriod.js';
import {
  isValidScannerSector,
  isValidScannerUniverse,
} from '../scanner/scannerUniverse.js';
import {
  runPortfolioComparison,
  type PortfolioSimulateRequest,
} from '../portfolio/portfolioService.js';
import {
  runBacktestPortfolioComparison,
  type BacktestPortfolioRequest,
} from '../portfolio/backtestPortfolioService.js';
import type { ScannerPeriod, ScannerSector, ScannerUniverse } from '../types/index.js';

function parsePositive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function simulatePortfolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const initialCapital = Number(req.body?.initialCapital);
    if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
      next(new AppError('Initial capital must be a positive number', 'INVALID_CAPITAL', 400));
      return;
    }

    const request: PortfolioSimulateRequest = {
      scannerJobId:
        typeof req.body?.scannerJobId === 'string' ? req.body.scannerJobId : undefined,
      initialCapital,
      maxHoldings: parsePositive(req.body?.maxHoldings, 20),
      targetPercent: parsePositive(req.body?.targetPercent, 30),
      stoplossPercent: parsePositive(req.body?.stoplossPercent, 30),
    };

    if (req.body?.scan) {
      const period = (req.body.scan.period ?? '1y') as ScannerPeriod;
      const universe = (req.body.scan.universe ?? 'nifty100') as ScannerUniverse;
      const sector = (req.body.scan.sector ?? 'all') as ScannerSector;
      const symbols = Array.isArray(req.body.scan.symbols)
        ? (req.body.scan.symbols as unknown[])
            .map((s) => String(s).trim().toUpperCase())
            .filter((s) => s.length > 0)
        : undefined;

      if (!isValidScannerPeriod(period)) {
        next(new AppError('Invalid scan period', 'INVALID_PERIOD', 400));
        return;
      }
      if (!isValidScannerUniverse(universe)) {
        next(new AppError('Invalid scan universe', 'INVALID_UNIVERSE', 400));
        return;
      }
      if (!isValidScannerSector(sector)) {
        next(new AppError('Invalid scan sector', 'INVALID_SECTOR', 400));
        return;
      }
      if (universe === 'custom' && (!symbols || symbols.length === 0)) {
        next(new AppError('Custom scan requires symbols', 'INVALID_SYMBOLS', 400));
        return;
      }

      request.scan = { period, universe, sector, symbols };
    }

    if (!request.scannerJobId && !request.scan) {
      next(
        new AppError(
          'Provide scannerJobId from a completed scan or scan parameters',
          'MISSING_SIGNALS',
          400
        )
      );
      return;
    }

    const result = await runPortfolioComparison(request);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as { code?: string }).code;
      if (code === 'JOB_NOT_FOUND') {
        next(new AppError(error.message, code, 404));
        return;
      }
      if (code === 'JOB_NOT_READY' || code === 'MISSING_SIGNALS') {
        next(new AppError(error.message, code, 400));
        return;
      }
    }
    next(error);
  }
}

export async function simulateBacktestPortfolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const backtestJobId = req.body?.backtestJobId as string;
    const initialCapital = Number(req.body?.initialCapital);

    if (!backtestJobId || typeof backtestJobId !== 'string') {
      next(new AppError('backtestJobId is required', 'MISSING_JOB_ID', 400));
      return;
    }
    if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
      next(new AppError('Initial capital must be a positive number', 'INVALID_CAPITAL', 400));
      return;
    }

    const request: BacktestPortfolioRequest = {
      backtestJobId,
      initialCapital,
      maxHoldings: parsePositive(req.body?.maxHoldings, 20),
      targetPercent:
        req.body?.targetPercent != null
          ? parsePositive(req.body.targetPercent, 30)
          : undefined,
      stoplossPercent:
        req.body?.stoplossPercent != null
          ? parsePositive(req.body.stoplossPercent, 30)
          : undefined,
    };

    const result = await runBacktestPortfolioComparison(request);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      const code = (error as { code?: string }).code;
      if (code === 'JOB_NOT_FOUND') {
        next(new AppError(error.message, code, 404));
        return;
      }
      if (code === 'JOB_NOT_READY') {
        next(new AppError(error.message, code, 400));
        return;
      }
    }
    next(error);
  }
}
