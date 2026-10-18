/**
 * CJCPaysClient — Cliente Node.js para integração com a Central CJC-Dev-Pays
 * 
 * Requisitos: Node.js 18+ (utiliza Fetch API nativa).
 * Zero dependências externas obrigatórias.
 * 
 * @author CJC Dev <cauajosecunha@gmail.com>
 * @license MIT
 */

export class CJCPaysError extends Error {
  constructor(message, statusCode = 0, response = null) {
    super(message);
    this.name = 'CJCPaysError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class CJCPaysClient {
  /**
   * @param {Object} options
   * @param {string} options.apiKey   Chave da aplicação gerada no painel (ex: cjc_live_...)
   * @param {string} [options.baseUrl] URL base da central (padrão: https://pays.cjcdev.site)
   * @param {number} [options.timeout] Timeout em milissegundos (padrão: 15000)
   */
  constructor({ apiKey, baseUrl = 'https://pays.cjcdev.site', timeout = 15000 }) {
    if (!apiKey) {
      throw new Error('CJCPaysClient: apiKey é obrigatória.');
    }
    this.apiKey = apiKey.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeout = timeout;
  }

  /**
   * Constrói o external_reference no padrão contábil obrigatório: {ID_ESTABELECIMENTO}-{TIPO}-{ID_PEDIDO}
   * @param {string} estabelecimentoId ID do estabelecimento/tenant (ex: 'ESTAB001')
   * @param {string} tipo              Tipo da transação (ex: 'PEDIDO', 'CORTE', 'SERVICO')
   * @param {string|number} pedidoId   ID único do pedido local
   * @returns {string} Exemplo: 'ESTAB002-PEDIDO-12345'
   */
  static buildExternalReference(estabelecimentoId, tipo, pedidoId) {
    const cleanEstab = String(estabelecimentoId).replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    const cleanTipo = String(tipo).replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
    const cleanPedido = String(pedidoId).replace(/[^A-Za-z0-9_]/g, '');
    return `${cleanEstab}-${cleanTipo}-${cleanPedido}`;
  }

  /**
   * Decodifica uma external_reference no padrão contábil {ID_ESTABELECIMENTO}-{TIPO}-{ID_PEDIDO}
   * @param {string} externalReference
   * @returns {{ estabelecimento_id: string, tipo: string, pedido_id: string } | null}
   */
  static parseExternalReference(externalReference) {
    const parts = String(externalReference || '').trim().split('-');
    if (parts.length < 3) return null;
    return {
      estabelecimento_id: parts[0],
      tipo: parts[1],
      pedido_id: parts.slice(2).join('-'),
    };
  }

  /**
   * Cria uma cobrança PIX com retorno imediato de QR Code e Copia-e-Cola
   *
   * @param {Object} data
   * @param {string} data.external_reference Identificador único do pedido no seu sistema
   * @param {number} data.amount             Valor em BRL (ex: 49.90)
   * @param {string} data.description        Descrição do produto/serviço
   * @param {Object} data.payer              Dados do pagador { email, first_name, last_name, identification: { type: 'CPF', number } }
   * @param {string} [data.callback_url]     URL customizada para webhook
   * @param {number} [data.expiration_minutes] Tempo de expiração do Pix em minutos (opcional, padrão: 30)
   * @param {Object} [data.metadata]         Metadados extras arbitrários
   * @returns {Promise<Object>} Resposta da central com payment.id, qr_code, etc.
   */
  async createPix(data) {
    return this.request('POST', '/api/v1/payments/pix', data);
  }

  /**
   * Cria uma cobrança via Cartão de Crédito
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createCard(data) {
    return this.request('POST', '/api/v1/payments/card', data);
  }

  /**
   * Obtém a Public Key ativa do adquirente configurada na Central
   * @returns {Promise<string>}
   */
  async getPublicKey() {
    const res = await this.request('GET', '/api/v1/public-key');
    return res.public_key || '';
  }

  /**
   * Consulta o status de um pagamento pelo ID da Central (ex: pay_ck...)
   * @param {string} paymentId
   * @returns {Promise<Object>}
   */
  async getPayment(paymentId) {
    return this.request('GET', `/api/v1/payments/${encodeURIComponent(paymentId)}`);
  }

  /**
   * Consulta o status pelo external_reference do seu sistema
   * @param {string} externalReference
   * @returns {Promise<Object>}
   */
  async getPaymentByReference(externalReference) {
    return this.request('GET', `/api/v1/payments/by-reference/${encodeURIComponent(externalReference)}`);
  }

  /**
   * Solicita estorno ou cancelamento de um pagamento
   * @param {string} paymentId
   * @returns {Promise<Object>}
   */
  async refund(paymentId) {
    return this.request('POST', `/api/v1/payments/${encodeURIComponent(paymentId)}/refund`);
  }

  /**
   * Healthcheck da Central CJC-Dev-Pays
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return this.request('GET', '/health');
  }

  /**
   * Executor interno de requisições HTTP via Fetch API nativa
   * @private
   */
  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'CJCPays-Node-SDK/1.0',
    };

    if (path.startsWith('/api/v1')) {
      headers['X-Api-Key'] = this.apiKey;
    }

    const options = {
      method: method.toUpperCase(),
      headers,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    // Controle de Timeout nativo com AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = json?.error || `Erro na requisição à Central CJC-Dev-Pays (HTTP ${response.status})`;
        throw new CJCPaysError(errorMsg, response.status, json);
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof CJCPaysError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new CJCPaysError(`Tempo limite excedido (${this.timeout}ms) na requisição à Central.`, 408);
      }
      throw new CJCPaysError(`Falha de rede ao conectar com CJC-Dev-Pays: ${err.message}`, 0);
    }
  }
}
