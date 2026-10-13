import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Carrega estritamente o .env da raiz do projeto forçando sobrescrita de variáveis cacheadas pelo PM2/shell
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath, override: true });

const isSandbox = String(process.env.MP_SANDBOX || '').trim().toLowerCase() === 'true';

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

  // WhatsApp Notifier (GOWA API)
  gowaApiUrl: process.env.GOWA_API_URL || 'http://192.168.3.177:3102',
  gowaDeviceId: process.env.GOWA_DEVICE_ID || '5d6a4868-c62e-410a-9e42-1b84fc6e5b49',
  whatsappGroupJid: process.env.WHATSAPP_GROUP_JID || '120363430697662911@g.us',
  whatsappNotificationsEnabled: process.env.WHATSAPP_NOTIFICATIONS_ENABLED !== 'false',
};

