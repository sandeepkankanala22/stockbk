import type { Request, Response, NextFunction } from 'express';
import { scannerJobManager } from '../scanner/scannerJobManager.js';
import { isValidScannerPeriod } from '../scanner/scannerPeriod.js';
import {
  getScannerOptions,
  isValidScannerSector,
  isValidScannerUniverse,
  searchScannerSymbols,
} from '../scanner/scannerUniverse.js';
import type { ScannerPeriod, ScannerSector, ScannerUniverse } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';

export async function getScannerOptionsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const options = await getScannerOptions();
    res.status(200).json(options);
  } catch (error) {
    next(error);
  }
}

export async function searchScannerSymbolsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.status(200).json({ results: [] });
      return;
    }
    const results = await searchScannerSymbols(q);
    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
}

export async function startScanner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const period = (req.body?.period ?? '1y') as ScannerPeriod;
    const universe = (req.body?.universe ?? 'nifty100') as ScannerUniverse;
    const sector = (req.body?.sector ?? 'all') as ScannerSector;
    const customSymbols = Array.isArray(req.body?.symbols)
      ? (req.body.symbols as unknown[])
          .map((s) => String(s).trim().toUpperCase())
          .filter((s) => s.length > 0)
      : [];

    if (!isValidScannerPeriod(period)) {
      next(new AppError('Invalid period. Use 6m, 1y, 3y, 5y, or all', 'INVALID_PERIOD', 400));
      return;
    }
    if (!isValidScannerUniverse(universe)) {
      next(new AppError('Invalid universe. Use nifty100, nifty500, all, or custom', 'INVALID_UNIVERSE', 400));
      return;
    }
    if (!isValidScannerSector(sector)) {
      next(new AppError('Invalid sector', 'INVALID_SECTOR', 400));
      return;
    }
    if (universe === 'custom' && customSymbols.length === 0) {
      next(new AppError('Custom list requires at least one symbol', 'INVALID_SYMBOLS', 400));
      return;
    }

    const job = await scannerJobManager.startScan(
      period,
      universe,
      sector,
      universe === 'custom' ? customSymbols : undefined
    );
    res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      period: job.period,
      universe: job.universe,
      sector: job.sector,
      progress: job.progress,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'SCANNER_RUNNING') {
      next(new AppError(error.message, 'SCANNER_RUNNING', 409));
      return;
    }
    next(error);
  }
}

export function getScannerStatus(req: Request, res: Response, next: NextFunction): void {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    next(new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400));
    return;
  }

  const job = scannerJobManager.getJob(jobId);
  if (!job) {
    next(new AppError('Scanner job not found', 'JOB_NOT_FOUND', 404));
    return;
  }

  res.status(200).json({
    jobId: job.jobId,
    status: job.status,
    period: job.period,
    universe: job.universe,
    sector: job.sector,
    progress: job.progress,
    signalCount: job.signals.length,
    signalsFoundCount: job.signalsFoundCount ?? job.signals.length,
    signals: job.signals,
    errorMessage: job.errorMessage,
  });
}

export function getScannerResults(req: Request, res: Response, next: NextFunction): void {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    next(new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400));
    return;
  }

  const job = scannerJobManager.getJob(jobId);
  if (!job) {
    next(new AppError('Scanner job not found', 'JOB_NOT_FOUND', 404));
    return;
  }

  res.status(200).json({
    jobId: job.jobId,
    status: job.status,
    period: job.period,
    universe: job.universe,
    sector: job.sector,
    signals: job.signals,
    errorMessage: job.errorMessage,
  });
}

export function exportScannerCsv(req: Request, res: Response, next: NextFunction): void {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    next(new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400));
    return;
  }

  const job = scannerJobManager.getJob(jobId);
  if (!job) {
    next(new AppError('Scanner job not found', 'JOB_NOT_FOUND', 404));
    return;
  }

  if (job.status !== 'completed' && job.status !== 'running') {
    next(new AppError('Scanner job not ready for export', 'JOB_NOT_READY', 400));
    return;
  }

  if (job.signals.length === 0) {
    next(new AppError('No signals to export yet', 'NO_SIGNALS', 400));
    return;
  }

  const csv = scannerJobManager.signalsToCsv(job.signals);
  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="chartink-scanner-${jobId.slice(0, 8)}-${timestamp}.csv"`
  );
  res.send(csv);
}
