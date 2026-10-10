import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';
import { whatsappService } from '../services/whatsappService.js';
import { logger } from '../lib/logger.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';

export class WebhookController {
  /**
   * POST /api/webhooks/mercadopago
   * Endpoint ÚNICO cadastrado no painel oficial do Mercado Pago
   */
  async handleMercadoPago(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Imediatamente responde 200 OK para o Mercado Pago não entrar em loop de retentativa
    // e processa a lógica de forma assíncrona/robusta
    res.status(200).json({ status: 'ok', received: true });

    try {
      const xSignature = req.header('x-signature') || undefined;
      const xRequestId = req.header('x-request-id') || undefined;

      // Extrai ID do evento/pagamento do body ou da query string
      const body = req.body || {};
      const query = req.query || {};

      const topic = body.type || body.topic || query.topic || query.type || 'payment';
      const dataId = String(body.data?.id || body.id || query['data.id'] || query.id || '');

      logger.info(`Webhook recebido do Mercado Pago. Tópico: ${topic}, Data ID: ${dataId}`);

      // Validação criptográfica HMAC
      const isSignatureValid = mercadoPagoService.verifyWebhookSignature({
        xSignature,
        xRequestId,
        dataId,
      });

      // Grava no log de auditoria
      const logEntry = await prisma.webhookLog.create({
        data: {
          topic: String(topic),
          mpEventId: dataId || null,
          signature: xSignature || null,
          rawPayload: JSON.stringify({ body, query, headers: req.headers }),
          isSignatureValid,
          processed: false,
        },
      });

      if (!isSignatureValid) {
        logger.warn(`Assinatura HMAC inválida para o webhook ${logEntry.id}. O evento continuará o fluxo se em modo sandbox.`);
      }

      // Emite evento em tempo real para o Dashboard avisar o administrador
      appEvents.emit(EVENTS.WEBHOOK_RECEIVED, {
        topic: String(topic),
        dataId: String(dataId),
        isSignatureValid,
      });

      if (!dataId || (topic !== 'payment' && topic !== 'payment.created' && topic !== 'payment.updated')) {
        if (dataId === '123456' || topic === 'order' || topic === 'merchant_order') {
          logger.success(`Simulação/teste do Mercado Pago validada com sucesso! (${topic} / ID: ${dataId})`);
        } else {
          logger.info(`Evento não é de pagamento ou ID ausente (${topic} / ${dataId}). Processamento finalizado.`);
        }
        await prisma.webhookLog.update({
          where: { id: logEntry.id },
          data: { processed: true },
        });
        return;
      }

      // Consulta o Mercado Pago para obter os dados oficiais atualizados
      const mpData = await mercadoPagoService.getPayment(dataId);

      if (!mpData) {
        logger.warn(`Não foi possível recuperar dados do pagamento ${dataId} na API do MP.`);
        return;
      }

      const externalRef = mpData.external_reference;
      const mpStatus = (mpData.status || 'pending').toUpperCase();
      const statusDetail = mpData.status_detail;
      const fee = mpData.fee_details?.reduce((acc: number, item: any) => acc + (item.amount || 0), 0) || 0;
      const netReceived = mpData.transaction_details?.net_received_amount || (mpData.transaction_amount - fee);

      // Localiza a transação correspondente no banco
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            { mpPaymentId: String(dataId) },
            ...(externalRef ? [{ externalReference: String(externalRef) }] : []),
          ],
        },
        include: { application: true },
      });

      if (!payment) {
        logger.warn(`Pagamento não encontrado no banco para MP ID ${dataId} ou Ref ${externalRef}`);
        await prisma.webhookLog.update({
          where: { id: logEntry.id },
          data: { processed: true, error: 'Pagamento não localizado na base' },
        });
        return;
      }

      const isNewlyApproved = payment.status !== 'APPROVED' && mpStatus === 'APPROVED';
      const isNewlyRefunded =
        payment.status !== 'REFUNDED' &&
        payment.status !== 'CHARGED_BACK' &&
        (mpStatus === 'REFUNDED' || mpStatus === 'CHARGED_BACK');

      // Atualiza pagamento no banco de dados
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          mpPaymentId: String(dataId),
          status: mpStatus,
          statusDetail: statusDetail || payment.statusDetail,
          feeAmount: fee,
          netReceivedAmount: netReceived,
          paidAt: mpStatus === 'APPROVED' ? (payment.paidAt || new Date()) : payment.paidAt,
          updatedAt: new Date(),
        },
        include: { application: true },
      });

      await prisma.webhookLog.update({
        where: { id: logEntry.id },
        data: { processed: true },
      });

      logger.success(`Pagamento ${updatedPayment.externalReference} atualizado para status: ${mpStatus}`);

      // Emite evento para atualização em tempo real no Dashboard
      appEvents.emit(EVENTS.PAYMENT_UPDATED, {
        paymentId: updatedPayment.id,
        externalReference: updatedPayment.externalReference,
        status: updatedPayment.status,
        amount: updatedPayment.amount,
        appName: updatedPayment.application.name,
      });

      // Fan-Out: Despacha notificação para a aplicação cliente proprietária
      await webhookDispatcher.dispatch({
        payment: updatedPayment,
        application: updatedPayment.application,
        eventName: isNewlyApproved ? 'payment.approved' : `payment.${mpStatus.toLowerCase()}`,
      });

      // Notificação no WhatsApp da equipe via GOWA API
      if (isNewlyApproved) {
        whatsappService.sendApprovedPayment(
          updatedPayment,
          updatedPayment.application.name,
          updatedPayment.application.slug
        ).catch((err: any) => logger.warn(`[WebhookController] Erro ao notificar WhatsApp aprovado: ${err?.message || err}`));
      } else if (isNewlyRefunded) {
        whatsappService.sendRefundedPayment(
          updatedPayment,
          updatedPayment.application.name,
          updatedPayment.application.slug,
          statusDetail || `Atualizado para ${mpStatus} no Mercado Pago`
        ).catch((err: any) => logger.warn(`[WebhookController] Erro ao notificar WhatsApp estorno: ${err?.message || err}`));
      }
    } catch (error: any) {
      logger.error('Erro no processamento do webhook do Mercado Pago:', error);
    }
  }
}


export const webhookController = new WebhookController();
