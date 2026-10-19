import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { logger } from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '../public');

import { config } from './config/env.js';

export const app = express();

// Middlewares essenciais de segurança e parse
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (ex: server-to-server, curl) ou presentes na whitelist
      if (!origin || config.allowedOrigins.includes(origin) || config.nodeEnv !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Origem bloqueada pela política de CORS do CJC Dev Pays.'));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ==================== CACHE BUSTING AUTOMÁTICO ====================
interface CachedAsset {
  mtime: number;
  hash: string;
}

const assetHashCache = new Map<string, CachedAsset>();

function getAssetHash(fileName: string): string {
  try {
    const fullPath = path.join(publicPath, fileName);
    const stat = fs.statSync(fullPath);
    const cached = assetHashCache.get(fileName);
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.hash;
    }
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
    assetHashCache.set(fileName, { mtime: stat.mtimeMs, hash });
    return hash;
  } catch {
    return Date.now().toString(36);
  }
}

let indexHtmlCache: { mtime: number; content: string; cssHash: string; jsHash: string } | null = null;

function renderIndexHtml(): string {
  try {
    const indexPath = path.join(publicPath, 'index.html');
    const indexStat = fs.statSync(indexPath);
    const cssHash = getAssetHash('styles.css');
    const jsHash = getAssetHash('app.js');

    if (
      indexHtmlCache &&
      indexHtmlCache.mtime === indexStat.mtimeMs &&
      indexHtmlCache.cssHash === cssHash &&
      indexHtmlCache.jsHash === jsHash
    ) {
      return indexHtmlCache.content;
    }

    let html = fs.readFileSync(indexPath, 'utf-8');
    html = html.replace(/href=(["'])\/styles\.css(\?v=[^"']*)?\1/g, `href=$1/styles.css?v=${cssHash}$1`);
    html = html.replace(/src=(["'])\/app\.js(\?v=[^"']*)?\1/g, `src=$1/app.js?v=${jsHash}$1`);

    indexHtmlCache = {
      mtime: indexStat.mtimeMs,
      content: html,
      cssHash,
      jsHash,
    };

    return html;
  } catch (error) {
    logger.error('Erro ao renderizar index.html com cache busting:', error);
    return fs.readFileSync(path.join(publicPath, 'index.html'), 'utf-8');
  }
}

const serveIndexHtml = (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(renderIndexHtml());
};

// Servir frontend web minimalista (JS, CSS, imagens, fontes) com cache revalidado
app.use(
  express.static(publicPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      }
    },
  })
);

// Rota raiz e index.html com injeção automática de Cache Busting (hash MD5)
app.get(['/', '/index.html'], serveIndexHtml);

// Rota de Healthcheck do Servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'CJC Dev Pays',
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
  serveIndexHtml(req, res);
});

// Middleware de tratamento global de erros
app.use(errorHandler);
