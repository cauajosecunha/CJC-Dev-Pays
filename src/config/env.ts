import dotenv from 'dotenv';
dotenv.config();

const isSandbox = process.env.MP_SANDBOX === 'true';

export const config = {
  port: parseInt(process.env.PORT || '4020', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4020',
  jwtSecret: process.env.JWT_SECRET || 'cjc_dev_pays_super_secret_jwt_token_2026',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Mercado Pago
  mpSandbox: isSandbox,
  mpAccessToken: (isSandbox && process.env.MP_TEST_ACCESS_TOKEN)
    ? process.env.MP_TEST_ACCESS_TOKEN
    : (process.env.MP_ACCESS_TOKEN || ''),
  mpPublicKey: (isSandbox && process.env.MP_TEST_PUBLIC_KEY)
    ? process.env.MP_TEST_PUBLIC_KEY
    : (process.env.MP_PUBLIC_KEY || ''),
  mpClientId: process.env.MP_CLIENT_ID || '',
  mpClientSecret: process.env.MP_CLIENT_SECRET || '',
  mpTestAccessToken: process.env.MP_TEST_ACCESS_TOKEN || '',
  mpTestPublicKey: process.env.MP_TEST_PUBLIC_KEY || '',
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',

  // Webhooks
  webhookMaxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '5', 10),
  webhookRetryIntervalSeconds: parseInt(process.env.WEBHOOK_RETRY_INTERVAL_SECONDS || '60', 10),
};
