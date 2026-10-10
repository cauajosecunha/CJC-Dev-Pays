/**
 * CJC-Dev-Pays WhatsApp Bot — app.js
 * Microserviço dedicado para envio de notificações de transações (aprovadas e estornadas) via WhatsApp
 */

const express = require('express');
const {
    enviarNotificacaoTransacao,
    enviarNotificacaoAprovado,
    enviarNotificacaoEstorno,
    enviarMensagem,
    DEFAULT_GROUP_JID,
    API_URL,
    DEVICE_ID
} = require('./broadcaster');

const app = express();
const PORT = parseInt(process.env.WHATSAPP_BOT_PORT || process.env.BOT_PORT || '4021', 10);
const API_SECRET = process.env.BOT_API_SECRET || '';

app.use(express.json());

// Autenticação opcional por Bearer token ou query secret
function autenticar(req, res, next) {
    if (!API_SECRET) return next();
    const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.secret;
    if (token !== API_SECRET) {
        return res.status(401).json({ sucesso: false, mensagem: 'Não autorizado' });
    }
    next();
}

/**
 * Webhook de retorno da GOWA
 * Responde 200 OK para confirmar eventos e evitar retentativas da API
 */
app.post('/webhook', (req, res) => {
    res.status(200).json({ sucesso: true, recebido: true });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        sucesso: true,
        servico: 'CJC-Dev-Pays WhatsApp Notifier',
        modo: 'apenas_envio',
        grupo_alvo: DEFAULT_GROUP_JID,
        gowa_api: API_URL,
        device_id: DEVICE_ID,
        timestamp: new Date().toISOString()
    });
});

/**
 * Endpoint genérico para notificar transação com base no status (APPROVED / REFUNDED / CHARGED_BACK)
 * Body: { amount, appName, appSlug, paymentMethod, externalReference, mpPaymentId, payerName, payerEmail, description, status, reason }
 */
app.post('/notify-transaction', autenticar, async (req, res) => {
    try {
        const result = await enviarNotificacaoTransacao(req.body);
        res.status(result.success ? 200 : (result.ignored ? 200 : 500)).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Endpoint específico para notificar pagamento APROVADO
 * Body: { amount, appName, appSlug, paymentMethod, externalReference, mpPaymentId, payerName, payerEmail, description, paidAt }
 */
app.post('/notify-approved', autenticar, async (req, res) => {
    try {
        const result = await enviarNotificacaoAprovado(req.body);
        res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Endpoint específico para notificar pagamento ESTORNADO
 * Body: { amount, appName, appSlug, paymentMethod, externalReference, mpPaymentId, payerName, reason, refundedAt }
 */
app.post('/notify-refunded', autenticar, async (req, res) => {
    try {
        const result = await enviarNotificacaoEstorno(req.body);
        res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Endpoint genérico para envio de mensagem de texto livre para o grupo
 * Body: { message, jid }
 */
app.post('/send', autenticar, async (req, res) => {
    const { message, jid } = req.body;
    if (!message) {
        return res.status(400).json({ success: false, error: 'Mensagem é obrigatória' });
    }
    try {
        const result = await enviarMensagem(message, jid);
        res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[CJC-PAYS WHATSAPP] 🚀 Notificador rodando na porta ${PORT}`);
        console.log(`[CJC-PAYS WHATSAPP] 🎯 Grupo alvo configurado: ${DEFAULT_GROUP_JID}`);
        console.log(`[CJC-PAYS WHATSAPP] 📡 GOWA API conectada em: ${API_URL}`);
        console.log(`[CJC-PAYS WHATSAPP] 📱 Device ID: ${DEVICE_ID}`);
    });
}

module.exports = app;
