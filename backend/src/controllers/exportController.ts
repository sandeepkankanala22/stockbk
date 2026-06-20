import type { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/exportService.js';
import { jobManagerService } from '../services/jobManagerService.js';
import { AppError } from '../middleware/errorHandler.js';

function getCompletedJob(jobId: string): ReturnType<typeof jobManagerService.getJob> {
  const job = jobManagerService.getJob(jobId);
  if (!job) {
    throw new AppError('Job not found', 'JOB_NOT_FOUND', 404);
  }
  if (job.status !== 'completed') {
    throw new AppError('Job is not completed yet', 'JOB_INCOMPLETE', 404);
  }
  return job;
}

export async function exportExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = req.query.jobId as string;
    if (!jobId) {
      throw new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400);
    }

    const job = getCompletedJob(jobId);
    const buffer = await exportService.exportExcel(job!);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nse-backtest-${jobId.slice(0, 8)}-${timestamp}.xlsx"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export function exportCsv(req: Request, res: Response, next: NextFunction): void {
  try {
    const jobId = req.query.jobId as string;
    if (!jobId) {
      throw new AppError('jobId query parameter is required', 'MISSING_JOB_ID', 400);
    }

    const job = getCompletedJob(jobId);
    const csv = exportService.exportCsv(job!);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nse-backtest-${jobId.slice(0, 8)}-${timestamp}.csv"`
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
