import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { metricsService } from '../services/metricsService.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';
import { whatsappService } from '../services/whatsappService.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
import { logger } from '../lib/logger.js';
import { expirationService } from '../services/expirationService.js';
import { isSafeUrl } from '../lib/urlValidator.js';
import { feeService } from '../services/feeService.js';
import { financialService } from '../services/financialService.js';
import { companyService } from '../services/companyService.js';
import { auditService } from '../services/auditService.js';
import axios from 'axios';

export class AdminController {
  /**
   * POST /api/admin/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, username, password } = req.body;
      const loginIdentifier = (email || username)?.trim();

      if (!loginIdentifier || !password) {
        res.status(400).json({ success: false, error: 'E-mail e senha são obrigatórios.' });
        return;
      }

      const user = await prisma.adminUser.findFirst({
        where: {
          OR: [
            { email: loginIdentifier },
            { username: loginIdentifier },
          ],
        },
      });

      if (!user) {
        res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        return;
      }

      const token = jwt.sign(
        { id: user.id, username: user.username || user.email, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/metrics
   */
  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let month: number | undefined;
      if (req.query.month && req.query.month !== 'ALL') {
        const parsed = parseInt(req.query.month as string, 10);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 12) {
          month = parsed;
        }
      }

      let year: number | undefined;
      if (req.query.year) {
        const parsedYear = parseInt(req.query.year as string, 10);
        if (!Number.isNaN(parsedYear) && parsedYear >= 2000) {
          year = parsedYear;
        }
      }

      const data = await metricsService.getDashboardMetrics(month, year);
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/payments
   */
  async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Sincroniza pagamentos Pix que já ultrapassaram o tempo limite de 30 minutos
      await expirationService.processPendingExpirations();

      const rawPage = parseInt(req.query.page as string, 10);
      const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
      const status = req.query.status as string;
      const appId = req.query.appId as string;
      const search = req.query.search as string;

      const where: any = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (appId && appId !== 'ALL') {
        where.applicationId = appId;
      }

      if (search && search.trim() !== '') {
        where.OR = [
          { externalReference: { contains: search } },
          { mpPaymentId: { contains: search } },
          { payerEmail: { contains: search } },
          { payerName: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [total, payments] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          include: {
            application: {
              select: { id: true, name: true, slug: true },
            },
            deliveries: {
              select: { id: true, status: true, httpStatus: true, attempts: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      res.json({
        success: true,
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/payments/:id
   */
  async getPaymentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          application: true,
          deliveries: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        return;
      }

      res.json({ success: true, payment });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/payments/:id/refund
   */
  async refundPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      // Trava atômica no banco: muda status para REFUND_IN_PROCESS prevenindo duplo estorno concorrente
      const lockResult = await prisma.payment.updateMany({
        where: { id, status: 'APPROVED' },
        data: {
          status: 'REFUND_IN_PROCESS',
          statusDetail: 'refund_processing_by_admin',
          updatedAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        const current = await prisma.payment.findUnique({ where: { id } });
        if (!current) {
          res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        } else {
          res.status(400).json({
            success: false,
            error: `Apenas pagamentos aprovados podem ser estornados. Status atual: ${current.status}`,
          });
        }
        return;
      }

      const payment = (await prisma.payment.findUnique({
        where: { id },
        include: { application: true },
      }))!;

      try {
        if (payment.mpPaymentId) {
          await mercadoPagoService.refundPayment(payment.mpPaymentId);
        }
      } catch (mpError) {
        await prisma.payment.update({
          where: { id },
          data: {
            status: 'APPROVED',
            statusDetail: 'accredited',
            updatedAt: new Date(),
          },
        });
        throw mpError;
      }

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: 'REFUNDED',
          statusDetail: 'refunded_by_admin',
          updatedAt: new Date(),
        },
        include: { application: true },
      });

      await webhookDispatcher.dispatch({
        payment: updated,
        application: updated.application,
        eventName: 'payment.refunded',
      });

      whatsappService.sendRefundedPayment(
        updated,
        updated.application.name,
        updated.application.slug,
        'Estornado manualmente pelo Painel Administrativo'
      ).catch((err: any) => logger.warn(`[AdminController] Erro ao notificar WhatsApp estorno: ${err?.message || err}`));

      res.json({ success: true, payment: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/applications
   */
  async getApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const apps = await prisma.application.findMany({
        include: {
          _count: {
            select: { payments: true, deliveries: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const applications = apps.map((app) => {
        const { apiKeyHash, ...safeApp } = app;
        return {
          ...safeApp,
          establishmentId: app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
        };
      });

      res.json({ success: true, applications });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/applications/:id
   */
  async getApplicationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = await prisma.application.findUnique({
        where: { id },
        include: {
          _count: {
            select: { payments: true, deliveries: true },
          },
        },
      });

      if (!app) {
        res.status(404).json({ success: false, error: 'Aplicação não encontrada.' });
        return;
      }

      const { apiKeyHash, ...safeApp } = app;
      res.json({
        success: true,
        application: {
          ...safeApp,
          establishmentId: app.slug.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/applications/upload-logo
   * Upload de arquivo de imagem para o logo da aplicação (Base64)
   */
  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileData } = req.body;

      if (!fileData || typeof fileData !== 'string') {
        res.status(400).json({ success: false, error: 'Arquivo de imagem não fornecido.' });
        return;
      }

      // Validação de Data URL Base64: data:image/png;base64,...
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ success: false, error: 'Formato de imagem inválido. Envie um arquivo de imagem válido.' });
        return;
      }

      const mimeType = matches[1].toLowerCase();
      const base64Data = matches[2];

      const allowedMimes: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'image/gif': '.gif',
      };

      const ext = allowedMimes[mimeType];
      if (!ext) {
        res.status(400).json({
          success: false,
          error: 'Formato não suportado. Por favor, utilize uma imagem PNG, JPG, WebP, SVG ou GIF.',
        });
        return;
      }

      const buffer = Buffer.from(base64Data, 'base64');

      // Limite máximo de 5MB
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(400).json({ success: false, error: 'O arquivo de imagem excede o tamanho máximo permitido de 5MB.' });
        return;
      }

      const uploadsDir = path.resolve(process.cwd(), 'public/uploads/logos');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const safeFileName = `logo-${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadsDir, safeFileName);

      fs.writeFileSync(filePath, buffer);

      const logoUrl = `/uploads/logos/${safeFileName}`;
      logger.info(`[ADMIN] Logo de aplicação salvo em: ${logoUrl} (${(buffer.length / 1024).toFixed(1)} KB)`);

      res.json({
        success: true,
        logoUrl,
        message: 'Logo da aplicação enviado com sucesso!',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/applications
   */
  async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, webhookUrl, isCommissionExempt, logoUrl, contactEmail, contactPhone } = req.body;

      if (!name || !slug) {
        res.status(400).json({ success: false, error: 'Nome e slug são obrigatórios.' });
        return;
      }

      if (webhookUrl && !isSafeUrl(webhookUrl)) {
        res.status(400).json({
          success: false,
          error: 'URL de webhook inválida ou rejeitada por segurança (IP privado/loopback não permitido).',
        });
        return;
      }

      const existing = await prisma.application.findUnique({
        where: { slug },
      });

      if (existing) {
        res.status(409).json({ success: false, error: `Já existe uma aplicação com o slug '${slug}'.` });
        return;
      }

      const randomBytes = crypto.randomBytes(16).toString('hex');
      const apiKey = `cjc_live_${slug}_${randomBytes}`;
      const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const webhookSecret = `whsec_${slug}_${crypto.randomBytes(16).toString('hex')}`;

      const application = await prisma.application.create({
        data: {
          name,
          slug,
          apiKey,
          apiKeyHash,
          webhookUrl: webhookUrl || null,
          webhookSecret,
          isActive: true,
          isCommissionExempt: Boolean(isCommissionExempt),
          logoUrl: logoUrl || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        },
      });

      res.status(201).json({ success: true, application });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/applications/:id
   */
  async updateApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { name, webhookUrl, isActive, isCommissionExempt, logoUrl, contactEmail, contactPhone } = req.body;

      if (webhookUrl !== undefined && webhookUrl !== null && webhookUrl !== '' && !isSafeUrl(webhookUrl)) {
        res.status(400).json({
          success: false,
          error: 'URL de webhook inválida ou rejeitada por segurança (IP privado/loopback não permitido).',
        });
        return;
      }

      const updated = await prisma.application.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(webhookUrl !== undefined ? { webhookUrl } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
          ...(isCommissionExempt !== undefined ? { isCommissionExempt: Boolean(isCommissionExempt) } : {}),
          ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
          ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
          ...(contactPhone !== undefined ? { contactPhone: contactPhone || null } : {}),
        },
      });

      res.json({ success: true, application: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/applications/:id
   */
  async deleteApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = await prisma.application.findUnique({ where: { id } });

      if (!app) {
        res.status(404).json({ success: false, error: 'Aplicação não encontrada.' });
        return;
      }

      await prisma.application.delete({ where: { id } });

      res.json({
        success: true,
        message: `Aplicação '${app.name}' excluída com sucesso.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/applications/:id/transactions
   * POST /api/admin/applications/:id/clear-transactions
   * Limpa todas as transações (pagamentos) e entregas de webhook de uma aplicação específica
   */
  async clearApplicationTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = await prisma.application.findUnique({
        where: { id },
        include: {
          _count: {
            select: { payments: true, deliveries: true },
          },
        },
      });

      if (!app) {
        res.status(404).json({ success: false, error: 'Aplicação não encontrada.' });
        return;
      }

      // Deleta entregas de webhook vinculadas a esta aplicação
      const deletedDeliveries = await prisma.webhookDelivery.deleteMany({
        where: { applicationId: id },
      });

      // Deleta pagamentos da aplicação
      const deletedPayments = await prisma.payment.deleteMany({
        where: { applicationId: id },
      });

      logger.info(
        `[Admin] Limpeza de transações da aplicação '${app.name}' (${app.slug}): ${deletedPayments.count} pagamentos e ${deletedDeliveries.count} entregas removidos.`
      );

      res.json({
        success: true,
        deletedPaymentsCount: deletedPayments.count,
        deletedDeliveriesCount: deletedDeliveries.count,
        message: `${deletedPayments.count} transação(ões) e ${deletedDeliveries.count} entrega(s) de webhook da aplicação '${app.name}' foram limpas com sucesso.`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/applications/:id/regenerate-key
   */
  async regenerateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = await prisma.application.findUnique({ where: { id } });

      if (!app) {
        res.status(404).json({ success: false, error: 'Aplicação não encontrada.' });
        return;
      }

      const randomBytes = crypto.randomBytes(16).toString('hex');
      const newApiKey = `cjc_live_${app.slug}_${randomBytes}`;
      const apiKeyHash = crypto.createHash('sha256').update(newApiKey).digest('hex');

      const updated = await prisma.application.update({
        where: { id },
        data: {
          apiKey: newApiKey,
          apiKeyHash,
        },
      });

      res.json({
        success: true,
        apiKey: newApiKey,
        message: 'Nova Chave de API gerada com sucesso!',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/applications/:id/ping
   * Testa a entrega de webhook disparando requisição de verificação
   */
  async pingWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const app = await prisma.application.findUnique({ where: { id } });

      if (!app || !app.webhookUrl) {
        res.status(400).json({ success: false, error: 'Aplicação não encontrada ou sem URL de webhook.' });
        return;
      }

      if (!isSafeUrl(app.webhookUrl)) {
        res.status(400).json({
          success: false,
          error: 'URL de webhook bloqueada por segurança (SSRF: IP privado ou de loopback).',
        });
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const testPayload = JSON.stringify({
        event: 'system.ping',
        message: 'Teste de conectividade do CJC Dev Pays',
        app_slug: app.slug,
        timestamp,
      });

      const signature = crypto
        .createHmac('sha256', app.webhookSecret)
        .update(`t=${timestamp}&body=${testPayload}`)
        .digest('hex');

      const startTime = Date.now();
      try {
        const response = await axios.post(app.webhookUrl, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-CJC-Signature': `t=${timestamp},v1=${signature}`,
            'X-CJC-App': app.slug,
          },
          timeout: 5000,
        });

        const latency = Date.now() - startTime;
        res.json({
          success: true,
          status: response.status,
          latencyMs: latency,
          message: `Webhook respondeu com HTTP ${response.status} em ${latency}ms!`,
        });
      } catch (pingError: any) {
        const latency = Date.now() - startTime;
        res.status(200).json({
          success: false,
          status: pingError.response?.status || null,
          latencyMs: latency,
          error: pingError.message,
          message: `Endpoint falhou: ${pingError.message} (${latency}ms)`,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/webhooks/deliveries
   */
  async getDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawPage = parseInt(req.query.page as string, 10);
      const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
      const status = req.query.status as string;
      const appId = req.query.appId as string;
      const search = req.query.search as string;

      const where: any = {};
      if (status && status !== 'ALL') {
        where.status = status;
      }
      if (appId && appId !== 'ALL') {
        where.applicationId = appId;
      }
      if (search && search.trim() !== '') {
        where.OR = [
          { targetUrl: { contains: search } },
          { event: { contains: search } },
          { responseBody: { contains: search } },
          { payment: { externalReference: { contains: search } } },
        ];
      }

      const [total, deliveries] = await Promise.all([
        prisma.webhookDelivery.count({ where }),
        prisma.webhookDelivery.findMany({
          where,
          include: {
            application: { select: { id: true, name: true, slug: true } },
            payment: { select: { id: true, externalReference: true, amount: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      res.json({
        success: true,
        deliveries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/webhooks/deliveries/:id
   */
  async getDeliveryDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const delivery = await prisma.webhookDelivery.findUnique({
        where: { id },
        include: {
          application: {
            select: { id: true, name: true, slug: true, webhookUrl: true },
          },
          payment: {
            select: { id: true, externalReference: true, amount: true, status: true, statusDetail: true },
          },
        },
      });

      if (!delivery) {
        res.status(404).json({ success: false, error: 'Registro de entrega não encontrado.' });
        return;
      }

      res.json({ success: true, delivery });
    } catch (error: any) {
      logger.error(`[AdminController] Erro ao carregar detalhes da entrega ${req.params.id}:`, error);
      res.status(500).json({ success: false, error: 'Falha ao buscar detalhes da entrega do webhook.' });
    }
  }

  /**
   * POST /api/admin/webhooks/deliveries/:id/retry
   */
  async retryDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await webhookDispatcher.retryDelivery(id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/admin/simulator/simulate-payment
   * Cria um Pix de teste e permite aprovação imediata ou manual
   */
  async simulatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { applicationId, amount, description, autoApprove } = req.body;

      const app = await prisma.application.findUnique({
        where: { id: applicationId },
      });

      if (!app) {
        res.status(404).json({ success: false, error: 'Aplicação não encontrada.' });
        return;
      }

      const externalRef = `SIM-${app.slug.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      const numAmount = Number(amount || 50);

      const mpResult = await mercadoPagoService.createPix({
        amount: numAmount,
        description: description || `Cobrança de Teste - ${app.name}`,
        externalReference: externalRef,
        payer: { email: 'sandbox@cjcdev.com.br', firstName: 'Cliente', lastName: 'Teste' },
      });

      const feeCalc = await feeService.calculateFees({
        amount: numAmount,
        paymentMethod: 'PIX',
        isCommissionExempt: Boolean(app.isCommissionExempt),
      });

      const payment = await prisma.payment.create({
        data: {
          applicationId: app.id,
          externalReference: externalRef,
          mpPaymentId: mpResult.id,
          paymentMethod: 'PIX',
          status: autoApprove ? 'APPROVED' : 'PENDING',
          statusDetail: autoApprove ? 'accredited' : 'pending_waiting_transfer',
          amount: numAmount,
          feeAmount: feeCalc.totalFeeAmount,
          netReceivedAmount: feeCalc.netReceivedAmount,
          description: description || `Cobrança de Teste - ${app.name}`,
          payerEmail: 'sandbox@cjcdev.com.br',
          payerName: 'Cliente Teste',
          qrCode: mpResult.qrCode,
          qrCodeBase64: mpResult.qrCodeBase64,
          paidAt: autoApprove ? new Date() : null,
        },
        include: { application: true },
      });

      appEvents.emit(autoApprove ? EVENTS.PAYMENT_UPDATED : EVENTS.PAYMENT_CREATED, {
        paymentId: payment.id,
        externalReference: payment.externalReference,
        status: payment.status,
        amount: payment.amount,
        appName: app.name,
      });

      if (autoApprove) {
        await webhookDispatcher.dispatch({
          payment,
          application: app,
          eventName: 'payment.approved',
        });
      }

      res.status(201).json({
        success: true,
        payment,
        message: autoApprove
          ? 'Pagamento simulado criado e aprovado com sucesso! Webhook disparado.'
          : 'Pagamento Pix simulado gerado com sucesso!',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/simulator/approve-payment/:id
   */
  async approveSimulatedPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { application: true },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        return;
      }

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: 'APPROVED',
          statusDetail: 'accredited',
          paidAt: new Date(),
          updatedAt: new Date(),
        },
        include: { application: true },
      });

      appEvents.emit(EVENTS.PAYMENT_UPDATED, {
        paymentId: updated.id,
        externalReference: updated.externalReference,
        status: 'APPROVED',
        amount: updated.amount,
        appName: updated.application.name,
      });

      await webhookDispatcher.dispatch({
        payment: updated,
        application: updated.application,
        eventName: 'payment.approved',
      });

      res.json({
        success: true,
        message: 'Pagamento aprovado e webhook de confirmação disparado!',
        payment: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CRUD DE ADMINISTRADORES ====================

  /**
   * GET /api/admin/users
   */
  async getAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await prisma.adminUser.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ success: true, users });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/users
   */
  async createAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, username, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ success: false, error: 'Nome, e-mail e senha são obrigatórios.' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ success: false, error: 'A senha deve conter no mínimo 6 caracteres.' });
        return;
      }

      const cleanEmail = email.trim().toLowerCase();
      const existingEmail = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
      if (existingEmail) {
        res.status(409).json({ success: false, error: 'Já existe um administrador cadastrado com este e-mail.' });
        return;
      }

      const cleanUsername = username?.trim() || null;
      if (cleanUsername) {
        const existingUser = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
        if (existingUser) {
          res.status(409).json({ success: false, error: 'Este nome de usuário já está em uso.' });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await prisma.adminUser.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          username: cleanUsername,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(201).json({ success: true, user: newUser });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/users/:id
   */
  async updateAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { name, email, username, password } = req.body;

      const existing = await prisma.adminUser.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Administrador não encontrado.' });
        return;
      }

      const dataToUpdate: any = {};
      if (name) dataToUpdate.name = name.trim();

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        if (cleanEmail !== existing.email) {
          const emailInUse = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
          if (emailInUse) {
            res.status(409).json({ success: false, error: 'Este e-mail já pertence a outro administrador.' });
            return;
          }
          dataToUpdate.email = cleanEmail;
        }
      }

      if (username !== undefined) {
        const cleanUsername = username?.trim() || null;
        if (cleanUsername && cleanUsername !== existing.username) {
          const usernameInUse = await prisma.adminUser.findUnique({ where: { username: cleanUsername } });
          if (usernameInUse) {
            res.status(409).json({ success: false, error: 'Este nome de usuário já está em uso.' });
            return;
          }
        }
        dataToUpdate.username = cleanUsername;
      }

      if (password && password.trim() !== '') {
        if (password.length < 6) {
          res.status(400).json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' });
          return;
        }
        dataToUpdate.passwordHash = await bcrypt.hash(password, 10);
      }

      dataToUpdate.updatedAt = new Date();

      const updated = await prisma.adminUser.update({
        where: { id },
        data: dataToUpdate,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({ success: true, user: updated });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/users/:id
   */
  async deleteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const currentUserId = (req as any).adminUser?.id;

      const totalUsers = await prisma.adminUser.count();
      if (totalUsers <= 1) {
        res.status(400).json({
          success: false,
          error: 'Não é possível excluir o único administrador restante do sistema.',
        });
        return;
      }

      if (currentUserId === id) {
        res.status(400).json({
          success: false,
          error: 'Você não pode excluir sua própria conta enquanto estiver conectado a ela.',
        });
        return;
      }

      const existing = await prisma.adminUser.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, error: 'Administrador não encontrado.' });
        return;
      }

      await prisma.adminUser.delete({ where: { id } });

      res.json({ success: true, message: 'Administrador removido com sucesso.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/payments/expired
   * POST /api/admin/payments/expired/purge
   * Remove do histórico pagamentos cancelados/expirados sem pagamento
   */
  async purgeExpiredPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const appId = (req.query.appId as string) || (req.body?.applicationId as string);
      const result = await expirationService.purgeExpiredPayments(appId);

      res.json({
        success: true,
        deletedCount: result.deletedCount,
        message: `${result.deletedCount} pagamento(s) não pago(s)/expirado(s) removido(s) do histórico com sucesso.`,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CONFIGURAÇÃO DE TAXAS E COMISSÕES ====================

  /**
   * GET /api/admin/settings/fees
   */
  async getFeeSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await feeService.getSettings();
      const amount = Number(req.query.amount) || 100;
      const simulation = await feeService.simulateBreakdown(amount);

      res.json({
        success: true,
        settings,
        simulation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/fees
   */
  async updateFeeSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        mpPixFeePercent,
        mpCreditFeePercent,
        mpDebitFeePercent,
        commissionPixPercent,
        commissionCreditPercent,
        commissionDebitPercent,
      } = req.body;

      const updated = await feeService.updateSettings({
        mpPixFeePercent,
        mpCreditFeePercent,
        mpDebitFeePercent,
        commissionPixPercent,
        commissionCreditPercent,
        commissionDebitPercent,
      });

      const simulation = await feeService.simulateBreakdown(100);

      res.json({
        success: true,
        settings: updated,
        simulation,
        message: 'Taxas e comissões atualizadas com sucesso.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/financial/report
   */
  async getFinancialReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, month, year, applicationId, paymentMethod } = req.query;

      const report = await financialService.getFinancialReport({
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        month: month ? parseInt(String(month), 10) : undefined,
        year: year ? parseInt(String(year), 10) : undefined,
        applicationId: applicationId ? String(applicationId) : undefined,
        paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
      });

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/financial/export/csv
   */
  async exportFinancialCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { startDate, endDate, month, year, applicationId, paymentMethod } = req.query;

      const report = await financialService.getFinancialReport({
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        month: month ? parseInt(String(month), 10) : undefined,
        year: year ? parseInt(String(year), 10) : undefined,
        applicationId: applicationId ? String(applicationId) : undefined,
        paymentMethod: paymentMethod ? String(paymentMethod) : undefined,
      });

      const csvContent = financialService.generateFinancialCsv(report);
      const filename = `cjc-pays-financeiro-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/settings/company
   */
  async getCompanySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await companyService.getSettings();
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/settings/company
   */
  async updateCompanySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await companyService.updateSettings(req.body);
      res.json({
        success: true,
        message: 'Informações cadastrais e fiscais da empresa atualizadas com sucesso.',
        settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/financial/audit/register
   */
  async registerReportAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const audit = await auditService.registerReportAudit(req.body);
      res.json({
        success: true,
        audit,
        validationUrl: `https://pays.cjcdev.site/validar.html?codigo=${audit.code}`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/financial/merchant/:id
   */
  async getMerchantReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { month, year } = req.query;

      const report = await financialService.getMerchantSettlementReport(
        id,
        month ? parseInt(String(month), 10) : undefined,
        year ? parseInt(String(year), 10) : undefined
      );

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/financial/merchant/:id/csv
   */
  async exportMerchantCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { month, year } = req.query;

      const report = await financialService.getMerchantSettlementReport(
        id,
        month ? parseInt(String(month), 10) : undefined,
        year ? parseInt(String(year), 10) : undefined
      );

      const csvContent = financialService.exportMerchantCsv(report);
      const filename = `extrato-repasse-${report.application.slug}-${report.year}-${String(report.month).padStart(2, '0')}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
