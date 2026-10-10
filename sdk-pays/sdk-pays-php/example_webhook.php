<?php
declare(strict_types=1);

/**
 * Exemplo de Endpoint Receptor de Webhooks em PHP (webhook.php)
 * 
 * Configure a URL deste arquivo no painel da Central (ou via callback_url no checkout)
 * Exemplo: https://seusite.com.br/webhook.php
 */

require_once __DIR__ . '/CJCPaysWebhook.php';

// 1. Configurações da Aplicação
$webhookSecret = 'whsec_SEU_SEGREDO_AQUI'; // Segredo HMAC da aplicação no painel

// 2. Captura os dados brutos da requisição HTTP
$rawBody = (string)file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_CJC_SIGNATURE'] ?? '';

// Em alguns servidores Apache/Nginx o header pode estar em maiúsculo ou via getallheaders()
if (empty($signatureHeader) && function_exists('getallheaders')) {
    $headers = getallheaders();
    $signatureHeader = $headers['X-CJC-Signature'] ?? $headers['x-cjc-signature'] ?? '';
}

header('Content-Type: application/json; charset=utf-8');

try {
    // 3. Valida rigorosamente a assinatura HMAC e expiração
    $payload = CJCPaysWebhook::verify($rawBody, $signatureHeader, $webhookSecret);

    // 4. Extrai os dados do evento
    $event = $payload['event'] ?? 'unknown';
    $status = strtolower($payload['status'] ?? '');
    $paymentId = $payload['payment_id'] ?? '';
    $externalRef = $payload['external_reference'] ?? '';
    $metadata = $payload['metadata'] ?? [];

    // Log para auditoria local (opcional)
    file_put_contents(
        __DIR__ . '/webhook_audit.log',
        "[" . date('Y-m-d H:i:s') . "] Evento: {$event} | Status: {$status} | Ref: {$externalRef}\n",
        FILE_APPEND
    );

    // 5. Trata a regra de negócio e contabilidade conforme o status
    switch ($status) {
        case 'approved':
            // Pagamento APROVADO via Pix ou Cartão!
            $estabelecimentoId  = $metadata['estabelecimento_id'] ?? null;
            $pedidoId           = $metadata['pedido_id'] ?? null;
            $valorBruto         = (float)($payload['amount'] ?? 0);
            $valorLiquido       = (float)($payload['net_received_amount'] ?? $valorBruto);
            $taxaGateway        = (float)($payload['fee_amount'] ?? 0);
            $taxaPlataformaPct  = (float)($metadata['taxa_plataforma_pct'] ?? 0);

            // Exemplo de cálculo contábil de repasse ao lojista:
            $comissaoPlataforma = ($valorLiquido * $taxaPlataformaPct) / 100;
            $repasseLojista     = $valorLiquido - $comissaoPlataforma;

            // PedidoService::aprovarPedido($externalRef, $valorLiquido, $repasseLojista);
            // ContabilidadeService::registrarRepasse($estabelecimentoId, $repasseLojista, $comissaoPlataforma);
            break;

        case 'rejected':
            // Pagamento recusado pelo gateway
            // PedidoService::marcarComoRecusado($externalRef);
            break;

        case 'refunded':
        case 'cancelled':
            // Pagamento estornado ou cancelado
            // PedidoService::cancelarPedido($externalRef);
            break;

        case 'pending':
        case 'in_process':
        default:
            // Pagamento ainda aguardando conclusão
            break;
    }

    // 6. Responda obrigatoriamente com HTTP 200 para a Central saber que o webhook foi entregue com sucesso
    http_response_code(200);
    echo json_encode(['received' => true, 'processed' => true]);

} catch (Throwable $e) {
    // Em caso de assinatura inválida ou erro crítico, retorne status 400 ou 500
    http_response_code(400);
    echo json_encode([
        'received' => false,
        'error' => $e->getMessage(),
    ]);
}
