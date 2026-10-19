import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';
import '../models/application.dart';
import '../models/fee_settings.dart';
import '../models/financial_report.dart';
import '../models/kpi_metrics.dart';
import '../models/payment.dart';
import '../models/user.dart';
import '../models/webhook_delivery.dart';
import 'auth_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class PaymentsResult {
  final List<PaymentModel> payments;
  final int total;
  final int totalPages;

  PaymentsResult({
    required this.payments,
    required this.total,
    required this.totalPages,
  });
}

class DeliveriesResult {
  final List<WebhookDeliveryModel> deliveries;
  final int total;
  final int totalPages;

  DeliveriesResult({
    required this.deliveries,
    required this.total,
    required this.totalPages,
  });
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  final AuthService _auth = AuthService();

  Map<String, String> get _headers {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_auth.token != null) {
      headers['Authorization'] = 'Bearer ${_auth.token}';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, dynamic>? queryParams]) {
    final base = _auth.baseUrl;
    final queryString = queryParams != null && queryParams.isNotEmpty
        ? '?${queryParams.entries.where((e) => e.value != null && e.value.toString().isNotEmpty).map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value.toString())}').join('&')}'
        : '';
    return Uri.parse('$base$path$queryString');
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode == 401) {
      _auth.logout();
      throw ApiException('Sessão expirada. Faça login novamente.', 401);
    }

    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final errorMessage = body is Map<String, dynamic>
        ? (body['error'] ?? body['message'] ?? 'Erro no servidor (${response.statusCode})')
        : 'Erro HTTP ${response.statusCode}';
    throw ApiException(errorMessage.toString(), response.statusCode);
  }

  /// Verifica se o servidor está online
  Future<bool> checkHealth([String? customUrl]) async {
    try {
      final url = customUrl != null
          ? (customUrl.endsWith('/') ? '${customUrl}health' : '$customUrl/health')
          : '${_auth.baseUrl}/health';
      final response = await http
          .get(Uri.parse(url), headers: {'Accept': 'application/json'})
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Login administrativo
  Future<AdminUser> login(String identifier, String password) async {
    try {
      final response = await http
          .post(
            _uri('/api/admin/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': identifier,
              'password': password,
            }),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      final token = data['token'] as String;
      final user = AdminUser.fromJson(data['user'] as Map<String, dynamic>);

      await _auth.saveSession(token: token, user: user);
      return user;
    } on SocketException {
      throw ApiException('Não foi possível conectar ao servidor. Verifique a URL e sua conexão.');
    } on TimeoutException {
      throw ApiException('Tempo de conexão esgotado.');
    }
  }

  /// Métricas consolidadas do Dashboard
  Future<DashboardMetrics> getMetrics({int? month, int? year}) async {
    try {
      final query = <String, dynamic>{};
      if (month != null) query['month'] = month;
      if (year != null) query['year'] = year;

      final response = await http
          .get(_uri('/api/admin/metrics', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return DashboardMetrics.fromJson(data);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Histórico de pagamentos paginado
  Future<PaymentsResult> getPayments({
    int page = 1,
    int limit = 20,
    String? status,
    String? appId,
    String? search,
  }) async {
    try {
      final query = {
        'page': page,
        'limit': limit,
        if (status != null && status != 'ALL') 'status': status,
        if (appId != null && appId != 'ALL') 'appId': appId,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      };

      final response = await http
          .get(_uri('/api/admin/payments', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      final list = (data['payments'] as List<dynamic>? ?? [])
          .map((item) => PaymentModel.fromJson(item as Map<String, dynamic>))
          .toList();

      final pagination = data['pagination'] as Map<String, dynamic>? ?? {};
      final total = (pagination['total'] as num?)?.toInt() ?? list.length;
      final totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;

      return PaymentsResult(payments: list, total: total, totalPages: totalPages);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Detalhes de um pagamento específico
  Future<PaymentModel> getPaymentDetails(String id) async {
    try {
      final response = await http
          .get(_uri('/api/admin/payments/$id'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return PaymentModel.fromJson(data['payment'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Estorna um pagamento
  Future<void> refundPayment(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/payments/$id/refund'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      _processResponse(response);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Lista de aplicações multi-tenant
  Future<List<ApplicationModel>> getApplications() async {
    try {
      final response = await http
          .get(_uri('/api/admin/applications'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      final list = (data['applications'] as List<dynamic>? ?? [])
          .map((item) => ApplicationModel.fromJson(item as Map<String, dynamic>))
          .toList();
      return list;
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Teste de conectividade do webhook (Ping)
  Future<Map<String, dynamic>> pingApplication(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/applications/$id/ping'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      return _processResponse(response) as Map<String, dynamic>;
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Fila de webhooks paginada
  Future<DeliveriesResult> getDeliveries({
    int page = 1,
    int limit = 20,
    String? status,
    String? appId,
    String? search,
  }) async {
    try {
      final query = {
        'page': page,
        'limit': limit,
        if (status != null && status != 'ALL') 'status': status,
        if (appId != null && appId != 'ALL') 'appId': appId,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      };

      final response = await http
          .get(_uri('/api/admin/webhooks/deliveries', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      final list = (data['deliveries'] as List<dynamic>? ?? [])
          .map((item) => WebhookDeliveryModel.fromJson(item as Map<String, dynamic>))
          .toList();

      final pagination = data['pagination'] as Map<String, dynamic>? ?? {};
      final total = (pagination['total'] as num?)?.toInt() ?? list.length;
      final totalPages = (pagination['totalPages'] as num?)?.toInt() ?? 1;

      return DeliveriesResult(deliveries: list, total: total, totalPages: totalPages);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Inspeciona detalhes do webhook
  Future<WebhookDeliveryModel> getDeliveryDetails(String id) async {
    try {
      final response = await http
          .get(_uri('/api/admin/webhooks/deliveries/$id'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return WebhookDeliveryModel.fromJson(data['delivery'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Retenta envio do webhook
  Future<Map<String, dynamic>> retryDelivery(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/webhooks/deliveries/$id/retry'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      return _processResponse(response) as Map<String, dynamic>;
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  // ==================== CRUD DE APLICAÇÕES ====================

  /// Cadastra uma nova aplicação cliente
  Future<ApplicationModel> createApplication({
    required String name,
    required String slug,
    String? webhookUrl,
    bool isCommissionExempt = false,
  }) async {
    try {
      final response = await http
          .post(
            _uri('/api/admin/applications'),
            headers: _headers,
            body: jsonEncode({
              'name': name.trim(),
              'slug': slug.trim().toLowerCase(),
              if (webhookUrl != null && webhookUrl.trim().isNotEmpty) 'webhookUrl': webhookUrl.trim(),
              'isCommissionExempt': isCommissionExempt,
            }),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return ApplicationModel.fromJson(data['application'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Atualiza os dados de uma aplicação
  Future<ApplicationModel> updateApplication({
    required String id,
    String? name,
    String? webhookUrl,
    bool? isActive,
    bool? isCommissionExempt,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (name != null) payload['name'] = name.trim();
      if (webhookUrl != null) payload['webhookUrl'] = webhookUrl.trim();
      if (isActive != null) payload['isActive'] = isActive;
      if (isCommissionExempt != null) payload['isCommissionExempt'] = isCommissionExempt;

      final response = await http
          .put(
            _uri('/api/admin/applications/$id'),
            headers: _headers,
            body: jsonEncode(payload),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return ApplicationModel.fromJson(data['application'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Exclui uma aplicação cliente
  Future<void> deleteApplication(String id) async {
    try {
      final response = await http
          .delete(_uri('/api/admin/applications/$id'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      _processResponse(response);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Rotaciona a chave de API de uma aplicação
  Future<String> regenerateApiKey(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/applications/$id/regenerate-key'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return data['application']?['apiKey']?.toString() ?? '';
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Limpa todas as transações e webhooks de uma aplicação
  Future<String> clearApplicationTransactions(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/applications/$id/clear-transactions'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return data['message']?.toString() ?? 'Transações limpas com sucesso.';
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  // ==================== EXPURGO E SIMULADOR ====================

  /// Limpa pagamentos não pagos / expirados do histórico
  Future<int> purgeExpiredPayments({String? appId}) async {
    try {
      final query = appId != null && appId.isNotEmpty && appId != 'ALL' ? {'appId': appId} : null;
      final response = await http
          .post(_uri('/api/admin/payments/expired/purge', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return (data['deletedCount'] as num?)?.toInt() ?? 0;
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Simula um pagamento Pix para testes
  Future<PaymentModel> simulatePayment({
    required String applicationId,
    required double amount,
    String? description,
    bool autoApprove = false,
  }) async {
    try {
      final response = await http
          .post(
            _uri('/api/admin/simulator/simulate-payment'),
            headers: _headers,
            body: jsonEncode({
              'applicationId': applicationId,
              'amount': amount,
              'description': description,
              'autoApprove': autoApprove,
            }),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return PaymentModel.fromJson(data['payment'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Aprova um pagamento manualmente / em modo sandbox
  Future<PaymentModel> approveSimulatedPayment(String id) async {
    try {
      final response = await http
          .post(_uri('/api/admin/simulator/approve-payment/$id'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return PaymentModel.fromJson(data['payment'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  // ==================== CRUD DE ADMINISTRADORES ====================

  /// Lista todos os administradores cadastrados
  Future<List<AdminUser>> getAdminUsers() async {
    try {
      final response = await http
          .get(_uri('/api/admin/users'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      final list = (data['users'] as List<dynamic>? ?? [])
          .map((item) => AdminUser.fromJson(item as Map<String, dynamic>))
          .toList();
      return list;
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Cria um novo administrador
  Future<AdminUser> createAdminUser({
    required String name,
    required String email,
    String? username,
    required String password,
  }) async {
    try {
      final response = await http
          .post(
            _uri('/api/admin/users'),
            headers: _headers,
            body: jsonEncode({
              'name': name.trim(),
              'email': email.trim().toLowerCase(),
              'username': username?.trim().isNotEmpty == true ? username!.trim() : null,
              'password': password,
            }),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return AdminUser.fromJson(data['user'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Atualiza os dados de um administrador
  Future<AdminUser> updateAdminUser({
    required String id,
    String? name,
    String? email,
    String? username,
    String? password,
  }) async {
    try {
      final payload = <String, dynamic>{};
      if (name != null) payload['name'] = name.trim();
      if (email != null) payload['email'] = email.trim().toLowerCase();
      if (username != null) payload['username'] = username.trim().isNotEmpty ? username.trim() : null;
      if (password != null && password.isNotEmpty) payload['password'] = password;

      final response = await http
          .put(
            _uri('/api/admin/users/$id'),
            headers: _headers,
            body: jsonEncode(payload),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return AdminUser.fromJson(data['user'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Remove um administrador
  Future<void> deleteAdminUser(String id) async {
    try {
      final response = await http
          .delete(_uri('/api/admin/users/$id'), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      _processResponse(response);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  // ==================== CONFIGURAÇÃO DE TAXAS E COMISSÕES ====================

  /// Obtém as taxas da plataforma configuradas
  Future<FeeSettingsModel> getFeeSettings({double? amount}) async {
    try {
      final query = amount != null ? {'amount': amount.toString()} : null;
      final response = await http
          .get(_uri('/api/admin/settings/fees', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return FeeSettingsModel.fromJson(data['settings'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Salva as taxas e comissões da plataforma
  Future<FeeSettingsModel> updateFeeSettings(FeeSettingsModel settings) async {
    try {
      final response = await http
          .put(
            _uri('/api/admin/settings/fees'),
            headers: _headers,
            body: jsonEncode(settings.toJson()),
          )
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return FeeSettingsModel.fromJson(data['settings'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  // ==================== RELATÓRIO FINANCEIRO & CONTÁBIL ====================

  /// Obtém o demonstrativo financeiro e contábil consolidado
  Future<FinancialReportModel> getFinancialReport({
    int? month,
    int? year,
    String? startDate,
    String? endDate,
    String? applicationId,
    String? paymentMethod,
  }) async {
    try {
      final query = <String, String>{};
      if (month != null) query['month'] = month.toString();
      if (year != null) query['year'] = year.toString();
      if (startDate != null && startDate.isNotEmpty) query['startDate'] = startDate;
      if (endDate != null && endDate.isNotEmpty) query['endDate'] = endDate;
      if (applicationId != null && applicationId.isNotEmpty && applicationId != 'ALL') {
        query['applicationId'] = applicationId;
      }
      if (paymentMethod != null && paymentMethod.isNotEmpty && paymentMethod != 'ALL') {
        query['paymentMethod'] = paymentMethod;
      }

      final response = await http
          .get(_uri('/api/admin/financial/report', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      final data = _processResponse(response) as Map<String, dynamic>;
      return FinancialReportModel.fromJson(data['report'] as Map<String, dynamic>);
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }

  /// Retorna o conteúdo CSV do relatório financeiro
  Future<String> downloadFinancialCsv({
    int? month,
    int? year,
    String? startDate,
    String? endDate,
    String? applicationId,
    String? paymentMethod,
  }) async {
    try {
      final query = <String, String>{};
      if (month != null) query['month'] = month.toString();
      if (year != null) query['year'] = year.toString();
      if (startDate != null && startDate.isNotEmpty) query['startDate'] = startDate;
      if (endDate != null && endDate.isNotEmpty) query['endDate'] = endDate;
      if (applicationId != null && applicationId.isNotEmpty && applicationId != 'ALL') {
        query['applicationId'] = applicationId;
      }
      if (paymentMethod != null && paymentMethod.isNotEmpty && paymentMethod != 'ALL') {
        query['paymentMethod'] = paymentMethod;
      }

      final response = await http
          .get(_uri('/api/admin/financial/export/csv', query), headers: _headers)
          .timeout(AppConstants.connectTimeout);

      if (response.statusCode == 200) {
        return utf8.decode(response.bodyBytes);
      } else {
        throw ApiException('Falha ao exportar CSV (HTTP ${response.statusCode})');
      }
    } on SocketException {
      throw ApiException('Sem conexão com o servidor.');
    }
  }
}
