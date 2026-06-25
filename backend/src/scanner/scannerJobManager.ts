import { v4 as uuidv4 } from 'uuid';
import type { ScannerJobState, ScannerPeriod, ScannerSector, ScannerSignal, ScannerUniverse } from '../types/index.js';
import { scannerService, type ScannerProgress } from './scannerService.js';

class ScannerJobManager {
  private jobs = new Map<string, ScannerJobState>();
  private activeJobId: string | null = null;

  getJob(jobId: string): ScannerJobState | undefined {
    return this.jobs.get(jobId);
  }

  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  async startScan(
    period: ScannerPeriod,
    universe: ScannerUniverse,
    sector: ScannerSector,
    customSymbols?: string[]
  ): Promise<ScannerJobState> {
    if (this.activeJobId) {
      const active = this.jobs.get(this.activeJobId);
      if (active && (active.status === 'queued' || active.status === 'running')) {
        throw Object.assign(new Error('A scanner job is already running'), {
          code: 'SCANNER_RUNNING',
        });
      }
    }

    const jobId = uuidv4();
    const startedAt = new Date().toISOString();
    const job: ScannerJobState = {
      jobId,
      period,
      universe,
      sector,
      customSymbols: universe === 'custom' ? customSymbols : undefined,
      status: 'queued',
      progress: {
        total: 0,
        completed: 0,
        currentSymbol: '',
        percentComplete: 0,
        startedAt,
        etaSeconds: null,
      },
      signals: [],
      startedAt,
    };

    this.jobs.set(jobId, job);
    this.activeJobId = jobId;

    void this.runJob(jobId);

    return job;
  }

  private async runJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';

    try {
      const signals = await scannerService.scanAll(
        job.period,
        job.universe,
        job.sector,
        job.customSymbols,
        (progress: ScannerProgress) => {
          job.progress = {
            total: progress.total,
            completed: progress.completed,
            currentSymbol: progress.currentSymbol,
            percentComplete: progress.percentComplete,
            startedAt: job.startedAt,
            etaSeconds: null,
          };
          if (progress.newSignals?.length) {
            job.signals.push(...progress.newSignals);
          }
          job.signalsFoundCount = job.signals.length;
        }
      );
      job.signals = signals;
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.progress.percentComplete = 100;
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date().toISOString();
    } finally {
      if (this.activeJobId === jobId) {
        this.activeJobId = null;
      }
    }
  }

  signalsToCsv(signals: ScannerSignal[]): string {
    const headers = [
      'Symbol',
      'Company',
      'Signal Date',
      'Entry Price',
      'Current Price',
      'Return %',
      '3 Month Return %',
      '6 Month Return %',
      '12 Month Return %',
      'Max Gain %',
      'Max Drawdown %',
    ];
    const lines = [headers.join(',')];
    for (const s of signals) {
      lines.push(
        [
          s.symbol,
          `"${s.company.replace(/"/g, '""')}"`,
          s.signalDate,
          s.entryPrice,
          s.currentPrice,
          s.returnPct,
          s.return3mPct ?? '',
          s.return6mPct ?? '',
          s.return12mPct ?? '',
          s.maxGainPct ?? '',
          s.maxDrawdownPct ?? '',
        ].join(',')
      );
    }
    return lines.join('\n');
  }
}

export const scannerJobManager = new ScannerJobManager();
