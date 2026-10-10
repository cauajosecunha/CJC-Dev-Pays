import { CJCPaysClient } from './cjcPaysClient.js';

// 1. Instância do cliente com as credenciais da aplicação
const client = new CJCPaysClient({
  apiKey: 'cjc_live_SUA_CHAVE_AQUI', // Substitua pela sua API Key obtida no painel
  baseUrl: 'https://pays.cjcdev.site', // Ou http://localhost:4020 para testes locais
});

async function main() {
  const pedidoId = 12345;

  // A Central de Pagamentos associa o ID do Estabelecimento AUTOMATICAMENTE
  // a partir da sua CJC_PAYS_API_KEY!
  // Se você passar "PEDIDO-12345", a Central prefixará automaticamente:
  // "SUA-LOJA-PEDIDO-12345" e preencherá os metadados contábeis da loja no Mercado Pago.
  const externalReference = `PEDIDO-${pedidoId}`;

  try {
    console.log(`🚀 Gerando cobrança Pix para o pedido ${pedidoId} (Ref: ${externalReference})...`);

    const result = await client.createPix({
      external_reference: externalReference,
      amount: 49.90,
      description: `Pedido #${pedidoId} — Sua Loja`,
      payer: {
        email: 'cliente@exemplo.com',
        first_name: 'Cauã',
        last_name: 'Cunha',
        identification: {
          type: 'CPF',
          number: '12345678909',
        },
      },
      callback_url: 'https://seusite.com.br/api/webhooks/cjc-pays',
      // Metadados adicionais específicos da sua loja (opcional):
      metadata: {
        pedido_id: pedidoId,
        cliente_id: 987,
        taxa_plataforma_pct: 5.0, // opcional: % de split da plataforma
      },
    });

    console.log('✅ Cobrança PIX criada com sucesso!');
    console.log('ID do Pagamento:', result.payment.id);
    console.log('Referência Externa:', result.payment.external_reference);
    console.log('Status:', result.payment.status);
    console.log('Valor: R$', result.payment.amount);
    console.log('\n--- COPIA E COLA PIX ---');
    console.log(result.payment.qr_code);
    console.log('------------------------\n');
    console.log('Ticket / Comprovante MP:', result.payment.ticket_url);

    // Para exibir no frontend, utilize o base64 diretamente:
    // `<img src="data:image/png;base64,${result.payment.qr_code_base64}" />`

  } catch (error) {
    console.error('❌ Falha ao criar PIX:', error.message);
    if (error.response) {
      console.error('Resposta da Central:', error.response);
    }
  }
}

main();
