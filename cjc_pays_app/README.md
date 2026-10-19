# 📱 CJC Dev Pays — App Mobile Android (Flutter)

Aplicativo oficial Android desenvolvido em **Flutter** para monitoramento em tempo real, auditoria financeira e gestão operacional da **Central de Pagamentos CJC Dev Pays**.

---

## 🚀 Funcionalidades

### 1. 📊 Visão Geral (Dashboard Financeiro)
- **Filtro Mensal Dinâmico:** Seletor de período horizontal (Janeiro a Dezembro + Ano Todo Consolidado), iniciando com o mês atual selecionado.
- **KPIs em Tempo Real:** Volume Total Aprovado (Bruto e Líquido), Faturamento Hoje vs Mês, Taxa de Conversão (%) e Saúde dos Webhooks (%).
- **Volume por Aplicação:** Distribuição percentual do faturamento das lojas clientes (*Sua Loja*, *Seu Salão*, *FaceCraft*) com barras de progresso proporcionais.
- **Transações Recentes:** Feed das últimas cobranças com status luminoso e acesso direto aos detalhes com 1 toque.
- **Pull to Refresh:** Atualização instantânea dos indicadores com gesto de puxar para baixo.

### 2. 💳 Transações e Conciliação
- **Busca em Tempo Real:** Filtro rápido por ID Mercado Pago, código de referência externa ou nome/e-mail do cliente.
- **Chips de Status:** Filtros por Aprovados, Pendentes, Estornados e Cancelados.
- **Scroll Infinito:** Paginação automática no servidor conforme a rolagem.
- **Dossiê Completo do Pagamento:**
  - Valor bruto, taxas descontadas e valor líquido creditado.
  - Dados do pagador (Nome, CPF/CNPJ, E-mail).
  - Identificadores (ID interno, ID Mercado Pago, Referência Externa) com botão de cópia com 1 toque.
  - **Pix Copia e Cola:** Exibição do código textual e renderização gráfica do QR Code Pix oficial na tela.
  - **Ação de Estorno:** Botão de estorno administrativo com diálogo de confirmação seguro.

### 3. 🏢 Aplicações & Chaves (Multi-Tenant)
- Listagem dos serviços clientes cadastrados com contadores de pagamentos e notificações.
- Visualização e cópia rápida de **Chave de API** (`cjc_live_...`), **Segredo HMAC** (`whsec_...`) e **Endpoint Webhook Receptor**.
- **Teste de Conectividade (Ping):** Disparo de ping assinado via HMAC diretamente do app com medição de latência em milissegundos.

### 4. 📡 Fila de Webhooks (Fan-Out)
- Monitoramento de todas as entregas de webhook para as lojas parceiras.
- Filtros por status de entrega (`DELIVERED`, `PENDING`, `FAILED`).
- **Inspeção Técnica:** Visualização formatada do JSON do payload enviado e resposta HTTP retornada pelo cliente.
- **Reenvio Forçado (Retry Now):** Botão de reenvio instantâneo para entregas que falharam.

### 5. ⚙️ Alternância de Servidor & Conectividade
- Suporte a múltiplos ambientes configuráveis via interface:
  - ☁️ **Produção:** `https://pays.cjcdev.site` (Padrão)
  - 📱 **Emulador Android:** `http://10.0.2.2:4020`
  - 🏠 **Localhost / Rede Wi-Fi:** `http://192.168.3.X:4020` ou `http://127.0.0.1:4020`
- Botão "Testar Conexão (Ping)" com validação de `/health`.

---

## 🏗️ Estrutura de Pastas

```text
cjc_pays_app/
├── assets/
│   └── images/
│       └── logo.png              # Arte oficial Fintech CJC Dev Pays
├── lib/
│   ├── constants/
│   │   ├── app_colors.dart       # Paleta de cores dark mode (CJC Dark Theme)
│   │   └── app_constants.dart    # Constantes, URLs padrão e chaves de storage
│   ├── models/
│   │   ├── application.dart      # Modelo de aplicações multi-tenant
│   │   ├── kpi_metrics.dart      # Modelo de KPIs e métricas do dashboard
│   │   ├── payment.dart          # Modelo de transações e cobranças
│   │   ├── user.dart             # Modelo de usuário administrador
│   │   └── webhook_delivery.dart # Modelo de entregas de webhook
│   ├── screens/
│   │   ├── applications_tab.dart # Aba de Aplicações e Chaves
│   │   ├── dashboard_tab.dart    # Aba de Visão Geral com KPIs
│   │   ├── home_screen.dart      # Container principal com BottomNavigationBar
│   │   ├── login_screen.dart     # Tela de login administrativo
│   │   ├── payment_detail_screen.dart # Detalhes da transação e estorno
│   │   ├── payments_tab.dart     # Aba de Transações com filtros e busca
│   │   ├── server_settings_screen.dart # Configuração de servidor e ping
│   │   ├── splash_screen.dart    # Inicialização e auto-login
│   │   ├── webhook_detail_screen.dart # Inspeção técnica de payload/headers
│   │   └── webhooks_tab.dart     # Aba de Fila de Webhooks
│   ├── services/
│   │   ├── api_service.dart      # Cliente HTTP com todos os endpoints
│   │   └── auth_service.dart     # Gerenciamento de sessão JWT e SharedPreferences
│   ├── theme/
│   │   └── app_theme.dart        # Tema escuro elegante Material 3
│   ├── widgets/
│   │   ├── app_chip.dart         # Badge de identificação das lojas clientes
│   │   ├── kpi_card.dart         # Cartão métrico com ícones e gradientes
│   │   └── status_badge.dart     # Badge colorido de status
│   └── main.dart                 # Ponto de entrada da aplicação
└── test/
    └── widget_test.dart          # Teste automatizado de inicialização
```

---

## 📲 Como Executar no Dispositivo Android

### Pré-requisitos
- Flutter 3.38+ e Dart 3.10+
- Dispositivo Android conectado via USB ou Wi-Fi (ADB)

### 1. Obter dependências
```bash
cd cjc_pays_app
flutter pub get
```

### 2. Executar no aparelho conectado
```bash
# Executa no primeiro dispositivo disponível (ex: SM A715F)
flutter run

# Ou selecionando o dispositivo específico via IP/ADB:
flutter run -d 192.168.3.17:5555
```

### 3. Gerar APK de Produção (Release)
```bash
flutter build apk --release
```
O arquivo APK gerado estará disponível em:
`build/app/outputs/flutter-apk/app-release.apk`
