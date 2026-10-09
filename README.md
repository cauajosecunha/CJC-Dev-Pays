# 💳 CJC-Dev-Pays — Central de Pagamentos & Webhook Dispatcher

**CJC-Dev-Pays** é uma central unificada de orquestração de pagamentos e roteamento de Webhooks desenvolvida em **Node.js**, **TypeScript** e **Prisma ORM**.

Criada para solucionar a limitação de **único Webhook por conta/aplicação no Mercado Pago**, a plataforma atua como um Gateway Central para múltiplos clientes e aplicações do ecossistema CJC Dev (como *Sua Loja*, *Seu Salão*, *FaceCraft*, entre outros).

---

## 🎯 Principais Funcionalidades

- **🔀 Centralizador & Fan-Out de Webhooks**: Recebe o webhook único oficial do Mercado Pago com validação de assinatura HMAC-SHA256 e roteia o evento para o endpoint específico da aplicação de origem com tentativas automáticas e logs.
- **⚡ API Unificada de Pagamentos**: Criação simplificada de cobranças Pix (com Copia-e-Cola e QR Code Base64), Cartão de Crédito e Débito via Mercado Pago.
- **🛡️ Multi-Tenant & Chaves de API**: Autenticação segura por aplicação cliente (`cjc_live_...`), com isolamento total de métricas e histórico.
- **📊 Painel Administrativo Moderno**: Dashboard com visual escuro premium, monitoramento de transações em tempo real, gerador de chaves, logs de webhooks e simulador de testes.
- **🗄️ Prisma ORM**: Persistência tipada e robusta (SQLite por padrão com suporte a PostgreSQL/MySQL).
- **🔄 Polling & Status Instantâneo**: Endpoints otimizados para consulta rápida de status e verificação de conciliação financeira.

---

## 🏗️ Arquitetura Resumida

```
[ Sua Loja ]       [ Seu Salão ]       [ FaceCraft ]
     │                   │                   │
     └─────────────┬─────┴───────────────────┘
                   ▼ (API REST + API Key)
       ┌─────────────────────────────┐
       │        CJC-Dev-Pays         │
       │  (Node.js + Prisma ORM)     │
       └──────────────┬──────────────┘
                      │
                      ▼ (Criação de Cobranças)
             [ Mercado Pago API ]
                      │
                      ▼ (Webhook Oficial Único)
       ┌─────────────────────────────┐
       │   /api/webhooks/mercadopago │
       └──────────────┬──────────────┘
                      │
                      ▼ (Fan-Out Inteligente)
     ┌────────────────┼────────────────┐
     ▼                ▼                ▼
[ Webhook ]      [ Webhook ]      [ Webhook ]
  Sua Loja        Seu Salão        FaceCraft
```

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 20+
- npm ou pnpm

### Instalação & Desenvolvimento
```bash
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

### Execução em Produção com PM2
```bash
# Compilar projeto
npm run build

# Iniciar via PM2
npm run pm2:start

# Monitorar logs
npm run pm2:logs

# Status dos processos
npm run pm2:status

# Reiniciar ou Parar
npm run pm2:restart
npm run pm2:stop
```

---

## 📄 Licença
Propriedade de CJC Dev. Todos os direitos reservados.
