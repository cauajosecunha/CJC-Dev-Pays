import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/env.js';
import { metricsService } from '../services/metricsService.js';
import { webhookDispatcher } from '../services/webhookDispatcher.js';
import { mercadoPagoService } from '../services/mercadoPagoService.js';
import { appEvents, EVENTS } from '../lib/eventEmitter.js';
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
      const data = await metricsService.getDashboardMetrics();
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
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

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { application: true },
      });

      if (!payment) {
        res.status(404).json({ success: false, error: 'Pagamento não encontrado.' });
        return;
      }

      if (payment.status !== 'APPROVED') {
        res.status(400).json({ success: false, error: 'Apenas pagamentos aprovados podem ser estornados.' });
        return;
      }

      if (payment.mpPaymentId) {
        await mercadoPagoService.refundPayment(payment.mpPaymentId);
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
      const applications = await prisma.application.findMany({
        include: {
          _count: {
            select: { payments: true, deliveries: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, applications });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/applications
   */
  async createApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, webhookUrl } = req.body;

      if (!name || !slug) {
        res.status(400).json({ success: false, error: 'Nome e slug são obrigatórios.' });
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
      const { name, webhookUrl, isActive } = req.body;

      const updated = await prisma.application.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(webhookUrl !== undefined ? { webhookUrl } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
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

      const timestamp = Math.floor(Date.now() / 1000);
      const testPayload = JSON.stringify({
        event: 'system.ping',
        message: 'Teste de conectividade do CJC-Dev-Pays',
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
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
          application: true,
          payment: true,
        },
      });

      if (!delivery) {
        res.status(404).json({ success: false, error: 'Registro de entrega não encontrado.' });
        return;
      }

      res.json({ success: true, delivery });
    } catch (error) {
      next(error);
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

      const payment = await prisma.payment.create({
        data: {
          applicationId: app.id,
          externalReference: externalRef,
          mpPaymentId: mpResult.id,
          paymentMethod: 'PIX',
          status: autoApprove ? 'APPROVED' : 'PENDING',
          statusDetail: autoApprove ? 'accredited' : 'pending_waiting_transfer',
          amount: numAmount,
          feeAmount: Number((numAmount * 0.0099).toFixed(2)),
          netReceivedAmount: Number((numAmount * 0.9901).toFixed(2)),
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
}

export const adminController = new AdminController();
