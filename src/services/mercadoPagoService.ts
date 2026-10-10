import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface CreatePixInput {
  amount: number;
  description: string;
  externalReference: string;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  notificationUrl?: string;
  metadata?: Record<string, any>;
}

export interface CreateCardInput {
  amount: number;
  description: string;
  externalReference: string;
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  notificationUrl?: string;
  metadata?: Record<string, any>;
}

export interface MPPaymentResult {
  id: string;
  status: string;
  statusDetail?: string;
  amount: number;
  feeAmount?: number;
  netReceivedAmount?: number;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  paymentMethod: string;
  rawResponse?: any;
}

class MercadoPagoService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.mercadopago.com',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private isConfigured(): boolean {
    return Boolean(
      config.mpAccessToken &&
      config.mpAccessToken.trim() !== '' &&
      !config.mpAccessToken.includes('seu-access-token')
    );
  }

  /**
   * Cria uma cobrança Pix no Mercado Pago
   */
  async createPix(input: CreatePixInput): Promise<MPPaymentResult> {
    if (!this.isConfigured()) {
      logger.warn('Mercado Pago não configurado com Access Token real. Gerando Pix simulado para testes locais.');
      return this.generateMockPix(input);
    }

    try {
      const idempotencyKey = crypto.randomUUID();
      const payload: any = {
        transaction_amount: Number(input.amount.toFixed(2)),
        description: input.description,
        payment_method_id: 'pix',
        external_reference: input.externalReference,
        payer: {
          email: input.payer.email,
          first_name: input.payer.firstName || 'Cliente',
          last_name: input.payer.lastName || 'CJC',
        },
      };

      if (input.payer.identification?.number) {
        payload.payer.identification = {
          type: input.payer.identification.type || 'CPF',
          number: input.payer.identification.number.replace(/\D/g, ''),
        };
      }

      if (input.notificationUrl) {
        if (!input.notificationUrl.includes('localhost') && !input.notificationUrl.includes('127.0.0.1')) {
          payload.notification_url = input.notificationUrl;
        } else {
          payload.notification_url = 'https://pays.cjcdev.site/api/webhooks/mercadopago';
        }
      }

      if (input.metadata) {
        payload.metadata = input.metadata;
      }

      const response = await this.client.post('/v1/payments', payload, {
        headers: {
          Authorization: `Bearer ${config.mpAccessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
      });

      const data = response.data;
      const transactionData = data.point_of_interaction?.transaction_data;
      const fee = data.fee_details?.reduce((acc: number, item: any) => acc + (item.amount || 0), 0) || 0;

      return {
        id: String(data.id),
        status: (data.status || 'pending').toUpperCase(),
        statusDetail: data.status_detail,
        amount: data.transaction_amount || input.amount,
        feeAmount: fee,
        netReceivedAmount: data.transaction_details?.net_received_amount || (input.amount - fee),
        qrCode: transactionData?.qr_code,
        qrCodeBase64: transactionData?.qr_code_base64,
        ticketUrl: transactionData?.ticket_url,
        paymentMethod: 'PIX',
        rawResponse: data,
      };
    } catch (error: any) {
      const mpError = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Erro na chamada ao Mercado Pago (createPix):', error.response?.data || error.message);
      throw new Error(`Falha no Mercado Pago: ${mpError}`);
    }
  }

  /**
   * Processa pagamento com cartão de crédito via token
   */
  async createCardPayment(input: CreateCardInput): Promise<MPPaymentResult> {
    if (!this.isConfigured()) {
      return this.generateMockCard(input);
    }

    try {
      const idempotencyKey = crypto.randomUUID();
      const payload: any = {
        transaction_amount: Number(input.amount.toFixed(2)),
        token: input.token,
        description: input.description,
        installments: input.installments || 1,
        payment_method_id: input.paymentMethodId,
        external_reference: input.externalReference,
        payer: {
          email: input.payer.email,
        },
      };

      if (input.issuerId) {
        payload.issuer_id = input.issuerId;
      }

      if (input.payer.identification?.number) {
        payload.payer.identification = {
          type: input.payer.identification.type || 'CPF',
          number: input.payer.identification.number.replace(/\D/g, ''),
        };
      }

      if (input.notificationUrl) {
        if (!input.notificationUrl.includes('localhost') && !input.notificationUrl.includes('127.0.0.1')) {
          payload.notification_url = input.notificationUrl;
        } else {
          payload.notification_url = 'https://pays.cjcdev.site/api/webhooks/mercadopago';
        }
      }

      if (input.metadata) {
        payload.metadata = input.metadata;
      }

      const response = await this.client.post('/v1/payments', payload, {
        headers: {
          Authorization: `Bearer ${config.mpAccessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
      });

      const data = response.data;
      const fee = data.fee_details?.reduce((acc: number, item: any) => acc + (item.amount || 0), 0) || 0;

      return {
        id: String(data.id),
        status: (data.status || 'pending').toUpperCase(),
        statusDetail: data.status_detail,
        amount: data.transaction_amount || input.amount,
        feeAmount: fee,
        netReceivedAmount: data.transaction_details?.net_received_amount || (input.amount - fee),
        paymentMethod: 'CREDIT_CARD',
        rawResponse: data,
      };
    } catch (error: any) {
      const mpError = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Erro no Mercado Pago (createCardPayment):', error.response?.data || error.message);
      throw new Error(`Falha no Mercado Pago: ${mpError}`);
    }
  }

  /**
   * Consulta pagamento por ID no Mercado Pago
   */
  async getPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await this.client.get(`/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${config.mpAccessToken}`,
        },
      });
      return response.data;
    } catch (error: any) {
      logger.error(`Erro ao consultar pagamento MP ${paymentId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Solicita estorno/reembolso no Mercado Pago
   */
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    if (!this.isConfigured()) {
      return { id: `ref_sim_${Date.now()}`, status: 'approved' };
    }

    try {
      const idempotencyKey = crypto.randomUUID();
      const payload = amount ? { amount: Number(amount.toFixed(2)) } : {};
      const response = await this.client.post(`/v1/payments/${paymentId}/refunds`, payload, {
        headers: {
          Authorization: `Bearer ${config.mpAccessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
      });
      return response.data;
    } catch (error: any) {
      const mpError = error.response?.data?.message || error.response?.data?.error || error.message;
      throw new Error(`Falha ao solicitar estorno no Mercado Pago: ${mpError}`);
    }
  }

  /**
   * Valida a assinatura criptográfica HMAC do Webhook do Mercado Pago
   * Header x-signature: "ts=1704067200,v1=5d6e..."
   * Header x-request-id: "uuid"
   */
  verifyWebhookSignature(params: {
    xSignature?: string;
    xRequestId?: string;
    dataId?: string;
  }): boolean {
    const secret = config.mpWebhookSecret;
    if (!secret || secret.trim() === '' || secret.includes('seu-webhook-secret')) {
      // Se não há secret configurado, aceita em ambiente de dev/sandbox
      return true;
    }

    if (!params.xSignature || !params.xRequestId || !params.dataId) {
      logger.warn('Webhook recebido sem cabeçalhos de assinatura obrigatórios (x-signature/x-request-id/dataId)');
      return false;
    }

    try {
      // Divide partes: ts=...,v1=...
      const parts = params.xSignature.split(',');
      let ts: string | undefined;
      let v1: string | undefined;

      for (const part of parts) {
        const [key, value] = part.trim().split('=');
        if (key === 'ts') ts = value;
        if (key === 'v1') v1 = value;
      }

      if (!ts || !v1) {
        return false;
      }

      // Manifest: id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
      const manifest = `id:${params.dataId};request-id:${params.xRequestId};ts:${ts};`;
      const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const expectedBuffer = Buffer.from(expectedHash, 'utf8');
      const receivedBuffer = Buffer.from(v1, 'utf8');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (error) {
      logger.error('Erro ao verificar assinatura HMAC do webhook:', error);
      return false;
    }
  }

  /**
   * Gera QR Code Pix simulado para testes rápidos em desenvolvimento
   */
  private async generateMockPix(input: CreatePixInput): Promise<MPPaymentResult> {
    const mockId = `sim_mp_${Date.now()}`;
    const mockCopiaECola = `00020126580014br.gov.bcb.pix0136mock-cjcdev-${input.externalReference}520400005303986540${input.amount.toFixed(2)}5802BR5910CJC DEV PAYS6009SAO PAULO62070503***6304MOCK`;

    // Gera imagem base64 real do QR Code para exibição visual imediata no dashboard e app
    let qrBase64 = '';
    try {
      qrBase64 = await QRCode.toDataURL(mockCopiaECola, { width: 300, margin: 2 });
    } catch {
      qrBase64 = '';
    }

    return {
      id: mockId,
      status: 'PENDING',
      statusDetail: 'pending_waiting_transfer',
      amount: input.amount,
      feeAmount: Number((input.amount * 0.0099).toFixed(2)), // taxa 0.99% simulada
      netReceivedAmount: Number((input.amount * 0.9901).toFixed(2)),
      qrCode: mockCopiaECola,
      qrCodeBase64: qrBase64.replace(/^data:image\/png;base64,/, ''),
      ticketUrl: `http://localhost:${config.port}/checkout/simulated/${mockId}`,
      paymentMethod: 'PIX',
    };
  }

  private generateMockCard(input: CreateCardInput): MPPaymentResult {
    const mockId = `sim_mp_${Date.now()}`;
    return {
      id: mockId,
      status: 'APPROVED',
      statusDetail: 'accredited',
      amount: input.amount,
      feeAmount: Number((input.amount * 0.035).toFixed(2)),
      netReceivedAmount: Number((input.amount * 0.965).toFixed(2)),
      paymentMethod: 'CREDIT_CARD',
    };
  }
}

export const mercadoPagoService = new MercadoPagoService();
