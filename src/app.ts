import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../public');

export const app = express();

// Middlewares essenciais de segurança e parse
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir frontend web minimalista
app.use(express.static(publicPath));

// Rota de Healthcheck do Servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CJC-Dev-Pays',
  });
});

// Rotas da API
app.use('/api/v1', apiRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/admin', adminRouter);

// Fallback SPA para navegação web
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'Rota da API não encontrada',
      path: req.originalUrl,
    });
    return;
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Middleware de tratamento global de erros
app.use(errorHandler);
