import type { NextFunction, Request, Response } from 'express';
import type { BacktestConfig, SameDayHitMode } from '../types/index.js';
import { AppError } from './errorHandler.js';

function isValidPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isValidInvestment(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function validateBacktest(req: Request, _res: Response, next: NextFunction): void {
  const {
    targetPercent,
    stoplossPercent,
    sameDayHitMode,
    uploadId,
    investmentAmount,
    nearBuyPlusPct,
    nearBuyMinusPct,
  } = req.body ?? {};
  const fields: Record<string, string> = {};

  if (!uploadId || typeof uploadId !== 'string') {
    fields.uploadId = 'uploadId is required';
  }

  if (!isValidPercent(targetPercent)) {
    fields.targetPercent = 'Must be a number between 0 and 100';
  }

  if (!isValidPercent(stoplossPercent)) {
    fields.stoplossPercent = 'Must be a number between 0 and 100';
  }

  if (!isValidInvestment(investmentAmount)) {
    fields.investmentAmount = 'Must be a positive number (investment amount in INR)';
  }

  const plusPct =
    nearBuyPlusPct != null && isValidPercent(Number(nearBuyPlusPct))
      ? Number(nearBuyPlusPct)
      : 10;
  const minusPct =
    nearBuyMinusPct != null && isValidPercent(Number(nearBuyMinusPct))
      ? Number(nearBuyMinusPct)
      : 10;

  if (nearBuyPlusPct != null && !isValidPercent(Number(nearBuyPlusPct))) {
    fields.nearBuyPlusPct = 'Must be a number between 0 and 100';
  }

  if (nearBuyMinusPct != null && !isValidPercent(Number(nearBuyMinusPct))) {
    fields.nearBuyMinusPct = 'Must be a number between 0 and 100';
  }

  const validModes: SameDayHitMode[] = ['STOPLOSS_FIRST', 'TARGET_FIRST'];
  const mode: SameDayHitMode =
    sameDayHitMode && validModes.includes(sameDayHitMode)
      ? sameDayHitMode
      : 'STOPLOSS_FIRST';

  if (Object.keys(fields).length > 0) {
    next(new AppError('Validation failed', 'VALIDATION_ERROR', 400, fields));
    return;
  }

  req.body = {
    uploadId,
    targetPercent,
    stoplossPercent,
    sameDayHitMode: mode,
    investmentAmount,
    nearBuyPlusPct: plusPct,
    nearBuyMinusPct: minusPct,
  } satisfies BacktestConfig & { uploadId: string };

  next();
}
