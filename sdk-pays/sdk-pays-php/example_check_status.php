<?php
declare(strict_types=1);

require_once __DIR__ . '/CJCPaysClient.php';

$apiKey = 'cjc_live_SUA_CHAVE_AQUI';
$baseUrl = 'https://pays.cjcdev.site';

$client = new CJCPaysClient($apiKey, $baseUrl);

try {
    // Opção A: Consultar por Referência Externa no padrão contábil {ID_ESTABELECIMENTO}-{TIPO}-{ID_PEDIDO}
    $externalRef = 'ESTAB002-PEDIDO-12345';
    echo "🔎 Consultando pagamento por referência: {$externalRef}...\n";
    $resultByRef = $client->getPaymentByReference($externalRef);

    $p = $resultByRef['payment'];
    $parsedRef = CJCPaysClient::parseExternalReference($p['external_reference'] ?? $externalRef);

    echo "ID da Central: {$p['id']}\n";
    echo "Estabelecimento: " . ($parsedRef['estabelecimento_id'] ?? 'N/A') . "\n";
    echo "Tipo: " . ($parsedRef['tipo'] ?? 'N/A') . "\n";
    echo "Pedido Local: " . ($parsedRef['pedido_id'] ?? 'N/A') . "\n";
    echo "Status: {$p['status']}\n";
    echo "Status Detalhado: " . ($p['status_detail'] ?? 'N/A') . "\n";
    echo "Valor Bruto: R$ " . number_format((float)$p['amount'], 2, ',', '.') . "\n";
    echo "Valor Líquido Recebido: R$ " . number_format((float)($p['net_amount'] ?? $p['amount']), 2, ',', '.') . "\n";
    echo "Data Pago: " . ($p['paid_at'] ?? 'Ainda não pago') . "\n";

    // Opção B: Consultar diretamente pelo ID interno da Central
    if (!empty($p['id'])) {
        echo "\n🔎 Consultando diretamente pelo ID da Central ({$p['id']})...\n";
        $resultById = $client->getPayment($p['id']);
        echo "Confirmado status: " . $resultById['payment']['status'] . "\n";
    }

} catch (CJCPaysException $e) {
    echo "❌ Erro ao consultar pagamento: " . $e->getMessage() . "\n";
}
