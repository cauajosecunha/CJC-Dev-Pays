# 🟢 CJC-Dev-Pays — SDK Node.js

SDK moderno para Node.js (Node 18+) **sem dependências obrigatórias** (utiliza Fetch API e módulo `crypto` nativos) para conectar aplicações Express, Fastify, NestJS, Next.js ou bots à Central de Pagamentos **CJC-Dev-Pays**.

---

## 📁 Estrutura dos Arquivos

| Arquivo | Descrição |
|---|---|
| `cjcPaysClient.js` | Classe principal para comunicação com a API (criar Pix, consultar status, estornar). |
| `cjcPaysWebhook.js` | Validador de assinatura criptográfica HMAC-SHA256 (`X-CJC-Signature`) para webhooks. |
| `example-create-pix.js` | Exemplo executável de criação de cobrança Pix com retorno de QR Code e Copia-e-Cola. |
| `example-check-status.js` | Exemplo executável de consulta de status por ID ou referência externa. |
| `example-refund.js` | Exemplo executável de estorno/cancelamento de pagamento. |
| `example-webhook-express.js` | Servidor Express completo demonstrando recebimento seguro de webhooks. |

---

## 🚀 Como Integrar no seu Projeto Node.js

### 1. Copie os Arquivos
Copie `cjcPaysClient.js` e `cjcPaysWebhook.js` para a pasta de serviços ou libs do seu projeto (ex: `src/services/payments/`).

### 2. Configure o `.env` da sua Aplicação
No painel da Central (**Aplicações & Chaves**), clique em **📋 Copiar .env** no card da sua aplicação e cole no `.env`:
```ini
CJC_PAYS_BASE_URL=https://pays.cjcdev.site
CJC_PAYS_API_KEY=cjc_live_CHAVE_DESTA_LOJA
CJC_PAYS_WEBHOOK_SECRET=whsec_SEGREDO_DESTA_LOJA
```

---

## 🏢 Padrão de Contabilidade e Identificação Automática

A Central de Pagamentos associa cada transação automaticamente ao `{ID_ESTABELECIMENTO}` da aplicação a partir da `X-Api-Key` enviada.

Se você enviar `external_reference: "PEDIDO-12345"`, a Central prefixará automaticamente o código da loja (ex: `SUA-LOJA-PEDIDO-12345`) e preencherá os metadados contábeis (`estabelecimento_id`, `estabelecimento_nome`).

Caso queira construir ou decodificar a referência manualmente, o SDK disponibiliza:
```javascript
const ref = CJCPaysClient.buildExternalReference('SUA-LOJA', 'PEDIDO', 12345);
// Retorna: 'SUA-LOJA-PEDIDO-12345'

const dados = CJCPaysClient.parseExternalReference(ref);
// { estabelecimento_id: 'SUA-LOJA', tipo: 'PEDIDO', pedido_id: '12345' }
```

---

## ⚡ Exemplos Rápidos de Uso

### Gerar Cobrança PIX
```javascript
import { CJCPaysClient } from './cjcPaysClient.js';

const client = new CJCPaysClient({
  apiKey: 'cjc_live_SUA_CHAVE_AQUI',
  baseUrl: 'https://pays.cjcdev.site' // Ou http://localhost:4020
});

const ref = CJCPaysClient.buildExternalReference('ESTAB002', 'PEDIDO', 12345);

const result = await client.createPix({
  external_reference: ref,
  amount: 49.90,
  description: 'Pedido #12345 - Sua Loja Delivery',
  payer: {
    email: 'cliente@exemplo.com',
    first_name: 'Cauã',
    last_name: 'Cunha',
    identification: {
      type: 'CPF',
      number: '12345678909'
    }
  },
  metadata: {
    estabelecimento_id: 'ESTAB002',
    estabelecimento_nome: 'Sua Loja Delivery',
    estabelecimento_tipo: 'delivery',
    pedido_id: 12345,
    taxa_plataforma_pct: 5.0
  }
});

console.log('ID do Pagamento:', result.payment.id);
console.log('Copia e Cola:', result.payment.qr_code);
console.log('QR Code Base64:', result.payment.qr_code_base64);
```

### Receber e Validar Webhook no Express
```javascript
import express from 'express';
import { CJCPaysWebhook } from './cjcPaysWebhook.js';

const app = express();

// IMPORTANTE: Captura o rawBody para checagem da assinatura
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf-8'); }
}));

app.post('/api/webhooks/cjc-pays', (req, res) => {
  try {
    const payload = CJCPaysWebhook.verify({
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-cjc-signature'],
      secret: 'whsec_SEU_SEGREDO_AQUI'
    });

    if (payload.status === 'approved') {
      console.log('Pagamento Aprovado para:', payload.external_reference);
      // Libere o pedido aqui
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

---

## 🤖 Prompt Pronto para Enviar à IA da sua Loja

Ao colar esta pasta `sdk-pays-node/` na raiz do projeto da sua aplicação e copiar o `.env` do painel, basta enviar o seguinte comando para o seu assistente de IA (Antigravity / Cursor / Claude):

> *"Integre o gateway de pagamentos no checkout do meu sistema usando o SDK em `sdk-pays-node/`. Utilize as variáveis `CJC_PAYS_BASE_URL`, `CJC_PAYS_API_KEY` e `CJC_PAYS_WEBHOOK_SECRET` do `.env`. Crie o fluxo de emissão de cobrança Pix exibindo o QR Code/Copia-e-Cola e implemente a rota de webhook com validação HMAC via `CJCPaysWebhook.verify` para aprovar os pedidos automaticamente."*
