# 🐘 CJC-Dev-Pays — SDK PHP

Biblioteca PHP enxuta, moderna e **sem dependências externas** (utiliza cURL e JSON nativos) para conectar qualquer sistema PHP (WordPress, Laravel, sistemas próprios ou WebApps) à Central de Pagamentos **CJC-Dev-Pays**.

---

## 📁 Estrutura dos Arquivos

| Arquivo | Descrição |
|---|---|
| `CJCPaysClient.php` | Classe principal para comunicação com a API (criar Pix, consultar status, estornar). |
| `CJCPaysWebhook.php` | Validador de assinatura criptográfica HMAC-SHA256 para endpoints receptores de webhook. |
| `example_create_pix.php` | Exemplo pronto de criação de cobrança Pix com retorno de QR Code e Copia-e-Cola. |
| `example_check_status.php` | Exemplo pronto de consulta de status de pagamento por ID ou referência externa. |
| `example_refund.php` | Exemplo pronto para solicitar estorno/reembolso de cobrança. |
| `example_webhook.php` | Exemplo de endpoint receptor pronto para receber notificações de pagamento aprovado. |

---

## 🚀 Como Integrar no seu Projeto PHP

### 1. Copie os Arquivos
Copie `CJCPaysClient.php` e `CJCPaysWebhook.php` para a pasta de integrações ou serviços do seu projeto PHP.

### 2. Configure o `.env` da sua Loja
No painel da Central (**Aplicações & Chaves**), clique em **📋 Copiar .env** no card da sua loja e cole no seu `.env`:
```ini
CJC_PAYS_BASE_URL=https://pays.cjcdev.site
CJC_PAYS_API_KEY=cjc_live_CHAVE_DESTA_LOJA
CJC_PAYS_WEBHOOK_SECRET=whsec_SEGREDO_DESTA_LOJA
```

---

## 🏢 Padrão de Contabilidade e Identificação Automática

A Central de Pagamentos associa cada transação automaticamente ao `{ID_ESTABELECIMENTO}` da loja a partir da `X-Api-Key` enviada. 

Se você enviar `external_reference: "PEDIDO-12345"`, a Central prefixará automaticamente o código da loja (ex: `SUA-LOJA-PEDIDO-12345`) e preencherá os metadados contábeis (`estabelecimento_id`, `estabelecimento_nome`).

Caso queira construir ou decodificar a referência manualmente, o SDK disponibiliza:
```php
$ref = CJCPaysClient::buildExternalReference('SUA-LOJA', 'PEDIDO', 12345);
// Retorna: 'SUA-LOJA-PEDIDO-12345'

$dados = CJCPaysClient::parseExternalReference($ref);
// ['estabelecimento_id' => 'SUA-LOJA', 'tipo' => 'PEDIDO', 'pedido_id' => '12345']
```

---

## ⚡ Exemplos Rápidos de Uso

### Gerar Cobrança PIX
```php
require_once __DIR__ . '/CJCPaysClient.php';

$client = new CJCPaysClient(
    $_ENV['CJC_PAYS_API_KEY'] ?? 'cjc_live_SUA_CHAVE',
    $_ENV['CJC_PAYS_BASE_URL'] ?? 'https://pays.cjcdev.site'
);

$response = $client->createPix([
    'external_reference' => 'PEDIDO-12345', // A Central prefixa o ID da loja automaticamente!
    'amount' => 49.90,
    'description' => 'Pedido #12345 - Sua Loja',
    'payer' => [
        'email' => 'cliente@exemplo.com',
        'first_name' => 'Cauã',
        'last_name' => 'Cunha',
        'identification' => [
            'type' => 'CPF',
            'number' => '12345678909'
        ]
    ],
    'metadata' => [
        'pedido_id' => 12345,
    ]
]);

// Exibir Copia e Cola Pix:
echo $response['payment']['qr_code'];

// Exibir Imagem do QR Code Base64:
echo '<img src="data:image/png;base64,' . $response['payment']['qr_code_base64'] . '" />';
```

### Receber e Validar Webhook com Segurança
```php
require_once __DIR__ . '/CJCPaysWebhook.php';

$rawBody = (string)file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_CJC_SIGNATURE'] ?? '';
$secret = 'whsec_SEU_SEGREDO_AQUI';

try {
    $payload = CJCPaysWebhook::verify($rawBody, $signature, $secret);

    if ($payload['status'] === 'approved') {
        // Pagamento aprovado! Libere o pedido no seu banco de dados
        $pedidoRef = $payload['external_reference'];
    }

    http_response_code(200);
    echo json_encode(['received' => true]);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
```

---

## 🤖 Prompt Pronto para Enviar à IA da sua Loja

Ao colar esta pasta `sdk-pays-php/` na raiz do projeto da sua loja e copiar o `.env` do painel, basta enviar o seguinte comando para o seu assistente de IA (Antigravity / Cursor / Claude):

> *"Integre o gateway de pagamentos no checkout do meu sistema usando o SDK em `sdk-pays-php/`. Utilize as variáveis `CJC_PAYS_BASE_URL`, `CJC_PAYS_API_KEY` e `CJC_PAYS_WEBHOOK_SECRET` do `.env`. Crie o fluxo de emissão de cobrança Pix exibindo o QR Code/Copia-e-Cola e implemente o endpoint de webhook com validação HMAC via `CJCPaysWebhook::verify` para aprovar os pedidos automaticamente."*
