<?php
declare(strict_types=1);

require_once __DIR__ . '/CJCPaysClient.php';

$apiKey = 'cjc_live_SUA_CHAVE_AQUI';
$baseUrl = 'https://pays.cjcdev.site';

$client = new CJCPaysClient($apiKey, $baseUrl);

try {
    $paymentId = 'pay_EXEMPLO_ID_AQUI'; // ID do pagamento na central

    echo "💸 Solicitando estorno do pagamento {$paymentId}...\n";
    $result = $client->refund($paymentId);

    echo "✅ Estorno processado com sucesso!\n";
    echo "Novo Status: " . ($result['payment']['status'] ?? 'REFUNDED') . "\n";
    echo "Resposta: " . json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";

} catch (CJCPaysException $e) {
    echo "❌ Erro ao estornar: " . $e->getMessage() . "\n";
}
