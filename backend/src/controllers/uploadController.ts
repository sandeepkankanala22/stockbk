import type { Request, Response, NextFunction } from 'express';
import { excelParserService } from '../services/excelParserService.js';
import { jobManagerService } from '../services/jobManagerService.js';
import { mlService } from '../services/mlService.js';
import { screenerService } from '../services/screenerService.js';
import { AppError } from '../middleware/errorHandler.js';

export async function uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 'NO_FILE', 400);
    }

    const parsed = await excelParserService.parseUpload(
      req.file.buffer,
      req.file.originalname
    );
    const record = jobManagerService.storeUpload(parsed);

    res.status(200).json({
      uploadId: record.uploadId,
      totalRows: parsed.validRows.length + parsed.invalidRows.length,
      validRows: parsed.validRows.length,
      invalidRows: parsed.invalidRows,
      duplicatesRemoved: parsed.duplicatesRemoved,
      preview: parsed.validRows.slice(0, 10).map((r) => ({
        date: r.date,
        symbol: r.symbol,
      })),
    });
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const code = (error as Error & { code: string }).code;
      if (code === 'MISSING_COLUMNS') {
        next(new AppError(error.message, code, 422));
        return;
      }
    }
    next(error);
  }
}

export function resetState(_req: Request, res: Response): void {
  jobManagerService.reset();
  void mlService.clearModel();
  screenerService.clearCache();
  res.status(200).json({ message: 'State reset successfully' });
}
