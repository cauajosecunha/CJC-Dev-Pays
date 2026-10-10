import crypto from 'node:crypto';

/**
 * CJCPaysWebhook — Validador de Webhooks da Central CJC-Dev-Pays para Node.js
 * 
 * Verifica a assinatura HMAC-SHA256 (header X-CJC-Signature) garantindo autenticidade
 * e prevenindo ataques de falsificação ou replay.
 * 
 * @author CJC Dev <cauajosecunha@gmail.com>
 * @license MIT
 */
export class CJCPaysWebhook {
  /**
   * Valida a assinatura de uma notificação de webhook e retorna o payload decodificado
   *
   * @param {Object} options
   * @param {string|Buffer} options.rawBody         Corpo bruto da requisição HTTP (string ou Buffer)
   * @param {string}        options.signatureHeader Cabeçalho X-CJC-Signature (ex: t=1791582432,v1=a8f9c...)
   * @param {string}        options.secret          Segredo do webhook configurado no painel (whsec_...)
   * @param {number}        [options.tolerance=300] Tolerância máxima de idade em segundos contra Replay Attacks
   * @returns {Object} Payload decodificado em JSON
   * @throws {Error} Se a assinatura for inválida, expirada ou o payload malformado
   */
  static verify({ rawBody, signatureHeader, secret, tolerance = 300 }) {
    if (!rawBody) {
      throw new Error('CJCPaysWebhook: rawBody não pode ser vazio.');
    }
    if (!signatureHeader) {
      throw new Error('CJCPaysWebhook: Cabeçalho X-CJC-Signature não informado.');
    }
    if (!secret) {
      throw new Error('CJCPaysWebhook: secret é obrigatório.');
    }

    const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');

    // Parse do cabeçalho t={timestamp},v1={hash}
    let timestamp = null;
    let receivedHash = null;

    const parts = signatureHeader.split(',');
    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 't') {
        timestamp = parseInt(value, 10);
      } else if (key === 'v1') {
        receivedHash = value?.toLowerCase();
      }
    }

    if (!timestamp || !receivedHash) {
      throw new Error('CJCPaysWebhook: Formato inválido do cabeçalho X-CJC-Signature.');
    }

    // Proteção contra Replay Attack
    const now = Math.floor(Date.now() / 1000);
    if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
      throw new Error('CJCPaysWebhook: Notificação expirada. Diferença temporal excede o limite de segurança.');
    }

    // Calcula HMAC-SHA256 esperado
    const dataToSign = `t=${timestamp}&body=${bodyString}`;
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(dataToSign)
      .digest('hex');

    // Comparação segura imune a timing attacks
    const expectedBuffer = Buffer.from(expectedHash, 'utf-8');
    const receivedBuffer = Buffer.from(receivedHash, 'utf-8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new Error('CJCPaysWebhook: Assinatura inválida! Possível tentativa de fraude ou segredo incorreto.');
    }

    try {
      return JSON.parse(bodyString);
    } catch {
      throw new Error('CJCPaysWebhook: Corpo da requisição não é um JSON válido.');
    }
  }
}
