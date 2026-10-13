/**
 * Exemplo de Cobrança com Cartão de Crédito ou Débito em Node.js
 * 
 * ℹ️ FLUXO DE PAGAMENTO COM CARTÃO (PCI-DSS):
 * 1. O Frontend (Checkout da loja via MercadoPago.js ou Checkout Bricks)
 *    coleta os dados do cartão do cliente e gera um "token" temporário usando
 *    a chave pública do Mercado Pago.
 * 2. O Frontend envia esse "token" para o seu backend Node.js.
 * 3. O seu backend chama client.createCard() passando o token e os dados da compra.
 */

import { CJCPaysClient } from './cjcPaysClient.js';

// 1. Instância do cliente com as credenciais da aplicação
const client = new CJCPaysClient({
  apiKey: process.env.CJC_PAYS_API_KEY || 'cjc_live_SUA_CHAVE_AQUI',
  baseUrl: process.env.CJC_PAYS_BASE_URL || 'https://pays.cjcdev.site',
});

// Chave pública para o frontend tokenizar o cartão com MercadoPago.js v2 (PCI-DSS):
// const publicKey = await client.getPublicKey(); // Envie para o checkout web

async function main() {
  const pedidoId = 12345;
  const externalReference = `PEDIDO-${pedidoId}`;

  try {
    // =========================================================================
    // CASO 1: CARTÃO DE CRÉDITO (com ou sem parcelamento)
    // =========================================================================
    console.log(`💳 Processando Cartão de Crédito para o pedido ${pedidoId}...`);

    const resultCredito = await client.createCard({
      external_reference: externalReference,
      amount: 129.90,
      description: `Pedido #${pedidoId} — Sua Loja`,
      // Token temporário gerado no frontend pelo MercadoPago.js:
      token: 'TOKEN_DO_CARTAO_OBTIDO_NO_FRONTEND',
      // Bandeira do cartão: 'visa', 'master', 'elo', 'amex', 'hipercard'
      payment_method_id: 'visa',
      // Quantidade de parcelas (1 a 12):
      installments: 3,
      // issuer_id: '24', // opcional: ID do banco emissor retornado pelo SDK JS
      payer: {
        email: 'cliente@exemplo.com',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
      metadata: {
        pedido_id: pedidoId,
        cliente_id: 987,
      },
    });

    console.log('✅ Cobrança de Crédito enviada com sucesso!');
    console.log('ID do Pagamento:', resultCredito.payment.id);
    console.log('Status:', resultCredito.payment.status);
    console.log('Status Detalhado:', resultCredito.payment.status_detail);
    console.log('Valor: R$', resultCredito.payment.amount);

    // =========================================================================
    // CASO 2: CARTÃO DE DÉBITO (à vista, 1 parcela)
    // =========================================================================
    // Para débito, o payment_method_id utiliza o prefixo 'deb':
    // 'debvisa' (Visa Débito), 'debmaster' (Mastercard Débito), 'debelo' (Elo Débito)
    /*
    const resultDebito = await client.createCard({
      external_reference: `PEDIDO-${pedidoId}-DEB`,
      amount: 85.00,
      description: `Pedido #${pedidoId} — Pagamento Débito`,
      token: 'TOKEN_DO_CARTAO_DEBITO',
      payment_method_id: 'debvisa',
      installments: 1, // Débito sempre 1 parcela
      payer: {
        email: 'cliente@exemplo.com',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
    });
    */

  } catch (error) {
    console.error('❌ Falha ao processar cartão:', error.message);
    if (error.response) {
      console.error('Resposta da API:', JSON.stringify(error.response, null, 2));
    }
  }
}

main();
