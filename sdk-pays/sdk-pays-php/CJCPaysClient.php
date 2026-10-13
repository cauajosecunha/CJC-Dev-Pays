<?php
declare(strict_types=1);

/**
 * CJCPaysClient — Cliente PHP para integração com a Central CJC-Dev-Pays
 * 
 * Requisitos: PHP 7.4+ com extensões curl e json ativas.
 * Zero dependências de pacotes externos.
 * 
 * @author CJC Dev <cauajosecunha@gmail.com>
 * @license MIT
 */
class CJCPaysException extends Exception
{
    protected ?array $response;
    protected int $statusCode;

    public function __construct(string $message, int $statusCode = 0, ?array $response = null)
    {
        parent::__construct($message, $statusCode);
        $this->statusCode = $statusCode;
        $this->response = $response;
    }

    public function getResponse(): ?array
    {
        return $this->response;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}

class CJCPaysClient
{
    private string $apiKey;
    private string $baseUrl;
    private int $timeout;

    /**
     * @param string $apiKey   Chave da aplicação gerada no painel (ex: cjc_live_...)
     * @param string $baseUrl  URL base da central (padrão: https://pays.cjcdev.site ou http://localhost:4020)
     * @param int    $timeout  Tempo limite em segundos para requisições cURL
     */
    public function __construct(
        string $apiKey,
        string $baseUrl = 'https://pays.cjcdev.site',
        int $timeout = 15
    ) {
        $this->apiKey = trim($apiKey);
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;
    }

    /**
     * Gera o external_reference no padrão contábil obrigatório: {ID_ESTABELECIMENTO}-{TIPO}-{ID_PEDIDO}
     *
     * @param string     $estabelecimentoId ID do estabelecimento/tenant (ex: 'ESTAB001')
     * @param string     $tipo              Tipo da transação (ex: 'PEDIDO', 'CORTE', 'SERVICO')
     * @param string|int $pedidoId          ID único do pedido no sistema local
     * @return string Exemplo: 'ESTAB002-PEDIDO-12345'
     */
    public static function buildExternalReference(string $estabelecimentoId, string $tipo, $pedidoId): string
    {
        $cleanEstab = strtoupper(preg_replace('/[^A-Za-z0-9_]/', '', trim($estabelecimentoId)));
        $cleanTipo = strtoupper(preg_replace('/[^A-Za-z0-9_]/', '', trim($tipo)));
        $cleanPedido = preg_replace('/[^A-Za-z0-9_]/', '', (string)$pedidoId);

        return "{$cleanEstab}-{$cleanTipo}-{$cleanPedido}";
    }

    /**
     * Decodifica uma external_reference no padrão contábil {ID_ESTABELECIMENTO}-{TIPO}-{ID_PEDIDO}
     *
     * @param string $externalReference
     * @return array|null Array com [estabelecimento_id, tipo, pedido_id] ou null
     */
    public static function parseExternalReference(string $externalReference): ?array
    {
        $parts = explode('-', trim($externalReference), 3);
        if (count($parts) !== 3) {
            return null;
        }

        return [
            'estabelecimento_id' => $parts[0],
            'tipo' => $parts[1],
            'pedido_id' => $parts[2],
        ];
    }

    /**
     * Cria uma cobrança PIX com geração imediata de QR Code e Copia-e-Cola
     *
     * @param array $data {
     *   @type string $external_reference Identificador único do pedido no seu sistema (obrigatório)
     *   @type float  $amount             Valor em BRL (ex: 49.90) (obrigatório)
     *   @type string $description        Descrição da cobrança (obrigatório)
     *   @type array  $payer              {
     *       @type string $email          E-mail do pagador (obrigatório)
     *       @type string $first_name     Nome do pagador (opcional)
     *       @type string $last_name      Sobrenome (opcional)
     *       @type array  $identification { type: 'CPF'|'CNPJ', number: '12345678909' } (opcional)
     *   }
     *   @type string $callback_url       URL customizada para receber o webhook deste pedido (opcional)
     *   @type array  $metadata           Metadados adicionais do seu sistema (opcional)
     * }
     * @return array Resposta da central com payment.id, qr_code, qr_code_base64, etc.
     * @throws CJCPaysException
     */
    public function createPix(array $data): array
    {
        return $this->request('POST', '/api/v1/payments/pix', $data);
    }

    /**
     * Cria uma cobrança via Cartão de Crédito
     *
     * @param array $data Dados com token do cartão, installments, payer, etc.
     * @return array
     * @throws CJCPaysException
     */
    public function createCard(array $data): array
    {
        return $this->request('POST', '/api/v1/payments/card', $data);
    }

    /**
     * Obtém a Public Key oficial ativa na Central para tokenização segura de cartão no frontend
     *
     * @return string Public Key (ex: TEST-... ou APP_USR-...)
     * @throws CJCPaysException
     */
    public function getPublicKey(): string
    {
        $res = $this->request('GET', '/api/v1/public-key');
        return (string)($res['public_key'] ?? '');
    }

    /**
     * Consulta o status atual de um pagamento pelo ID da Central (ex: pay_ck...)
     *
     * @param string $paymentId ID gerado no CJC-Dev-Pays
     * @return array
     * @throws CJCPaysException
     */
    public function getPayment(string $paymentId): array
    {
        return $this->request('GET', '/api/v1/payments/' . rawurlencode($paymentId));
    }

    /**
     * Consulta o status de um pagamento pelo external_reference do seu sistema
     *
     * @param string $externalReference Referência externa enviada no checkout
     * @return array
     * @throws CJCPaysException
     */
    public function getPaymentByReference(string $externalReference): array
    {
        return $this->request('GET', '/api/v1/payments/by-reference/' . rawurlencode($externalReference));
    }

    /**
     * Solicita estorno ou cancelamento de um pagamento aprovado
     *
     * @param string $paymentId ID do pagamento na central
     * @return array
     * @throws CJCPaysException
     */
    public function refund(string $paymentId): array
    {
        return $this->request('POST', '/api/v1/payments/' . rawurlencode($paymentId) . '/refund');
    }

    /**
     * Verifica se o servidor da Central CJC-Dev-Pays está online e acessível
     *
     * @return array
     * @throws CJCPaysException
     */
    public function healthCheck(): array
    {
        return $this->request('GET', '/health');
    }

    /**
     * Executor interno de chamadas HTTP via cURL nativo
     */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $url = $this->baseUrl . $path;
        $ch = curl_init();

        $headers = [
            'Accept: application/json',
            'User-Agent: CJCPays-PHP-SDK/1.0',
        ];

        // Endpoints /api/v1 exigem a chave de API
        if (strpos($path, '/api/v1') === 0) {
            $headers[] = 'X-Api-Key: ' . $this->apiKey;
        }

        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];

        if ($body !== null && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'])) {
            $jsonPayload = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $headers[] = 'Content-Type: application/json';
            $headers[] = 'Content-Length: ' . strlen((string)$jsonPayload);
            $options[CURLOPT_POSTFIELDS] = $jsonPayload;
        }

        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $options);

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false) {
            throw new CJCPaysException('Erro de conexão cURL com CJC-Dev-Pays: ' . $curlError, 0);
        }

        $decoded = json_decode((string)$responseBody, true);

        if ($httpCode >= 400) {
            $errorMessage = $decoded['error'] ?? 'Erro na requisição à Central CJC-Dev-Pays (HTTP ' . $httpCode . ')';
            throw new CJCPaysException($errorMessage, $httpCode, is_array($decoded) ? $decoded : null);
        }

        if (!is_array($decoded)) {
            throw new CJCPaysException('Resposta inválida retornada pela Central: ' . substr((string)$responseBody, 0, 200), $httpCode);
        }

        return $decoded;
    }
}
