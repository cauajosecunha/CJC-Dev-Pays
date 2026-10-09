import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { Application } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  application?: Application;
}

export async function apiKeyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let apiKey = req.header('X-Api-Key');

    if (!apiKey) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7).trim();
      }
    }

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'Chave de API não informada. Envie o cabeçalho X-Api-Key ou Authorization: Bearer <key>.',
      });
      return;
    }

    // Busca pela chave de API direta ou pelo hash sha256
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const application = await prisma.application.findFirst({
      where: {
        OR: [{ apiKey }, { apiKeyHash }],
      },
    });

    if (!application) {
      res.status(401).json({
        success: false,
        error: 'Chave de API inválida ou não cadastrada.',
      });
      return;
    }

    if (!application.isActive) {
      res.status(403).json({
        success: false,
        error: 'A aplicação associada a esta chave está inativa.',
      });
      return;
    }

    req.application = application;
    next();
  } catch (error) {
    next(error);
  }
}
