import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { sseStreamHandler } from '../controllers/sseController.js';
import { adminAuth } from '../middlewares/adminAuth.js';
import { loginLimiter } from '../middlewares/rateLimiter.js';

export const adminRouter = Router();

// Rota pública de login com proteção de rate limit contra força bruta
adminRouter.post('/auth/login', loginLimiter, (req, res, next) => adminController.login(req, res, next));

// Rotas protegidas por autenticação administrativa
adminRouter.use(adminAuth);

// SSE Stream para tempo real no dashboard
adminRouter.get('/events/stream', (req, res) => sseStreamHandler(req, res));

// Métricas e dados consolidados
adminRouter.get('/metrics', (req, res, next) => adminController.getMetrics(req, res, next));

// Gestão de pagamentos
adminRouter.get('/payments', (req, res, next) => adminController.getPayments(req, res, next));
adminRouter.delete('/payments/expired', (req, res, next) => adminController.purgeExpiredPayments(req, res, next));
adminRouter.post('/payments/expired/purge', (req, res, next) => adminController.purgeExpiredPayments(req, res, next));
adminRouter.get('/payments/:id', (req, res, next) => adminController.getPaymentDetails(req, res, next));
adminRouter.post('/payments/:id/refund', (req, res, next) => adminController.refundPayment(req, res, next));

// Gestão de aplicações clientes
adminRouter.get('/applications', (req, res, next) => adminController.getApplications(req, res, next));
adminRouter.post('/applications', (req, res, next) => adminController.createApplication(req, res, next));
adminRouter.put('/applications/:id', (req, res, next) => adminController.updateApplication(req, res, next));
adminRouter.delete('/applications/:id', (req, res, next) => adminController.deleteApplication(req, res, next));
adminRouter.delete('/applications/:id/transactions', (req, res, next) => adminController.clearApplicationTransactions(req, res, next));
adminRouter.post('/applications/:id/clear-transactions', (req, res, next) => adminController.clearApplicationTransactions(req, res, next));
adminRouter.post('/applications/:id/regenerate-key', (req, res, next) => adminController.regenerateApiKey(req, res, next));
adminRouter.post('/applications/:id/ping', (req, res, next) => adminController.pingWebhook(req, res, next));

// Monitor de webhooks e entregas
adminRouter.get('/webhooks/deliveries', (req, res, next) => adminController.getDeliveries(req, res, next));
adminRouter.get('/webhooks/deliveries/:id', (req, res, next) => adminController.getDeliveryDetails(req, res, next));
adminRouter.post('/webhooks/deliveries/:id/retry', (req, res, next) => adminController.retryDelivery(req, res, next));

// Gestão de administradores do sistema (CRUD)
adminRouter.get('/users', (req, res, next) => adminController.getAdminUsers(req, res, next));
adminRouter.post('/users', (req, res, next) => adminController.createAdminUser(req, res, next));
adminRouter.put('/users/:id', (req, res, next) => adminController.updateAdminUser(req, res, next));
adminRouter.delete('/users/:id', (req, res, next) => adminController.deleteAdminUser(req, res, next));

// Simulador Sandbox para testes
adminRouter.post('/simulator/simulate-payment', (req, res, next) => adminController.simulatePayment(req, res, next));
adminRouter.post('/simulator/approve-payment/:id', (req, res, next) => adminController.approveSimulatedPayment(req, res, next));

// Configurações de taxas da plataforma e do Mercado Pago
adminRouter.get('/settings/fees', (req, res, next) => adminController.getFeeSettings(req, res, next));
adminRouter.put('/settings/fees', (req, res, next) => adminController.updateFeeSettings(req, res, next));

// Configurações fiscais e cadastrais da empresa
adminRouter.get('/settings/company', (req, res, next) => adminController.getCompanySettings(req, res, next));
adminRouter.put('/settings/company', (req, res, next) => adminController.updateCompanySettings(req, res, next));

// Relatório Financeiro e Contábil
adminRouter.get('/financial/report', (req, res, next) => adminController.getFinancialReport(req, res, next));
adminRouter.get('/financial/export/csv', (req, res, next) => adminController.exportFinancialCsv(req, res, next));
adminRouter.post('/financial/audit/register', (req, res, next) => adminController.registerReportAudit(req, res, next));

