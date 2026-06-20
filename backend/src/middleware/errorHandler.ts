import type { NextFunction, Request, Response } from 'express';
import type { ApiError } from '../types/index.js';

export class AppError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, code: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

type HttpError = Error & {
  status?: number;
  code?: string;
  type?: string;
  fields?: Record<string, string>;
};

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
  } else {
    const httpErr = err as HttpError;
    if (typeof httpErr.status === 'number' && httpErr.status >= 400 && httpErr.status < 600) {
      status = httpErr.status;
    } else if (err instanceof SyntaxError || httpErr.type === 'entity.parse.failed') {
      status = 400;
      code = 'INVALID_JSON';
    } else if (httpErr.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
    }

    if ('code' in err && typeof httpErr.code === 'string' && httpErr.code !== 'INTERNAL_ERROR') {
      code = httpErr.code;
    }
  }

  const body: ApiError = {
    code,
    message: err.message || 'Internal server error',
  };

  if ('fields' in err && (err as HttpError).fields) {
    body.fields = (err as HttpError).fields;
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
}
