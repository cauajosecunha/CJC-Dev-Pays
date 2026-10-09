import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface AdminRequest extends Request {
  adminUser?: {
    id: string;
    username: string;
  };
}

export function adminAuth(req: AdminRequest, res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token; // Útil para SSE (EventSource não envia headers customizados)
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Acesso negado. Token de autenticação administrativo ausente.',
      });
      return;
    }

    const decoded = jwt.verify(token, config.jwtSecret) as { id: string; username: string };
    req.adminUser = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Sessão expirada ou token administrativo inválido.',
    });
  }
}
