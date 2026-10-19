import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/env.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
import { Payment, Application } from '@prisma/client';
import { isSafeUrl } from '../lib/urlValidator.js';

export interface DispatchEventOptions {
  payment: Payment;
  application: Application;
  eventName: string;
}

class WebhookDispatcher {
  /**
   * Dispara um webhook para a aplicação cliente e registra a entrega
   */
  async dispatch(options: DispatchEventOptions): Promise<void> {
    const { payment, application, eventName } = options;
    const targetUrl = payment.callbackUrl || application.webhookUrl;

    if (!targetUrl) {
      logger.warn(`Aplicação ${application.slug} não possui URL de webhook configurada. Entrega ignorada.`);
      return;
    }

    let parsedMetadata = null;
    try {
      if (payment.metadata) {
        parsedMetadata = JSON.parse(payment.metadata);
      }
    } catch {
      parsedMetadata = payment.metadata;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const payloadObject = {
      event: eventName,
      status: payment.status.toLowerCase(),
      status_detail: payment.statusDetail,
      payment_id: payment.id,
      mp_payment_id: payment.mpPaymentId,
      external_reference: payment.externalReference,
      amount: payment.amount,
      fee_amount: payment.feeAmount,
      net_received_amount: payment.netReceivedAmount,
      payment_method: payment.paymentMethod,
      paid_at: payment.paidAt,
      metadata: parsedMetadata,
      timestamp,
    };

    const payloadString = JSON.stringify(payloadObject);

    // Trava de Idempotência 1: Se este evento já foi entregue com sucesso para este pagamento, não reenvia
    const alreadyDelivered = await prisma.webhookDelivery.findFirst({
      where: {
        paymentId: payment.id,
        event: eventName,
        status: 'DELIVERED',
      },
    });

    if (alreadyDelivered) {
      logger.info(
        `[WebhookDispatcher] Evento "${eventName}" para o pagamento ${payment.externalReference} já foi entregue com sucesso anteriormente (Delivery ID: ${alreadyDelivered.id}). Despacho duplicado ignorado.`
      );
      return;
    }

    // Trava de Idempotência 2: Se já existe uma entrega PENDING em processo de retentativas para este mesmo evento e pagamento
    const pendingDelivery = await prisma.webhookDelivery.findFirst({
      where: {
        paymentId: payment.id,
        event: eventName,
        status: 'PENDING',
      },
    });

    if (pendingDelivery) {
      logger.info(
        `[WebhookDispatcher] Evento "${eventName}" para o pagamento ${payment.externalReference} já possui entrega pendente em retentativa ativa (Delivery ID: ${pendingDelivery.id}, Tentativa: ${pendingDelivery.attempts}). Despacho concorrente ignorado.`
      );
      return;
    }

    // Cria registro inicial de entrega
    const delivery = await prisma.webhookDelivery.create({
      data: {
        paymentId: payment.id,
        applicationId: application.id,
        targetUrl,
        event: eventName,
        payload: payloadString,
        attempts: 1,
        maxAttempts: config.webhookMaxRetries,
        status: 'PENDING',
      },
    });

    await this.executeDelivery(delivery.id, targetUrl, payloadString, application.webhookSecret, application.slug);
  }

  /**
   * Executa a requisição HTTP e atualiza o status de entrega
   */
  async executeDelivery(
    deliveryId: string,
    targetUrl: string,
    payloadString: string,
    secret: string,
    appSlug: string
  ): Promise<boolean> {
    const timestamp = Math.floor(Date.now() / 1000);

    // Gera assinatura HMAC-SHA256 para autenticidade da notificação
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`t=${timestamp}&body=${payloadString}`)
      .digest('hex');

    if (!isSafeUrl(targetUrl)) {
      logger.error(`[WebhookDispatcher] URL de webhook bloqueada por segurança (SSRF): ${targetUrl}`);
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          httpStatus: null,
          responseBody: 'URL bloqueada pela política de segurança (SSRF: IP ou domínio privado/inválido)',
          attempts: 1,
          nextRetryAt: null,
          updatedAt: new Date(),
        },
      });
      return false;
    }

    try {
      logger.info(`Disparando webhook para ${targetUrl} (App: ${appSlug})`);

      const response = await axios.post(targetUrl, payloadString, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CJC-Dev-Pays-WebhookDispatcher/1.0',
          'X-CJC-Signature': `t=${timestamp},v1=${signature}`,
          'X-CJC-App': appSlug,
        },
        timeout: 10000,
      });

      const responseBody =
        typeof response.data === 'string'
          ? response.data.slice(0, 500)
          : JSON.stringify(response.data).slice(0, 500);

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'DELIVERED',
          httpStatus: response.status,
          responseBody,
          nextRetryAt: null,
          updatedAt: new Date(),
        },
      });

      logger.success(`Webhook entregue com sucesso para ${targetUrl} [HTTP ${response.status}]`);
      appEvents.emit(EVENTS.WEBHOOK_DELIVERED, { deliveryId, targetUrl, status: response.status });
      return true;
    } catch (error: any) {
      const httpStatus = error.response?.status || null;
      const responseBody = error.response?.data
        ? (typeof error.response.data === 'string'
            ? error.response.data.slice(0, 500)
            : JSON.stringify(error.response.data).slice(0, 500))
        : (error.message || 'Falha de conexão').slice(0, 500);

      const delivery = await prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
      });

      if (!delivery) return false;

      const nextAttempt = delivery.attempts + 1;
      const willRetry = nextAttempt <= delivery.maxAttempts;

      // Backoff progressivo: 1m, 2m, 4m, 8m...
      const backoffSeconds = Math.pow(2, delivery.attempts) * config.webhookRetryIntervalSeconds;
      const nextRetryAt = willRetry ? new Date(Date.now() + backoffSeconds * 1000) : null;

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: willRetry ? 'PENDING' : 'FAILED',
          httpStatus,
          responseBody,
          attempts: nextAttempt,
          nextRetryAt,
          updatedAt: new Date(),
        },
      });

      logger.warn(`Falha ao entregar webhook para ${targetUrl} [${httpStatus || 'Network Error'}]. Tentativa ${delivery.attempts}/${delivery.maxAttempts}.`);
      appEvents.emit(EVENTS.WEBHOOK_FAILED, { deliveryId, targetUrl, error: responseBody, willRetry });
      return false;
    }
  }

  /**
   * Força uma retentativa imediata disparada pelo painel administrativo
   */
  async retryDelivery(deliveryId: string): Promise<{ success: boolean; message: string }> {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { application: true },
    });

    if (!delivery) {
      throw new Error('Registro de entrega de webhook não encontrado.');
    }

    const success = await this.executeDelivery(
      delivery.id,
      delivery.targetUrl,
      delivery.payload,
      delivery.application.webhookSecret,
      delivery.application.slug
    );

    return {
      success,
      message: success
        ? 'Webhook reenviado e entregue com sucesso!'
        : 'Tentativa de reenvio falhou. Verifique o endpoint da aplicação.',
    };
  }

  /**
   * Processa entregas pendentes com agendamento vencido
   */
  async processPendingRetries(): Promise<void> {
    try {
      const now = new Date();
      const pendingDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          status: 'PENDING',
          nextRetryAt: { lte: now },
          attempts: { lte: config.webhookMaxRetries },
        },
        include: { application: true },
        take: 10,
      });

      for (const delivery of pendingDeliveries) {
        await this.executeDelivery(
          delivery.id,
          delivery.targetUrl,
          delivery.payload,
          delivery.application.webhookSecret,
          delivery.application.slug
        );
      }
    } catch (error) {
      logger.error('Erro na rotina de processamento de retentativas de webhooks:', error);
    }
  }
}

export const webhookDispatcher = new WebhookDispatcher();
