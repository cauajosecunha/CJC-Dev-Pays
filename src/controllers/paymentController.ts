import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middlewares/apiKeyAuth.js';
import { prisma } from '../lib/prisma.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
import { logger } from '../lib/logger.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';
import { whatsappService } from '../services/whatsappService.js';
import { config } from '../config/env.js';

const createPixSchema = z.object({
  external_reference: z.string().min(1, 'external_reference é obrigatório'),
  amount: z.number().positive('amount deve ser um valor positivo'),
  description: z.string().min(1, 'description é obrigatória'),
  payer: z.object({
    email: z.string().email('E-mail do pagador inválido'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    identification: z
      .object({
        type: z.string().default('CPF'),
        number: z.string(),
      })
      .optional(),
  }),
  callback_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

const createCardSchema = z.object({
  external_reference: z.string().min(1, 'external_reference é obrigatório'),
  amount: z.number().positive('amount deve ser um valor positivo'),
  description: z.string().min(1, 'description é obrigatória'),
  token: z.string().min(1, 'token do cartão é obrigatório'),
  payment_method_id: z.string().min(1, 'payment_method_id é obrigatório'),
  installments: z.number().int().min(1).default(1),
  issuer_id: z.string().optional(),
  payer: z.object({
    email: z.string().email('E-mail do pagador inválido'),
    identification: z
      .object({
        type: z.string().default('CPF'),
        number: z.string(),
      })
      .optional(),
  }),
  callback_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export class PaymentController {
  /**
   * POST /api/v1/payments/pix
   */
  async createPix(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createPixSchema.parse(req.body);
      const app = req.application!;
      const estabId = app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-');

      // Garante automaticamente o padrão contábil {ID_ESTABELECIMENTO}-{REF}
      let finalReference = validated.external_reference;
      if (!finalReference.toUpperCase().startsWith(`${estabId}-`)) {
        finalReference = `${estabId}-${finalReference}`;
      }

      // Verifica se a referência externa já existe
      const existing = await prisma.payment.findUnique({
        where: { externalReference: finalReference },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: `Já existe um pagamento registrado com a referência '${finalReference}'.`,
          payment_id: existing.id,
          status: existing.status,
        });
        return;
      }

      // Prepara metadata injetando identificadores do estabelecimento e do CJC-Dev-Pays
      const combinedMetadata = {
        estabelecimento_id: estabId,
        estabelecimento_nome: app.name,
        estabelecimento_tipo: app.slug,
        ...(validated.metadata || {}),
        cjc_app_id: app.id,
        cjc_app_slug: app.slug,
      };

      const notificationUrl = `${config.apiBaseUrl}/api/webhooks/mercadopago`;

      // Chama Mercado Pago
      const mpResult = await mercadoPagoService.createPix({
        amount: validated.amount,
        description: validated.description,
        externalReference: finalReference,
        payer: {
          email: validated.payer.email,
          firstName: validated.payer.first_name,
          lastName: validated.payer.last_name,
          identification: validated.payer.identification,
        },
        notificationUrl,
        metadata: combinedMetadata,
      });

      // Salva no banco de dados
      const payment = await prisma.payment.create({
        data: {
          applicationId: app.id,
          externalReference: finalReference,
          mpPaymentId: mpResult.id,
          paymentMethod: 'PIX',
          status: mpResult.status,
          statusDetail: mpResult.statusDetail,
          amount: mpResult.amount,
          feeAmount: mpResult.feeAmount,
          netReceivedAmount: mpResult.netReceivedAmount,
          description: validated.description,
          payerEmail: validated.payer.email,
          payerName: [validated.payer.first_name, validated.payer.last_name].filter(Boolean).join(' ') || null,
          payerDocument: validated.payer.identification?.number || null,
          qrCode: mpResult.qrCode,
          qrCodeBase64: mpResult.qrCodeBase64,
          ticketUrl: mpResult.ticketUrl,
          callbackUrl: validated.callback_url || null,
          metadata: JSON.stringify(combinedMetadata),
        },
      });

      appEvents.emit(EVENTS.PAYMENT_CREATED, {
        paymentId: payment.id,
        externalReference: payment.externalReference,
        amount: payment.amount,
        appName: app.name,
      });

      logger.success(`Pix criado com sucesso [${payment.externalReference}] R$ ${payment.amount} (App: ${app.slug})`);

      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          external_reference: payment.externalReference,
          status: payment.status,
          amount: payment.amount,
          qr_code: payment.qrCode,
          qr_code_base64: payment.qrCodeBase64,
          ticket_url: payment.ticketUrl,
          created_at: payment.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/card
   */
  async createCard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createCardSchema.parse(req.body);
      const app = req.application!;
      const estabId = app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-');

      // Garante automaticamente o padrão contábil {ID_ESTABELECIMENTO}-{REF}
      let finalReference = validated.external_reference;
      if (!finalReference.toUpperCase().startsWith(`${estabId}-`)) {
        finalReference = `${estabId}-${finalReference}`;
      }

      const existing = await prisma.payment.findUnique({
        where: { externalReference: finalReference },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: `Já existe um pagamento com a referência '${finalReference}'.`,
        });
        return;
      }

      const combinedMetadata = {
        estabelecimento_id: estabId,
        estabelecimento_nome: app.name,
        estabelecimento_tipo: app.slug,
        ...(validated.metadata || {}),
        cjc_app_id: app.id,
        cjc_app_slug: app.slug,
      };

      const notificationUrl = `${config.apiBaseUrl}/api/webhooks/mercadopago`;

      const mpResult = await mercadoPagoService.createCardPayment({
        amount: validated.amount,
        description: validated.description,
        externalReference: finalReference,
        token: validated.token,
        paymentMethodId: validated.payment_method_id,
        installments: validated.installments,
        issuerId: validated.issuer_id,
        payer: validated.payer,
        notificationUrl,
        metadata: combinedMetadata,
      });

      const payment = await prisma.payment.create({
        data: {
          applicationId: app.id,
          externalReference: finalReference,
          mpPaymentId: mpResult.id,
          paymentMethod: validated.payment_method_id.toLowerCase().startsWith('deb') ? 'DEBIT_CARD' : 'CREDIT_CARD',
          status: mpResult.status,
          statusDetail: mpResult.statusDetail,
          amount: mpResult.amount,
          feeAmount: mpResult.feeAmount,
          netReceivedAmount: mpResult.netReceivedAmount,
          description: validated.description,
          payerEmail: validated.payer.email,
          payerDocument: validated.payer.identification?.number || null,
          callbackUrl: validated.callback_url || null,
          metadata: JSON.stringify(combinedMetadata),
          paidAt: mpResult.status === 'APPROVED' ? new Date() : null,
        },
      });

      if (payment.status === 'APPROVED') {
        await webhookDispatcher.dispatch({
          payment,
          application: app,
          eventName: 'payment.approved',
        });
        whatsappService.sendApprovedPayment(payment, app.name, app.slug)
          .catch((err: any) => logger.warn(`[PaymentController] Erro ao notificar WhatsApp aprovado: ${err?.message || err}`));
      }

      res.status(201).json({
        success: true,
        payment: {
          id: payment.id,
          external_reference: payment.externalReference,
          status: payment.status,
          status_detail: payment.statusDetail,
          amount: payment.amount,
          created_at: payment.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/:id
   */
  async getPaymentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = req.application!;

      const payment = await prisma.payment.findFirst({
        where: { id, applicationId: app.id },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        return;
      }

      res.json({
        success: true,
        payment: {
          id: payment.id,
          external_reference: payment.externalReference,
          status: payment.status,
          status_detail: payment.statusDetail,
          amount: payment.amount,
          fee_amount: payment.feeAmount,
          net_received_amount: payment.netReceivedAmount,
          payment_method: payment.paymentMethod,
          paid_at: payment.paidAt,
          qr_code: payment.qrCode,
          ticket_url: payment.ticketUrl,
          created_at: payment.createdAt,
          updated_at: payment.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/by-reference/:reference
   */
  async getPaymentByReference(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reference = String(req.params.reference);
      const app = req.application!;
      const estabId = app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-');

      const payment = await prisma.payment.findFirst({
        where: {
          applicationId: app.id,
          OR: [
            { externalReference: reference },
            { externalReference: `${estabId}-${reference}` },
          ],
        },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado para esta referência.' });
        return;
      }

      res.json({
        success: true,
        payment: {
          id: payment.id,
          external_reference: payment.externalReference,
          status: payment.status,
          status_detail: payment.statusDetail,
          amount: payment.amount,
          payment_method: payment.paymentMethod,
          paid_at: payment.paidAt,
          qr_code: payment.qrCode,
          created_at: payment.createdAt,
          updated_at: payment.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/:id/refund
   */
  async refund(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = req.application!;

      const payment = await prisma.payment.findFirst({
        where: { id, applicationId: app.id },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        return;
      }

      if (payment.status !== 'APPROVED') {
        res.status(400).json({
          success: false,
          error: `Apenas pagamentos aprovados podem ser estornados. Status atual: ${payment.status}`,
        });
        return;
      }

      if (payment.mpPaymentId) {
        await mercadoPagoService.refundPayment(payment.mpPaymentId);
      }

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REFUNDED',
          statusDetail: 'refunded',
          updatedAt: new Date(),
        },
      });

      await webhookDispatcher.dispatch({
        payment: updated,
        application: app,
        eventName: 'payment.refunded',
      });

      whatsappService.sendRefundedPayment(updated, app.name, app.slug, 'Estornado via API do CJC-Dev-Pays')
        .catch((err: any) => logger.warn(`[PaymentController] Erro ao notificar WhatsApp estorno: ${err?.message || err}`));

      res.json({
        success: true,
        message: 'Pagamento estornado com sucesso.',
        payment: {
          id: updated.id,
          status: updated.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
