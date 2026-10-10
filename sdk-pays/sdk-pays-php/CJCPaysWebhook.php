<?php
declare(strict_types=1);

/**
 * CJCPaysWebhook — Validador e Processador de Webhooks recebidos da Central CJC-Dev-Pays
 * 
 * Verifica a assinatura HMAC-SHA256 (header X-CJC-Signature) garantindo que
 * o webhook recebido é autêntico e foi realmente disparado pela Central de Pagamentos.
 * 
 * @author CJC Dev <cauajosecunha@gmail.com>
 * @license MIT
 */
class CJCPaysWebhook
{
    /**
     * Valida a assinatura de uma notificação de webhook e retorna o payload decodificado
     *
     * @param string $rawBody          Corpo bruto da requisição (obtido via file_get_contents('php://input'))
     * @param string $signatureHeader  Valor do cabeçalho X-CJC-Signature (ex: t=1791582432,v1=a8f9c...)
     * @param string $webhookSecret    Segredo configurado para a aplicação no painel (whsec_...)
     * @param int    $toleranceSeconds Tolerância máxima de idade da requisição em segundos (padrão: 300)
     * @return array Payload do webhook decodificado
     * @throws Exception Se a assinatura for inválida, expirada ou malformada
     */
    public static function verify(
        string $rawBody,
        string $signatureHeader,
        string $webhookSecret,
        int $toleranceSeconds = 300
    ): array {
        if (empty($rawBody)) {
            throw new InvalidArgumentException('Corpo da requisição de webhook está vazio.');
        }

        if (empty($signatureHeader)) {
            throw new InvalidArgumentException('Cabeçalho X-CJC-Signature não informado.');
        }

        if (empty($webhookSecret)) {
            throw new InvalidArgumentException('Webhook Secret não configurado.');
        }

        // Faz o parse do cabeçalho t={timestamp},v1={hash}
        $timestamp = null;
        $receivedHash = null;

        $parts = explode(',', $signatureHeader);
        foreach ($parts as $part) {
            $kv = explode('=', trim($part), 2);
            if (count($kv) === 2) {
                if ($kv[0] === 't') {
                    $timestamp = (int)$kv[1];
                } elseif ($kv[0] === 'v1') {
                    $receivedHash = strtolower(trim($kv[1]));
                }
            }
        }

        if (!$timestamp || !$receivedHash) {
            throw new RuntimeException('Formato inválido do cabeçalho X-CJC-Signature.');
        }

        // Proteção contra Replay Attacks (tolerância padrão de 5 minutos)
        $now = time();
        if ($toleranceSeconds > 0 && abs($now - $timestamp) > $toleranceSeconds) {
            throw new RuntimeException('Webhook expirado. A diferença temporal excede a tolerância de segurança.');
        }

        // Calcula a assinatura HMAC-SHA256 esperada
        $dataToSign = 't=' . $timestamp . '&body=' . $rawBody;
        $expectedHash = hash_hmac('sha256', $dataToSign, $webhookSecret);

        // Comparação segura imune a timing attacks
        if (!hash_equals($expectedHash, $receivedHash)) {
            throw new RuntimeException('Assinatura do webhook inválida! Possível tentativa de fraude ou segredo incorreto.');
        }

        $decoded = json_decode($rawBody, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Payload JSON do webhook é inválido.');
        }

        return $decoded;
    }
}
