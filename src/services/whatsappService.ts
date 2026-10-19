import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface WhatsAppPaymentData {
  id?: string;
  amount: number;
  paymentMethod?: string;
  externalReference?: string;
  mpPaymentId?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
  description?: string | null;
  paidAt?: Date | string | null;
}

export class WhatsAppService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.gowaApiUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.gowaDeviceId && { 'X-Device-Id': config.gowaDeviceId }),
      },
    });
  }

  /**
   * Normaliza o JID do grupo/destinatário
   */
  private formatJid(jid?: string): string {
    const target = jid || config.whatsappGroupJid;
    if (!target) return config.whatsappGroupJid;
    return target.includes('@') ? target : `${target}@g.us`;
  }

  /**
   * Formata valor numérico para o padrão de moeda Real (R$)
   */
  private formatCurrency(value: number): string {
    return (Number(value) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  /**
   * Traduz/Formata método de pagamento
   */
  private formatPaymentMethod(method?: string): string {
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
   * Envia uma mensagem arbitrária de texto para o WhatsApp via GOWA API
   */
  async sendMessage(message: string, jid?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!config.whatsappNotificationsEnabled) {
      logger.info('[WhatsApp Notifier] Envio desabilitado via configuração (WHATSAPP_NOTIFICATIONS_ENABLED=false).');
      return { success: false, error: 'Notificações desabilitadas' };
    }

    const targetJid = this.formatJid(jid);

    try {
      const response = await this.client.post('/send/message', {
        phone: targetJid,
        message,
      });

      logger.success(`[WhatsApp Notifier] ✅ Notificação enviada com sucesso para ${targetJid}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.message;
      logger.warn(`[WhatsApp Notifier] ⚠️ Erro ao enviar mensagem para ${targetJid}: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Notifica pagamento APROVADO
   */
  async sendApprovedPayment(
    payment: WhatsAppPaymentData,
    appName = 'CJC Dev Pays',
    appSlug?: string,
    jid?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const dateStr = payment.paidAt
      ? new Date(payment.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let msg = `✅ *Pagamento Aprovado!* 💸\n\n`;

    const appDisplay = appSlug ? `${appName} (\`${appSlug}\`)` : appName;
    msg += `🏢 *Aplicação:* ${appDisplay}\n`;
    msg += `💰 *Valor:* *${this.formatCurrency(payment.amount)}*\n`;
    msg += `💳 *Método:* ${this.formatPaymentMethod(payment.paymentMethod)}\n`;

    if (payment.externalReference) {
      msg += `🏷️ *Referência:* \`${payment.externalReference}\`\n`;
    }

    if (payment.mpPaymentId) {
      msg += `🆔 *ID Mercado Pago:* \`${payment.mpPaymentId}\`\n`;
    }

    if (payment.payerName) {
      msg += `👤 *Cliente:* ${payment.payerName}\n`;
    }

    if (payment.payerEmail) {
      msg += `📧 *E-mail:* ${payment.payerEmail}\n`;
    }

    if (payment.description) {
      const cleanDesc =
        payment.description.length > 80 ? payment.description.substring(0, 77) + '...' : payment.description;
      msg += `📝 *Descrição:* ${cleanDesc}\n`;
    }

    msg += `\n🕒 ${dateStr}`;

    return await this.sendMessage(msg, jid);
  }

  /**
   * Notifica pagamento ESTORNADO (Refund / Chargeback)
   */
  async sendRefundedPayment(
    payment: WhatsAppPaymentData,
    appName = 'CJC Dev Pays',
    appSlug?: string,
    reason = 'Estorno solicitado',
    jid?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const dateStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    let msg = `↩️ *Pagamento Estornado!* ⚠️\n\n`;

    const appDisplay = appSlug ? `${appName} (\`${appSlug}\`)` : appName;
    msg += `🏢 *Aplicação:* ${appDisplay}\n`;
    msg += `💰 *Valor Estornado:* *${this.formatCurrency(payment.amount)}*\n`;
    msg += `💳 *Método:* ${this.formatPaymentMethod(payment.paymentMethod)}\n`;

    if (payment.externalReference) {
      msg += `🏷️ *Referência:* \`${payment.externalReference}\`\n`;
    }

    if (payment.mpPaymentId) {
      msg += `🆔 *ID Mercado Pago:* \`${payment.mpPaymentId}\`\n`;
    }

    if (payment.payerName) {
      msg += `👤 *Cliente:* ${payment.payerName}\n`;
    }

    if (reason) {
      msg += `⚠️ *Motivo/Detalhes:* ${reason}\n`;
    }

    msg += `\n🕒 ${dateStr}`;

    return await this.sendMessage(msg, jid);
  }
}

export const whatsappService = new WhatsAppService();
