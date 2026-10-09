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

export const app = express();

// Middlewares essenciais de segurança e parse
app.use(
  helmet({
    contentSecurityPolicy: false, // Permite carregar CDNs do Google Fonts e estilos modernos no Dashboard
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir frontend do Painel Web (arquivos estáticos em public/)
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// Rotas da API
app.use('/api/v1', apiRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/admin', adminRouter);

// Rota de Healthcheck do Servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CJC-Dev-Pays',
  });
});

// Fallback para SPA no Painel Administrativo
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Middleware de tratamento global de erros
app.use(errorHandler);
