import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4020', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4020',
  jwtSecret: process.env.JWT_SECRET || 'cjc_dev_pays_super_secret_jwt_token_2026',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Mercado Pago
  mpAccessToken: process.env.MP_ACCESS_TOKEN || '',
  mpPublicKey: process.env.MP_PUBLIC_KEY || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  mpSandbox: process.env.MP_SANDBOX === 'true',

  // Webhooks
  webhookMaxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '5', 10),
  webhookRetryIntervalSeconds: parseInt(process.env.WEBHOOK_RETRY_INTERVAL_SECONDS || '60', 10),
};
