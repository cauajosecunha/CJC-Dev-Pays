/**
 * Módulo Broadcaster - CJC-Dev-Pays WhatsApp Notifier
 * Envio de notificações de transações aprovadas e estornadas via GOWA API
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');

const API_URL = process.env.GOWA_API_URL || 'http://192.168.3.177:3031';
const DEVICE_ID = process.env.GOWA_DEVICE_ID || '5d6a4868-c62e-410a-9e42-1b84fc6e5b49';
const DEFAULT_GROUP_JID = process.env.WHATSAPP_GROUP_JID || '120363430697662911@g.us';

const api = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        ...(DEVICE_ID && { 'X-Device-Id': DEVICE_ID })
    }
});

/**
 * Normaliza o ID/JID do grupo
 */
function formatJid(jid) {
    if (!jid) return DEFAULT_GROUP_JID;
    return jid.includes('@') ? jid : `${jid}@g.us`;
}

/**
 * Formata valor numérico para o padrão de moeda brasileira (R$)
 */
function formatCurrency(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Traduz/Formata método de pagamento
 */
function formatPaymentMethod(method) {
    if (!method) return 'Não informado';
    const m = String(method).toUpperCase();
    switch (m) {
        case 'PIX':
            return '⚡ Pix';
        case 'CREDIT_CARD':
            return '💳 Cartão de Crédito';
        case 'DEBIT_CARD':
            return '💳 Cartão de Débito';
        case 'BOLETO':
            return '📄 Boleto Bancário';
        default:
            return m;
    }
}

/**
 * Envia uma mensagem de texto simples para um chat/grupo via GOWA API
 */
async function enviarMensagem(mensagem, jid = DEFAULT_GROUP_JID) {
    const targetJid = formatJid(jid);

    try {
        const response = await api.post('/send/message', {
            phone: targetJid,
            message: mensagem
        });

        console.log(`[CJC-PAYS WHATSAPP] ✅ Mensagem enviada com sucesso para ${targetJid}`);
        return { success: true, data: response.data };
    } catch (error) {
        const errMsg = error.response?.data?.message || error.message;
        console.error(`[CJC-PAYS WHATSAPP] ❌ Erro ao enviar mensagem para ${targetJid}: ${errMsg}`);
        return { success: false, error: errMsg };
    }
}

/**
 * Formata e envia notificação de Transação Aprovada
 * @param {Object} paymentData
 * @param {string|number} paymentData.amount - Valor da transação
 * @param {string} [paymentData.appName] - Nome da aplicação/loja
 * @param {string} [paymentData.appSlug] - Slug da aplicação
 * @param {string} [paymentData.paymentMethod] - PIX, CREDIT_CARD, etc.
 * @param {string} [paymentData.externalReference] - Referência externa do pedido
 * @param {string|number} [paymentData.mpPaymentId] - ID no Mercado Pago
 * @param {string} [paymentData.payerName] - Nome do cliente
 * @param {string} [paymentData.payerEmail] - E-mail do cliente
 * @param {string} [paymentData.description] - Descrição da transação
 * @param {string} [paymentData.paidAt] - Data do pagamento
 * @param {string} [paymentData.jid] - JID customizado (opcional)
 */
async function enviarNotificacaoAprovado(paymentData) {
    const {
        amount = 0,
        appName = 'CJC-Dev-Pays',
        appSlug = '',
        paymentMethod = 'PIX',
        externalReference = '',
        mpPaymentId = '',
        payerName = '',
        payerEmail = '',
        description = '',
        paidAt,
        jid = DEFAULT_GROUP_JID
    } = paymentData;

    const dateStr = paidAt
        ? new Date(paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let msg = `✅ *Pagamento Aprovado!* 💸\n\n`;

    const appDisplay = appSlug ? `${appName} (\`${appSlug}\`)` : appName;
    msg += `🏢 *Aplicação:* ${appDisplay}\n`;
    msg += `💰 *Valor:* *${formatCurrency(amount)}*\n`;
    msg += `💳 *Método:* ${formatPaymentMethod(paymentMethod)}\n`;

    if (externalReference) {
        msg += `🏷️ *Referência:* \`${externalReference}\`\n`;
    }

    if (mpPaymentId) {
        msg += `🆔 *ID Mercado Pago:* \`${mpPaymentId}\`\n`;
    }

    if (payerName) {
        msg += `👤 *Cliente:* ${payerName}\n`;
    }

    if (payerEmail) {
        msg += `📧 *E-mail:* ${payerEmail}\n`;
    }

    if (description) {
        const cleanDesc = description.length > 80 ? description.substring(0, 77) + '...' : description;
        msg += `📝 *Descrição:* ${cleanDesc}\n`;
    }

    msg += `\n🕒 ${dateStr}`;

    return await enviarMensagem(msg, jid);
}

/**
 * Formata e envia notificação de Transação Estornada (Refund / Chargeback)
 * @param {Object} paymentData
 * @param {string|number} paymentData.amount - Valor da transação
 * @param {string} [paymentData.appName] - Nome da aplicação/loja
 * @param {string} [paymentData.appSlug] - Slug da aplicação
 * @param {string} [paymentData.paymentMethod] - PIX, CREDIT_CARD, etc.
 * @param {string} [paymentData.externalReference] - Referência externa do pedido
 * @param {string|number} [paymentData.mpPaymentId] - ID no Mercado Pago
 * @param {string} [paymentData.payerName] - Nome do cliente
 * @param {string} [paymentData.reason] - Motivo ou detalhe do estorno
 * @param {string} [paymentData.refundedAt] - Data do estorno
 * @param {string} [paymentData.jid] - JID customizado (opcional)
 */
async function enviarNotificacaoEstorno(paymentData) {
    const {
        amount = 0,
        appName = 'CJC-Dev-Pays',
        appSlug = '',
        paymentMethod = 'PIX',
        externalReference = '',
        mpPaymentId = '',
        payerName = '',
        reason = 'Estorno solicitado',
        refundedAt,
        jid = DEFAULT_GROUP_JID
    } = paymentData;

    const dateStr = refundedAt
        ? new Date(refundedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let msg = `↩️ *Pagamento Estornado!* ⚠️\n\n`;

    const appDisplay = appSlug ? `${appName} (\`${appSlug}\`)` : appName;
    msg += `🏢 *Aplicação:* ${appDisplay}\n`;
    msg += `💰 *Valor Estornado:* *${formatCurrency(amount)}*\n`;
    msg += `💳 *Método:* ${formatPaymentMethod(paymentMethod)}\n`;

    if (externalReference) {
        msg += `🏷️ *Referência:* \`${externalReference}\`\n`;
    }

    if (mpPaymentId) {
        msg += `🆔 *ID Mercado Pago:* \`${mpPaymentId}\`\n`;
    }

    if (payerName) {
        msg += `👤 *Cliente:* ${payerName}\n`;
    }

    if (reason) {
        msg += `⚠️ *Motivo/Detalhes:* ${reason}\n`;
    }

    msg += `\n🕒 ${dateStr}`;

    return await enviarMensagem(msg, jid);
}

/**
 * Função genérica para notificar transação com base no status
 */
async function enviarNotificacaoTransacao(paymentData) {
    const status = String(paymentData.status || '').toUpperCase();
    if (status === 'APPROVED') {
        return await enviarNotificacaoAprovado(paymentData);
    } else if (status === 'REFUNDED' || status === 'CHARGED_BACK') {
        return await enviarNotificacaoEstorno(paymentData);
    } else {
        console.log(`[CJC-PAYS WHATSAPP] Status '${status}' não configurado para notificação.`);
        return { success: false, ignored: true, reason: `Status ${status} ignorado` };
    }
}

// Teste rápido via CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const mode = args[0] || 'approved';

    console.log(`[CJC-PAYS WHATSAPP] Executando teste de envio (${mode}) para o grupo ${DEFAULT_GROUP_JID}...`);

    if (mode === 'refund' || mode === 'estorno') {
        enviarNotificacaoEstorno({
            amount: 79.90,
            appName: 'Sua Loja Delivery',
            appSlug: 'sualoja',
            paymentMethod: 'PIX',
            externalReference: 'PED-TEST-9981',
            mpPaymentId: '10987654321',
            payerName: 'Cliente Teste Estorno',
            reason: 'Cancelamento solicitado pelo cliente'
        }).then(res => {
            console.log('[CJC-PAYS WHATSAPP] Resultado do teste:', res);
            process.exit(res.success ? 0 : 1);
        });
    } else {
        enviarNotificacaoAprovado({
            amount: 149.90,
            appName: 'Sua Loja Delivery',
            appSlug: 'sualoja',
            paymentMethod: 'PIX',
            externalReference: 'PED-TEST-9980',
            mpPaymentId: '10987654320',
            payerName: 'Cliente Teste Aprovado',
            payerEmail: 'cliente@exemplo.com',
            description: 'Pedido #9980 - Combo Especial'
        }).then(res => {
            console.log('[CJC-PAYS WHATSAPP] Resultado do teste:', res);
            process.exit(res.success ? 0 : 1);
        });
    }
}

module.exports = {
    enviarMensagem,
    enviarNotificacaoTransacao,
    enviarNotificacaoAprovado,
    enviarNotificacaoEstorno,
    formatCurrency,
    formatPaymentMethod,
    formatJid,
    DEFAULT_GROUP_JID,
    API_URL,
    DEVICE_ID
};
