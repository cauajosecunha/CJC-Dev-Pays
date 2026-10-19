import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error(`Erro na requisição ${req.method} ${req.originalUrl}:`, err.message || err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Dados de requisição inválidos.',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  let clientMessage = err.message || 'Ocorreu um erro interno no servidor.';
  if (statusCode >= 500 && isProduction) {
    clientMessage = 'Ocorreu um erro interno no servidor. Por favor, tente novamente mais tarde.';
  }

  res.status(statusCode).json({
    success: false,
    error: clientMessage,
  });
}
