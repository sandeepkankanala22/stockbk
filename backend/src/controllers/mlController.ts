import type { Request, Response, NextFunction } from 'express';
import { jobManagerService } from '../services/jobManagerService.js';
import { mlService } from '../services/mlService.js';
import { AppError } from '../middleware/errorHandler.js';

function getCompletedJob(jobId: string) {
  const job = jobManagerService.getJob(jobId);
  if (!job) {
    throw new AppError('Job not found', 'JOB_NOT_FOUND', 404);
  }
  if (job.status !== 'completed') {
    throw new AppError('Backtest must complete before ML operations', 'JOB_NOT_COMPLETE', 425);
  }
  return job;
}

export async function getModelInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const info = await mlService.getModelInfo();
    res.status(200).json({ model: info });
  } catch (error) {
    next(error);
  }
}

export async function trainModel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = req.body.jobId as string;
    if (!jobId) {
      next(new AppError('jobId is required', 'MISSING_JOB_ID', 400));
      return;
    }

    const job = getCompletedJob(jobId);
    const model = await mlService.trainFromJob(job);
    res.status(200).json({ model });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof Error && 'code' in error) {
      const code = (error as Error & { code: string }).code;
      if (code === 'INSUFFICIENT_DATA') {
        next(new AppError(error.message, code, 422));
        return;
      }
    }
    next(error);
  }
}

export async function predictJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = req.body.jobId as string;
    if (!jobId) {
      next(new AppError('jobId is required', 'MISSING_JOB_ID', 400));
      return;
    }

    const job = getCompletedJob(jobId);
    const { predictions, summary } = await mlService.predictForJob(job);
    const results = mlService.attachPredictionsToResults(job.results, predictions);

    res.status(200).json({
      jobId,
      predictions,
      summary,
      results,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof Error && 'code' in error) {
      const code = (error as Error & { code: string }).code;
      if (code === 'MODEL_NOT_FOUND') {
        next(new AppError(error.message, code, 404));
        return;
      }
    }
    next(error);
  }
}

export async function trainAndPredict(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = req.body.jobId as string;
    if (!jobId) {
      next(new AppError('jobId is required', 'MISSING_JOB_ID', 400));
      return;
    }

    const job = getCompletedJob(jobId);
    const model = await mlService.trainFromJob(job);
    const { predictions, summary } = await mlService.predictForJob(job);
    const results = mlService.attachPredictionsToResults(job.results, predictions);

    res.status(200).json({
      jobId,
      model,
      predictions,
      summary,
      results,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    if (error instanceof Error && 'code' in error) {
      const code = (error as Error & { code: string }).code;
      if (code === 'INSUFFICIENT_DATA') {
        next(new AppError(error.message, code, 422));
        return;
      }
    }
    next(error);
  }
}
