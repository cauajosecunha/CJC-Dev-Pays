class WebhookDeliveryModel {
  final String id;
  final String? paymentId;
  final String? applicationId;
  final String event;
  final String targetUrl;
  final String? payload;
  final String? headers;
  final int? responseStatus;
  final String? responseBody;
  final int attempts;
  final int maxAttempts;
  final String status;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final WebhookDeliveryApp? application;
  final WebhookDeliveryPayment? payment;

  WebhookDeliveryModel({
    required this.id,
    this.paymentId,
    this.applicationId,
    required this.event,
    required this.targetUrl,
    this.payload,
    this.headers,
    this.responseStatus,
    this.responseBody,
    required this.attempts,
    required this.maxAttempts,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    this.application,
    this.payment,
  });

  factory WebhookDeliveryModel.fromJson(Map<String, dynamic> json) {
    return WebhookDeliveryModel(
      id: json['id']?.toString() ?? '',
      paymentId: json['paymentId']?.toString(),
      applicationId: json['applicationId']?.toString(),
      event: json['event']?.toString() ?? 'payment.updated',
      targetUrl: json['targetUrl']?.toString() ?? '',
      payload: json['payload']?.toString(),
      headers: json['headers']?.toString(),
      responseStatus: (json['httpStatus'] ?? json['responseStatus']) as int?,
      responseBody: json['responseBody']?.toString(),
      attempts: (json['attempts'] as num?)?.toInt() ?? 1,
      maxAttempts: (json['maxAttempts'] as num?)?.toInt() ?? 5,
      status: (json['status']?.toString() ?? 'PENDING').toUpperCase(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
      application: json['application'] != null
          ? WebhookDeliveryApp.fromJson(json['application'] as Map<String, dynamic>)
          : null,
      payment: json['payment'] != null
          ? WebhookDeliveryPayment.fromJson(json['payment'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get isDelivered => status == 'DELIVERED';
  bool get isFailed => status == 'FAILED';
  bool get isPending => status == 'PENDING';
}

class WebhookDeliveryApp {
  final String id;
  final String name;
  final String slug;

  WebhookDeliveryApp({
    required this.id,
    required this.name,
    required this.slug,
  });

  factory WebhookDeliveryApp.fromJson(Map<String, dynamic> json) {
    return WebhookDeliveryApp(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
    );
  }
}

class WebhookDeliveryPayment {
  final String id;
  final String? externalReference;
  final double amount;
  final String? status;

  WebhookDeliveryPayment({
    required this.id,
    this.externalReference,
    required this.amount,
    this.status,
  });

  factory WebhookDeliveryPayment.fromJson(Map<String, dynamic> json) {
    return WebhookDeliveryPayment(
      id: json['id']?.toString() ?? '',
      externalReference: json['externalReference']?.toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status']?.toString(),
    );
  }
}
