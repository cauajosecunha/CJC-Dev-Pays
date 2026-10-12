import { app } from './app.js';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { webhookDispatcher } from './services/webhookDispatcher.js';
import { prisma } from './lib/prisma.js';
import { initDatabase } from './lib/dbInit.js';

// Auto-migração e verificação do banco de dados na inicialização
await initDatabase();

const server = app.listen(config.port, () => {
  logger.success(`🚀 CJC-Dev-Pays rodando com sucesso na porta ${config.port}!`);
  logger.info(`📍 Modo Mercado Pago: ${config.mpSandbox ? '🟡 SANDBOX (Testes)' : '🟢 PRODUÇÃO (Live)'}`);
  logger.info(`📍 MP Public Key ativa: ${config.mpPublicKey ? config.mpPublicKey.substring(0, 15) + '...' : '(não configurada)'}`);
  logger.info(`📍 Painel Web: http://localhost:${config.port}`);
  logger.info(`📍 Webhook MP Único: http://localhost:${config.port}/api/webhooks/mercadopago`);
  logger.info(`📍 API Base: http://localhost:${config.port}/api/v1`);
});

// Loop periódico em background para reprocessar webhooks que falharam (a cada 30 segundos)
const retryInterval = setInterval(() => {
  webhookDispatcher.processPendingRetries();
}, 30000);

// Encerramento gracioso
const shutdown = async () => {
  logger.info('Encerrando servidor CJC-Dev-Pays graciosamente...');
  clearInterval(retryInterval);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Servidor finalizado e conexões com o banco encerradas.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
