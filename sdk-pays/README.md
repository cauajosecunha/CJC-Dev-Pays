# 📦 SDKs Oficiais de Integração — CJC-Dev-Pays

Esta pasta contém kits de desenvolvimento (SDKs) prontos para copiar e colar em qualquer aplicação do ecossistema CJC Dev, permitindo integrar o fluxo de pagamento com a **Central CJC-Dev-Pays** em minutos.

---

## 📂 Subpastas Disponíveis

### 1. [sdk-pays-php/](./sdk-pays-php/)
- **Linguagem:** PHP 7.4 / 8.0 / 8.1+
- **Dependências:** Nenhuma (100% nativo com cURL e JSON)
- **Casos de Uso:** Sites WordPress, WooCommerce, Laravel, scripts legados, WebApps PHP (*Sua Loja*, *Seu Salão*).
- **Conteúdo:**
  - `CJCPaysClient.php` — Classe cliente para criar Pix, consultar status e estornar.
  - `CJCPaysWebhook.php` — Validador de assinatura HMAC-SHA256 para o endpoint de webhook.
  - `example_create_pix.php` — Script de exemplo para emissão de Pix.
  - `example_check_status.php` — Script de exemplo de consulta.
  - `example_refund.php` — Script de exemplo para estorno.
  - `example_webhook.php` — Script de endpoint receptor de webhooks.

### 2. [sdk-pays-node/](./sdk-pays-node/)
- **Linguagem:** Node.js (v18+) / TypeScript / JavaScript (ESM)
- **Dependências:** Nenhuma para o client (Fetch API e `node:crypto` nativos). Express opcional para o servidor de webhook.
- **Casos de Uso:** APIs Express, NestJS, Fastify, bots WhatsApp/Discord (*FaceCraft*, GOWA, microserviços).
- **Conteúdo:**
  - `cjcPaysClient.js` — Classe cliente completa com AbortController e Fetch nativo.
  - `cjcPaysWebhook.js` — Validador de assinatura criptográfica HMAC.
  - `example-create-pix.js` — Exemplo executável de geração de Pix.
  - `example-check-status.js` — Exemplo de consulta.
  - `example-refund.js` — Exemplo de estorno.
  - `example-webhook-express.js` — Servidor Express de exemplo para recepção de webhook.

---

---

## 🔑 Credenciais e Variáveis de Ambiente (`.env`)

Cadastre cada loja/projeto no painel da Central em **Aplicações & Chaves**. No card da loja, clique em **📋 Copiar .env**. O `.env` da loja precisará exclusivamente destas 3 variáveis:

```ini
CJC_PAYS_BASE_URL=https://pays.cjcdev.site
CJC_PAYS_API_KEY=cjc_live_CHAVE_DESTA_LOJA
CJC_PAYS_WEBHOOK_SECRET=whsec_SEGREDO_DESTA_LOJA
```

> **Nota:** O `{ID_ESTABELECIMENTO}` contábil é gerenciado e prefixado **automaticamente** pela Central a partir da chave de API da loja. O código da loja não precisa configurar ou enviar códigos adicionais.
