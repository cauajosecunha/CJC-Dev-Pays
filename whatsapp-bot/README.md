# CJC-Dev-Pays WhatsApp Notifier Bot 📲

Versão atual: **1.0.0**

O **CJC-Dev-Pays WhatsApp Notifier** é o módulo e microserviço dedicado para envio de notificações em tempo real de **transações aprovadas** e **estornadas** (reembolsos e contestações) diretamente no grupo da equipe no WhatsApp via **GOWA API** (Go WhatsApp Web Multi-Device).

> ⚠️ **Aviso de Infraestrutura:** O contêiner Docker da GOWA (`aldinokemal2104/go-whatsapp-web-multidevice`) **JÁ ESTÁ EM EXECUÇÃO NO SERVIDOR DE PRODUÇÃO**. Nunca execute `docker compose up` neste diretório.

---

## 🎯 Configurações Oficiais de Produção

- **Grupo Alvo**: `120363430697662911@g.us` (ID: `120363430697662911`)
- **GOWA API URL**: `http://192.168.3.177:3031`
- **Device ID**: `5d6a4868-c62e-410a-9e42-1b84fc6e5b49`
- **Porta do Bot HTTP (Opcional/PM2)**: `4021` (Reservada na faixa 4000 do servidor)

---

## 🏗️ Estrutura de Arquivos

```text
whatsapp-bot/
├── src/
│   ├── index.js        # Entrypoint do pacote para importação ou execução
│   ├── broadcaster.js  # Comunicação com GOWA API e formatação de mensagens
│   └── app.js          # Servidor Express opcional (POST /notify-transaction, etc.)
├── docs/               # Documentação completa e OpenAPI da GOWA API
├── docker-compose.yml  # Apenas referência (já em execução no servidor)
├── package.json        # Dependências e scripts de teste
└── README.md           # Esta documentação
```

---

## 💬 Formatos das Notificações

### 1. Pagamento Aprovado (`APPROVED`)
```text
✅ *Pagamento Aprovado!* 💸

🏢 *Aplicação:* Sua Loja Delivery (`sualoja`)
💰 *Valor:* *R$ 149,90*
💳 *Método:* ⚡ Pix
🏷️ *Referência:* `PED-10293`
🆔 *ID Mercado Pago:* `10987654320`
👤 *Cliente:* João da Silva
📧 *E-mail:* joao@email.com
📝 *Descrição:* Pedido #10293 - Combo Família

🕒 10/10/2026, 19:45:00
```

### 2. Pagamento Estornado (`REFUNDED` / `CHARGED_BACK`)
```text
↩️ *Pagamento Estornado!* ⚠️

🏢 *Aplicação:* Sua Loja Delivery (`sualoja`)
💰 *Valor Estornado:* *R$ 79,90*
💳 *Método:* ⚡ Pix
🏷️ *Referência:* `PED-10290`
🆔 *ID Mercado Pago:* `10987654315`
👤 *Cliente:* Maria Souza
⚠️ *Motivo/Detalhes:* Estorno solicitado pelo cliente

🕒 10/10/2026, 19:50:00
```

---

## 🧪 Testes via Linha de Comando (CLI)

No diretório `whatsapp-bot`:

```bash
# Testar notificação de pagamento aprovado
npm run test:approved
# ou
npm run test:notify

# Testar notificação de estorno
npm run test:refund
```

---

## 🌐 Endpoints do Microserviço HTTP (`app.js`)

Se executado via `npm start` (porta padrão `4021`):

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Status de saúde, grupo alvo, URL da GOWA e Device ID |
| `POST` | `/notify-transaction` | Notifica transação (direciona aprovado ou estorno pelo status) |
| `POST` | `/notify-approved` | Dispara mensagem de pagamento aprovado |
| `POST` | `/notify-refunded` | Dispara mensagem de pagamento estornado |
| `POST` | `/send` | Envia mensagem de texto genérica para o grupo |
| `POST` | `/webhook` | Confirmação de recebimento para o GOWA |

---

## ⚙️ Variáveis de Ambiente (.env)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `GOWA_API_URL` | `http://192.168.3.177:3031` | Endpoint da GOWA API |
| `GOWA_DEVICE_ID` | `5d6a4868-c62e-410a-9e42-1b84fc6e5b49` | Device ID do WhatsApp conectado |
| `WHATSAPP_GROUP_JID` | `120363430697662911@g.us` | JID do grupo receptor |
| `WHATSAPP_NOTIFICATIONS_ENABLED` | `true` | Habilita/desabilita envios |
| `WHATSAPP_BOT_PORT` | `4021` | Porta HTTP se rodar standalone via PM2 |
