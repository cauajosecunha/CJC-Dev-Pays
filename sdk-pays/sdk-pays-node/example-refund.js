import { CJCPaysClient } from './cjcPaysClient.js';

const client = new CJCPaysClient({
  apiKey: 'cjc_live_SUA_CHAVE_AQUI',
  baseUrl: 'https://pays.cjcdev.site',
});

async function main() {
  const paymentId = 'pay_EXEMPLO_ID_AQUI';

  try {
    console.log(`💸 Solicitando estorno do pagamento ${paymentId}...`);
    const result = await client.refund(paymentId);

    console.log('✅ Estorno concluído com sucesso!');
    console.log('Novo Status:', result.payment.status);
    console.log('Detalhes:', result);

  } catch (error) {
    console.error('❌ Falha ao estornar:', error.message);
  }
}

main();
