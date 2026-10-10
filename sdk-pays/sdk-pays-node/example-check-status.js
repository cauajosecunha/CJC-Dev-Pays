import { CJCPaysClient } from './cjcPaysClient.js';

const client = new CJCPaysClient({
  apiKey: 'cjc_live_SUA_CHAVE_AQUI',
  baseUrl: 'https://pays.cjcdev.site',
});

async function main() {
  try {
    // Opção A: Consultar por Referência Externa
    // A Central aceita tanto a sua referência direta (ex: "PEDIDO-12345") quanto a contábil ("SUA-LOJA-PEDIDO-12345")
    const externalRef = 'PEDIDO-12345';
    console.log(`🔎 Consultando pagamento por referência: ${externalRef}...`);

    const resRef = await client.getPaymentByReference(externalRef);
    const p = resRef.payment;
    const parsedRef = CJCPaysClient.parseExternalReference(p.external_reference || externalRef);

    console.log('ID Central:', p.id);
    console.log('Estabelecimento ID:', parsedRef?.estabelecimento_id || 'N/A');
    console.log('Tipo:', parsedRef?.tipo || 'N/A');
    console.log('Pedido Local:', parsedRef?.pedido_id || 'N/A');
    console.log('Status:', p.status);
    console.log('Status Detalhado:', p.status_detail);
    console.log('Valor Bruto: R$', p.amount);
    console.log('Valor Líquido Recebido: R$', p.net_amount ?? p.amount);
    console.log('Data de Pagamento:', p.paid_at || 'Ainda pendente');

    // Opção B: Consultar por ID interno da Central
    if (p.id) {
      console.log(`\n🔎 Consultando diretamente pelo ID da Central (${p.id})...`);
      const resId = await client.getPayment(p.id);
      console.log('Status confirmado:', resId.payment.status);
    }

  } catch (error) {
    console.error('❌ Erro na consulta:', error.message);
  }
}

main();
