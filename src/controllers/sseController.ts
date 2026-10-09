import { Request, Response } from 'express';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
import { logger } from '../lib/logger.js';

export function sseStreamHandler(req: Request, res: Response): void {
  // Configuração de cabeçalhos para Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Evita buffer no Nginx
  });

  res.write(': connected\n\n');

  // Envia heartbeat a cada 25 segundos para manter conexão viva
  const keepAliveInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const onPaymentCreated = (data: any) => sendEvent('payment:created', data);
  const onPaymentUpdated = (data: any) => sendEvent('payment:updated', data);
  const onWebhookDelivered = (data: any) => sendEvent('webhook:delivered', data);
  const onWebhookFailed = (data: any) => sendEvent('webhook:failed', data);

  appEvents.on(EVENTS.PAYMENT_CREATED, onPaymentCreated);
  appEvents.on(EVENTS.PAYMENT_UPDATED, onPaymentUpdated);
  appEvents.on(EVENTS.WEBHOOK_DELIVERED, onWebhookDelivered);
  appEvents.on(EVENTS.WEBHOOK_FAILED, onWebhookFailed);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    appEvents.off(EVENTS.PAYMENT_CREATED, onPaymentCreated);
    appEvents.off(EVENTS.PAYMENT_UPDATED, onPaymentUpdated);
    appEvents.off(EVENTS.WEBHOOK_DELIVERED, onWebhookDelivered);
    appEvents.off(EVENTS.WEBHOOK_FAILED, onWebhookFailed);
  });
}
