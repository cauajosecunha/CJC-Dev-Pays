import { Router } from 'express';
import { paymentController } from '../controllers/paymentController.js';
import { apiKeyAuth } from '../middlewares/apiKeyAuth.js';
import { config } from '../config/env.js';

export const apiRouter = Router();

// Todas as rotas /v1 exigem autenticação por chave de API (X-Api-Key)
apiRouter.use(apiKeyAuth);

// Configuração pública ativa (Public Key do adquirente para tokenização no frontend)
apiRouter.get('/public-key', (req, res) => {
  res.json({
    success: true,
    public_key: config.mpPublicKey,
    sandbox: config.mpSandbox,
  });
});

apiRouter.post('/payments/pix', (req, res, next) => paymentController.createPix(req, res, next));
apiRouter.post('/payments/card', (req, res, next) => paymentController.createCard(req, res, next));
apiRouter.get('/payments/by-reference/:reference', (req, res, next) => paymentController.getPaymentByReference(req, res, next));
apiRouter.get('/payments/:id', (req, res, next) => paymentController.getPaymentById(req, res, next));
apiRouter.post('/payments/:id/refund', (req, res, next) => paymentController.refund(req, res, next));

