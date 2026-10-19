import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';
import '../models/application.dart';
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

  Future<dynamic> _processResponse(http.Response response) {
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
}
