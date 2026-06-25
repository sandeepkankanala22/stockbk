import { v4 as uuidv4 } from 'uuid';
import { cacheService } from '../cache/cacheService.js';
import { backtestEngine } from '../backtest/BacktestEngine.js';
import { financeService } from './financeService.js';
import { statisticsService } from './statisticsService.js';
import { earliestBuyDate, fetchNifty50Benchmark } from './benchmarkService.js';
import { excelParserService } from './excelParserService.js';
import {
  attachResultsToDuplicateNotes,
  buildSymbolDuplicateNotes,
} from '../utils/symbolDateSelection.js';
import type {
  BacktestConfig,
  JobState,
  ParsedUpload,
  UploadRecord,
} from '../types/index.js';

class JobManagerService {
  private uploads = new Map<string, UploadRecord>();
  private jobs = new Map<string, JobState>();
  private activeJobId: string | null = null;

  storeUpload(parsed: ParsedUpload): UploadRecord {
    const uploadId = uuidv4();
    const record: UploadRecord = {
      uploadId,
      parsed,
      createdAt: new Date().toISOString(),
    };
    this.uploads.set(uploadId, record);
    return record;
  }

  getUpload(uploadId: string): UploadRecord | undefined {
    return this.uploads.get(uploadId);
  }

  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  getJob(jobId: string): JobState | undefined {
    return this.jobs.get(jobId);
  }

  async startBacktest(uploadId: string, backtestConfig: BacktestConfig): Promise<JobState> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw Object.assign(new Error('Upload not found or expired'), { code: 'UPLOAD_NOT_FOUND' });
    }

    if (this.activeJobId) {
      const active = this.jobs.get(this.activeJobId);
      if (active && (active.status === 'queued' || active.status === 'running')) {
        throw Object.assign(new Error('A backtest is already running'), { code: 'JOB_RUNNING' });
      }
    }

    const symbolJobs = backtestEngine.extractUniqueSymbols(upload.parsed.validRows);
    const jobId = uuidv4();
    const startedAt = new Date().toISOString();

    const job: JobState = {
      jobId,
      uploadId,
      status: 'queued',
      progress: {
        total: symbolJobs.length,
        completed: 0,
        currentSymbol: '',
        percentComplete: 0,
        startedAt,
        etaSeconds: null,
      },
      config: backtestConfig,
      upload: upload.parsed,
      results: [],
      summary: null,
      benchmark: null,
      duplicateSymbolNotes: buildSymbolDuplicateNotes(upload.parsed.validRows),
    };

    this.jobs.set(jobId, job);
    this.activeJobId = jobId;

    setImmediate(() => {
      void this.runJob(jobId, symbolJobs, backtestConfig);
    });

    return job;
  }

  private computeEta(startedAt: string, completed: number, total: number): number | null {
    if (completed < 3 || total === 0) return null;
    const elapsedMs = Date.now() - new Date(startedAt).getTime();
    const avgMs = elapsedMs / completed;
    const remaining = total - completed;
    return Math.round((avgMs * remaining) / 1000);
  }

  private async runJob(
    jobId: string,
    symbolJobs: ReturnType<typeof backtestEngine.extractUniqueSymbols>,
    backtestConfig: BacktestConfig
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';

    try {
      const rawResults = await backtestEngine.generateResults(
        symbolJobs,
        backtestConfig,
        (completed, total, currentSymbol) => {
          const j = this.jobs.get(jobId);
          if (!j) return;
          j.progress.completed = completed;
          j.progress.total = total;
          j.progress.currentSymbol = currentSymbol;
          j.progress.percentComplete =
            total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
          j.progress.etaSeconds = this.computeEta(j.progress.startedAt, completed, total);
        }
      );

      const results = financeService.enrichResults(rawResults, backtestConfig.investmentAmount);
      job.results = results;
      const baseSummary = statisticsService.computeSummary(results);
      job.summary = financeService.applyFinanceToSummary(baseSummary, results, backtestConfig);
      const start = earliestBuyDate(results);
      job.benchmark = start ? await fetchNifty50Benchmark(start) : null;
      job.duplicateSymbolNotes = attachResultsToDuplicateNotes(
        job.duplicateSymbolNotes,
        results
      );
      job.status = 'completed';
      job.progress.percentComplete = 100;
      job.progress.etaSeconds = 0;
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      if (this.activeJobId === jobId) {
        this.activeJobId = null;
      }
    }
  }

  reset(): void {
    this.uploads.clear();
    this.jobs.clear();
    this.activeJobId = null;
    cacheService.clear();
  }
}

export const jobManagerService = new JobManagerService();
