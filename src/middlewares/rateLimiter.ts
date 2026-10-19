import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter para a rota de autenticação administrativa.
 * Limita a 5 tentativas a cada 15 minutos por IP para prevenir força bruta e credential stuffing.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Muitas tentativas de login a partir deste IP. Tente novamente após 15 minutos.',
  },
});

/**
 * Rate Limiter geral para a API de pagamentos.
 * Limita a 300 requisições por janela de 15 minutos por IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Limite de requisições excedido. Reduza o volume de chamadas à API.',
  },
});

/**
 * Rate Limiter para ingestão de webhooks.
 * Limita a 120 requisições por minuto por IP.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Taxa excessiva de notificações de webhook recebidas.',
  },
});
