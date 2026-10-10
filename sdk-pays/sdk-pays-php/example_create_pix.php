<?php
declare(strict_types=1);

require_once __DIR__ . '/CJCPaysClient.php';

// 1. Configurações da Aplicação (obtidas no painel https://pays.cjcdev.site)
$apiKey = 'cjc_live_SUA_CHAVE_AQUI'; // Substitua pela sua API Key
$baseUrl = 'https://pays.cjcdev.site'; // Ou http://localhost:4020 em desenvolvimento local

$client = new CJCPaysClient($apiKey, $baseUrl);

try {
    // 2. A Central de Pagamentos associa o ID do Estabelecimento AUTOMATICAMENTE
    // a partir da sua CJC_PAYS_API_KEY!
    // Se você passar "PEDIDO-12345", a Central prefixará automaticamente:
    // "SUA-LOJA-PEDIDO-12345" e preencherá os metadados contábeis da loja no Mercado Pago.
    $pedidoId = 12345;
    $referenciaExterna = 'PEDIDO-' . $pedidoId;

    $response = $client->createPix([
        'external_reference' => $referenciaExterna,
        'amount' => 49.90,
        'description' => 'Pedido #' . $pedidoId . ' — Sua Loja',
        'payer' => [
            'email' => 'cliente@exemplo.com',
            'first_name' => 'Cauã',
            'last_name' => 'Cunha',
            'identification' => [
                'type' => 'CPF',
                'number' => '12345678909'
            ]
        ],
        // Opcional: URL customizada onde este pedido receberá o webhook
        'callback_url' => 'https://seusite.com.br/webhook.php',
        // Metadados adicionais específicos da sua loja (opcional):
        'metadata' => [
            'pedido_id'           => $pedidoId,
            'cliente_id'          => 987,
            'taxa_plataforma_pct' => 5.0, // opcional: % de split da plataforma
        ]
    ]);

    echo "✅ Cobrança PIX criada com sucesso!\n";
    echo "ID do Pagamento: " . $response['payment']['id'] . "\n";
    echo "Referência Externa: " . $response['payment']['external_reference'] . "\n";
    echo "Status Inicial: " . $response['payment']['status'] . "\n";
    echo "Valor: R$ " . number_format((float)$response['payment']['amount'], 2, ',', '.') . "\n";
    echo "\n----------------------------------------\n";
    echo "Copia e Cola Pix:\n" . $response['payment']['qr_code'] . "\n";
    echo "----------------------------------------\n";
    echo "Link / Ticket MP:\n" . ($response['payment']['ticket_url'] ?? 'N/A') . "\n";

    // Você pode renderizar a imagem em HTML:
    // echo '<img src="data:image/png;base64,' . $response['payment']['qr_code_base64'] . '" alt="QR Code Pix" />';

} catch (CJCPaysException $e) {
    echo "❌ Erro ao criar PIX: " . $e->getMessage() . "\n";
    if ($e->getResponse()) {
        echo "Detalhes da Central: " . json_encode($e->getResponse(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }
}
