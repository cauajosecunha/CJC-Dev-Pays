<?php
declare(strict_types=1);

/**
 * Exemplo de Criação de Cobrança com Cartão de Crédito ou Débito em PHP
 * 
 * ℹ️ FLUXO DE PAGAMENTO COM CARTÃO (PCI-DSS):
 * 1. O Frontend (Checkout da sua loja via MercadoPago.js ou Checkout Bricks)
 *    coleta os dados do cartão do cliente e gera um "token" temporário usando
 *    a chave pública do Mercado Pago.
 * 2. O Frontend envia esse "token" para o seu backend PHP.
 * 3. O seu backend chama $client->createCard() passando o token e os dados da compra.
 */

require_once __DIR__ . '/CJCPaysClient.php';

// 1. Configurações da Aplicação (obtidas no painel da Central)
$apiKey = getenv('CJC_PAYS_API_KEY') ?: 'cjc_live_SUA_CHAVE_AQUI';
$client = new CJCPaysClient($apiKey, $baseUrl);

// 2. Chave pública para o frontend tokenizar o cartão com MercadoPago.js v2 (PCI-DSS):
// $publicKey = $client->getPublicKey(); // Passe esta chave para o seu frontend/checkout JS

try {
    $pedidoId = 12345;
    $referenciaExterna = 'PEDIDO-' . $pedidoId;

    // =========================================================================
    // CASO 1: CARTÃO DE CRÉDITO (com ou sem parcelamento)
    // =========================================================================
    echo "💳 Processando pagamento com Cartão de Crédito...\n";

    $responseCredito = $client->createCard([
        'external_reference' => $referenciaExterna,
        'amount'             => 129.90,
        'description'        => 'Pedido #' . $pedidoId . ' — Sua Loja',
        // Token temporário gerado no frontend com o MercadoPago.js:
        'token'              => 'TOKEN_DO_CARTAO_OBTIDO_NO_FRONTEND',
        // Bandeira do cartão: 'visa', 'master', 'elo', 'amex', 'hipercard'
        'payment_method_id'  => 'visa',
        // Número de parcelas (1 a 12):
        'installments'       => 3,
        // Banco emissor (opcional, fornecido pelo MercadoPago.js):
        // 'issuer_id'       => '24',
        'payer' => [
            'email'          => 'cliente@exemplo.com',
            'identification' => [
                'type'   => 'CPF',
                'number' => '12345678909'
            ]
        ],
        // Metadados contábeis e de auditoria da sua loja:
        'metadata' => [
            'pedido_id'   => $pedidoId,
            'cliente_id'  => 987,
        ]
    ]);

    echo "✅ Transação de Crédito enviada com sucesso!\n";
    echo "ID na Central: " . $responseCredito['payment']['id'] . "\n";
    echo "Status: " . $responseCredito['payment']['status'] . "\n";
    echo "Detalhe: " . ($responseCredito['payment']['status_detail'] ?? 'N/A') . "\n";
    echo "Valor: R$ " . number_format((float)$responseCredito['payment']['amount'], 2, ',', '.') . "\n";

    // =========================================================================
    // CASO 2: CARTÃO DE DÉBITO (à vista, 1 parcela)
    // =========================================================================
    // Para débito, o payment_method_id utiliza o prefixo 'deb':
    // 'debvisa' (Visa Débito), 'debmaster' (Mastercard Débito), 'debelo' (Elo Débito)
    /*
    $responseDebito = $client->createCard([
        'external_reference' => 'PEDIDO-' . $pedidoId . '-DEB',
        'amount'             => 85.00,
        'description'        => 'Pedido #' . $pedidoId . ' — Pagamento Débito',
        'token'              => 'TOKEN_DO_CARTAO_DEBITO',
        'payment_method_id'  => 'debvisa',
        'installments'       => 1, // Débito sempre 1 parcela
        'payer' => [
            'email'          => 'cliente@exemplo.com',
            'identification' => [
                'type'   => 'CPF',
                'number' => '12345678909'
            ]
        ]
    ]);
    */

} catch (CJCPaysException $e) {
    echo "❌ Erro ao processar cartão: " . $e->getMessage() . "\n";
    if ($e->getResponse()) {
        echo "Resposta da API: " . json_encode($e->getResponse(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
    }
}
