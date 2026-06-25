import type { Request, Response, NextFunction } from 'express';
import { jobManagerService } from '../services/jobManagerService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function startBacktest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { uploadId, targetPercent, stoplossPercent, sameDayHitMode, investmentAmount, nearBuyPlusPct, nearBuyMinusPct } = req.body;

    const job = await jobManagerService.startBacktest(uploadId, {
      targetPercent,
      stoplossPercent,
      sameDayHitMode,
      investmentAmount,
      nearBuyPlusPct,
      nearBuyMinusPct,
    });

    res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      symbolCount: job.progress.total,
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = (error as Error & { code: string }).code;
      if (code === 'UPLOAD_NOT_FOUND') {
        next(new AppError(error.message, code, 404));
        return;
      }
      if (code === 'JOB_RUNNING') {
        next(new AppError(error.message, code, 409));
        return;
      }
    }
    next(error);
  }
}

export function getResults(req: Request, res: Response, next: NextFunction): void {
  const jobId = req.query.jobId as string;
  if (!jobId) {
    next(new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400));
    return;
  }

  const job = jobManagerService.getJob(jobId);
  if (!job) {
    next(new AppError('Job not found', 'JOB_NOT_FOUND', 404));
    return;
  }

  if (job.status === 'queued' || job.status === 'running') {
    next(new AppError('Job is still running', 'JOB_RUNNING', 425));
    return;
  }

  res.status(200).json({
    jobId: job.jobId,
    status: job.status,
    results: job.results,
    summary: job.summary,
    config: job.config,
    benchmark: job.benchmark,
    duplicateSymbolNotes: job.duplicateSymbolNotes,
    invalidRows: job.upload.invalidRows,
    errorMessage: job.errorMessage,
  });
}
