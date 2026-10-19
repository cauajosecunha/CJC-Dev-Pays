class PaymentModel {
  final String id;
  final String? applicationId;
  final PaymentApplication? application;
  final String? mpPaymentId;
  final String? externalReference;
  final double amount;
  final double netAmount;
  final double feeAmount;
  final String paymentMethod;
  final String status;
  final String? statusDetail;
  final String? payerName;
  final String? payerEmail;
  final String? payerDocument;
  final String? description;
  final String? qrCode;
  final String? qrCodeBase64;
  final DateTime createdAt;
  final DateTime? paidAt;
  final List<PaymentDeliverySummary>? deliveries;

  PaymentModel({
    required this.id,
    this.applicationId,
    this.application,
    this.mpPaymentId,
    this.externalReference,
    required this.amount,
    required this.netAmount,
    required this.feeAmount,
    required this.paymentMethod,
    required this.status,
    this.statusDetail,
    this.payerName,
    this.payerEmail,
    this.payerDocument,
    this.description,
    this.qrCode,
    this.qrCodeBase64,
    required this.createdAt,
    this.paidAt,
    this.deliveries,
  });

  factory PaymentModel.fromJson(Map<String, dynamic> json) {
    return PaymentModel(
      id: json['id']?.toString() ?? '',
      applicationId: json['applicationId']?.toString(),
      application: json['application'] != null
          ? PaymentApplication.fromJson(json['application'] as Map<String, dynamic>)
          : null,
      mpPaymentId: json['mpPaymentId']?.toString(),
      externalReference: json['externalReference']?.toString(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      netAmount: ((json['netReceivedAmount'] ?? json['netAmount']) as num?)?.toDouble() ??
          ((json['amount'] as num?)?.toDouble() ?? 0.0),
      feeAmount: (json['feeAmount'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: (json['paymentMethod']?.toString() ?? 'PIX').toUpperCase(),
      status: (json['status']?.toString() ?? 'PENDING').toUpperCase(),
      statusDetail: json['statusDetail']?.toString(),
      payerName: json['payerName']?.toString(),
      payerEmail: json['payerEmail']?.toString(),
      payerDocument: json['payerDocument']?.toString(),
      description: json['description']?.toString(),
      qrCode: json['qrCode']?.toString(),
      qrCodeBase64: json['qrCodeBase64']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      paidAt: json['paidAt'] != null ? DateTime.tryParse(json['paidAt'].toString()) : null,
      deliveries: (json['deliveries'] as List<dynamic>?)
          ?.map((d) => PaymentDeliverySummary.fromJson(d as Map<String, dynamic>))
          .toList(),
    );
  }

  bool get isApproved => status == 'APPROVED';
  bool get isPending => status == 'PENDING';
  bool get isRefunded => status == 'REFUNDED';
  bool get isRejected => status == 'REJECTED' || status == 'CANCELLED';
}

class PaymentApplication {
  final String id;
  final String name;
  final String slug;

  PaymentApplication({
    required this.id,
    required this.name,
    required this.slug,
  });

  factory PaymentApplication.fromJson(Map<String, dynamic> json) {
    return PaymentApplication(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
    );
  }
}

class PaymentDeliverySummary {
  final String id;
  final String status;
  final int? httpStatus;
  final int attempts;

  PaymentDeliverySummary({
    required this.id,
    required this.status,
    this.httpStatus,
    required this.attempts,
  });

  factory PaymentDeliverySummary.fromJson(Map<String, dynamic> json) {
    return PaymentDeliverySummary(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      httpStatus: (json['httpStatus'] as num?)?.toInt(),
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    );
  }
}
