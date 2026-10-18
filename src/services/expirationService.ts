import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
import { webhookDispatcher } from './webhookDispatcher.js';
import { Payment, Application } from '@prisma/client';

export class ExpirationService {
  /**
   * Tempo padrão de expiração do Pix em minutos (30 minutos)
   */
  readonly DEFAULT_PIX_EXPIRATION_MINUTES = 30;

  /**
   * Extrai a data de expiração de um pagamento (a partir de metadata ou createdAt + 30 min)
   */
  getExpirationDate(payment: Payment): Date {
    let minutes = this.DEFAULT_PIX_EXPIRATION_MINUTES;
    try {
      if (payment.metadata) {
        const meta = JSON.parse(payment.metadata);
        if (meta.expires_at) {
          const parsed = new Date(meta.expires_at);
          if (!isNaN(parsed.getTime())) return parsed;
        }
        if (meta.expiration_minutes && Number(meta.expiration_minutes) > 0) {
          minutes = Number(meta.expiration_minutes);
        }
      }
    } catch {
      // Ignora erro de JSON e usa padrão
    }

    return new Date(new Date(payment.createdAt).getTime() + minutes * 60 * 1000);
  }

  /**
   * Verifica se um pagamento Pix pendente já expirou e, em caso positivo,
   * atualiza o status para CANCELLED (statusDetail: 'expired') e despacha notificação.
   */
  async checkAndExpireIfDue(payment: Payment & { application?: Application | null }): Promise<Payment> {
    if (payment.paymentMethod !== 'PIX' || payment.status !== 'PENDING') {
      return payment;
    }

    const expiresAt = this.getExpirationDate(payment);
    const now = new Date();

    if (now.getTime() < expiresAt.getTime()) {
      return payment;
    }

    return this.expirePayment(payment);
  }

  /**
   * Marca um pagamento como expirado (CANCELLED / expired), emite eventos e despacha webhook
   */
  async expirePayment(payment: Payment & { application?: Application | null }): Promise<Payment> {
    logger.info(`[ExpirationService] Expirando Pix sem pagamento após prazo limite [${payment.externalReference}]`);

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
        statusDetail: 'expired',
        updatedAt: new Date(),
      },
      include: { application: true },
    });

    // Emite SSE para atualizar o dashboard em tempo real
    appEvents.emit(EVENTS.PAYMENT_UPDATED, {
      paymentId: updated.id,
      externalReference: updated.externalReference,
      status: updated.status,
      amount: updated.amount,
      appName: updated.application?.name || 'Sistema',
    });

    // Notifica a aplicação dona via Webhook Fan-Out
    if (updated.application) {
      await webhookDispatcher.dispatch({
        payment: updated,
        application: updated.application,
        eventName: 'payment.cancelled',
      });
    }

    logger.warn(`[ExpirationService] ⏱️ Pagamento Pix ${updated.externalReference} definido como NÃO PAGO (CANCELLED/expired).`);
    return updated;
  }

  /**
   * Processa em lote todos os pagamentos Pix pendentes que ultrapassaram o tempo limite de 30 minutos
   */
  async processPendingExpirations(): Promise<number> {
    try {
      const now = new Date();
      // Busca pagamentos Pix criados há mais de 30 minutos que continuam PENDING
      const cutoffDate = new Date(now.getTime() - this.DEFAULT_PIX_EXPIRATION_MINUTES * 60 * 1000);

      const pendingPayments = await prisma.payment.findMany({
        where: {
          paymentMethod: 'PIX',
          status: 'PENDING',
          createdAt: {
            lte: cutoffDate,
          },
        },
        include: {
          application: true,
        },
      });

      if (pendingPayments.length === 0) {
        return 0;
      }

      logger.info(`[ExpirationService] Verificando ${pendingPayments.length} pagamentos Pix pendentes para expiração...`);
      let count = 0;

      for (const payment of pendingPayments) {
        const expiresAt = this.getExpirationDate(payment);
        if (now.getTime() >= expiresAt.getTime()) {
          await this.expirePayment(payment);
          count++;
        }
      }

      if (count > 0) {
        logger.success(`[ExpirationService] ${count} pagamento(s) Pix expirado(s) e marcado(s) como Não Pago.`);
      }

      return count;
    } catch (error: any) {
      logger.error('[ExpirationService] Erro ao processar expiração de Pix pendentes:', error?.message || error);
      return 0;
    }
  }

  /**
   * Remove fisicamente do histórico pagamentos que expiraram sem pagamento (CANCELLED com statusDetail 'expired')
   */
  async purgeExpiredPayments(applicationId?: string): Promise<{ deletedCount: number }> {
    try {
      const where: any = {
        status: 'CANCELLED',
        statusDetail: 'expired',
      };

      if (applicationId && applicationId !== 'ALL') {
        where.applicationId = applicationId;
      }

      // Deleta primeiro entregas de webhook vinculadas caso existam
      const expiredPayments = await prisma.payment.findMany({
        where,
        select: { id: true },
      });

      const paymentIds = expiredPayments.map((p) => p.id);

      if (paymentIds.length > 0) {
        await prisma.webhookDelivery.deleteMany({
          where: { paymentId: { in: paymentIds } },
        });

        const deleted = await prisma.payment.deleteMany({
          where: { id: { in: paymentIds } },
        });

        logger.info(`[ExpirationService] ${deleted.count} pagamentos expirados removidos do histórico.`);
        return { deletedCount: deleted.count };
      }

      return { deletedCount: 0 };
    } catch (error: any) {
      logger.error('[ExpirationService] Erro ao remover pagamentos expirados do histórico:', error?.message || error);
      throw error;
    }
  }
}

export const expirationService = new ExpirationService();
