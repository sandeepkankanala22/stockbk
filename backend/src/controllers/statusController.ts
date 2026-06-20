import type { Request, Response, NextFunction } from 'express';
import { jobManagerService } from '../services/jobManagerService.js';
import { AppError } from '../middleware/errorHandler.js';

export function getStatus(req: Request, res: Response, next: NextFunction): void {
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

  res.status(200).json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    errorMessage: job.errorMessage,
  });
}
