/**
 * Exemplo de Endpoint Receptor de Webhooks em Node.js com Express
 * 
 * Requisitos:
 *   npm install express
 * Executar:
 *   node example-webhook-express.js
 */

import express from 'express';
import { CJCPaysWebhook } from './cjcPaysWebhook.js';

const app = express();
const PORT = 3000;

// Segredo do Webhook obtido no painel da Central (https://pays.cjcdev.site)
const WEBHOOK_SECRET = process.env.CJC_WEBHOOK_SECRET || 'whsec_SEU_SEGREDO_AQUI';

/**
 * IMPORTANTE: Para validar assinaturas criptográficas HMAC,
 * precisamos capturar o corpo BRUTO (rawBody) da requisição antes do parse.
 */
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf-8');
    },
  })
);

// Rota de recepção de Webhooks do CJC-Dev-Pays
app.post('/api/webhooks/cjc-pays', async (req, res) => {
  const signatureHeader = req.headers['x-cjc-signature'];

  try {
    // 1. Valida a autenticidade e integridade da requisição
    const payload = CJCPaysWebhook.verify({
      rawBody: req.rawBody,
      signatureHeader,
      secret: WEBHOOK_SECRET,
      tolerance: 300, // tolerância de 5 minutos
    });

    console.log('🔔 Webhook autêntico recebido!');
    console.log(`Evento: ${payload.event} | Status: ${payload.status}`);
    console.log(`Referência: ${payload.external_reference} | ID: ${payload.payment_id}`);

    // 2. Processa as regras de negócio e contabilidade conforme o status
    switch (payload.status) {
      case 'approved': {
        const metadata = payload.metadata || {};
        const estabelecimentoId = metadata.estabelecimento_id;
        const valorBruto = Number(payload.amount || 0);
        const valorLiquido = Number(payload.net_received_amount ?? valorBruto);
        const taxaPlataformaPct = Number(metadata.taxa_plataforma_pct || 0);

        // Cálculo contábil de repasse ao estabelecimento
        const comissaoPlataforma = (valorLiquido * taxaPlataformaPct) / 100;
        const repasseLojista = valorLiquido - comissaoPlataforma;

        console.log(`✅ Pagamento APROVADO! Ref: ${payload.external_reference}`);
        console.log(`🏢 Estabelecimento: ${estabelecimentoId} | Líquido: R$ ${valorLiquido.toFixed(2)} | Repasse: R$ ${repasseLojista.toFixed(2)}`);

        // await PedidosService.aprovar(payload.external_reference);
        // await ContabilidadeService.creditarConta(estabelecimentoId, repasseLojista);
        break;
      }

      case 'rejected':
        console.log(`❌ Pagamento RECUSADO: ${payload.external_reference}`);
        break;

      case 'refunded':
      case 'cancelled':
        console.log(`↩️ Pagamento ESTORNADO/CANCELADO: ${payload.external_reference}`);
        break;

      default:
        console.log(`⏳ Status em processamento: ${payload.status}`);
        break;
    }

    // 3. Responda obrigatoriamente com status 200 para confirmar entrega
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('⚠️ Falha ao validar webhook:', err.message);
    res.status(400).json({
      received: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Webhook escutando em http://localhost:${PORT}`);
  console.log(`📍 Endpoint configurado: http://localhost:${PORT}/api/webhooks/cjc-pays`);
});
