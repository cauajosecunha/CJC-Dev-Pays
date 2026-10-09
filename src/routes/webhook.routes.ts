import { Router } from 'express';
import { webhookController } from '../controllers/webhookController.js';

export const webhookRouter = Router();

// Endpoint oficial cadastrado no painel de desenvolvedores do Mercado Pago
webhookRouter.post('/mercadopago', (req, res, next) => webhookController.handleMercadoPago(req, res, next));

// Health check para testes e validações manuais
webhookRouter.get('/mercadopago', (req, res) => {
  res.json({
    status: 'online',
    service: 'CJC-Dev-Pays Mercado Pago Webhook Ingestion Point',
    timestamp: new Date().toISOString(),
  });
});
