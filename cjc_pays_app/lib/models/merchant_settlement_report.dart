class MerchantSettlementReportModel {
  final String periodLabel;
  final int month;
  final int year;
  final String generatedAt;
  final MerchantAppInfo application;
  final MerchantCompanyInfo company;
  final MerchantMetrics metrics;
  final List<MerchantMethodItem> byMethod;
  final List<MerchantTxItem> transactions;

  MerchantSettlementReportModel({
    required this.periodLabel,
    required this.month,
    required this.year,
    required this.generatedAt,
    required this.application,
    required this.company,
    required this.metrics,
    required this.byMethod,
    required this.transactions,
  });

  factory MerchantSettlementReportModel.fromJson(Map<String, dynamic> json) {
    return MerchantSettlementReportModel(
      periodLabel: json['periodLabel']?.toString() ?? '',
      month: (json['month'] as num?)?.toInt() ?? 1,
      year: (json['year'] as num?)?.toInt() ?? 2026,
      generatedAt: json['generatedAt']?.toString() ?? '',
      application: MerchantAppInfo.fromJson(json['application'] as Map<String, dynamic>? ?? {}),
      company: MerchantCompanyInfo.fromJson(json['company'] as Map<String, dynamic>? ?? {}),
      metrics: MerchantMetrics.fromJson(json['metrics'] as Map<String, dynamic>? ?? {}),
      byMethod: (json['byMethod'] as List<dynamic>? ?? [])
          .map((e) => MerchantMethodItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      transactions: (json['transactions'] as List<dynamic>? ?? [])
          .map((e) => MerchantTxItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MerchantAppInfo {
  final String id;
  final String name;
  final String slug;
  final String establishmentId;
  final String? logoUrl;
  final String? contactEmail;
  final String? contactPhone;
  final bool isCommissionExempt;

  MerchantAppInfo({
    required this.id,
    required this.name,
    required this.slug,
    required this.establishmentId,
    this.logoUrl,
    this.contactEmail,
    this.contactPhone,
    required this.isCommissionExempt,
  });

  factory MerchantAppInfo.fromJson(Map<String, dynamic> json) {
    return MerchantAppInfo(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      establishmentId: json['establishmentId']?.toString() ?? '',
      logoUrl: json['logoUrl']?.toString(),
      contactEmail: json['contactEmail']?.toString(),
      contactPhone: json['contactPhone']?.toString(),
      isCommissionExempt: json['isCommissionExempt'] as bool? ?? false,
    );
  }
}

class MerchantCompanyInfo {
  final String legalName;
  final String tradeName;
  final String cnpj;
  final String email;
  final String phone;
  final String address;
  final String cityState;

  MerchantCompanyInfo({
    required this.legalName,
    required this.tradeName,
    required this.cnpj,
    required this.email,
    required this.phone,
    required this.address,
    required this.cityState,
  });

  factory MerchantCompanyInfo.fromJson(Map<String, dynamic> json) {
    return MerchantCompanyInfo(
      legalName: json['legalName']?.toString() ?? '',
      tradeName: json['tradeName']?.toString() ?? 'CJC Dev Pays',
      cnpj: json['cnpj']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
      cityState: json['cityState']?.toString() ?? '',
    );
  }
}

class MerchantMetrics {
  final double totalGross;
  final double totalMpFee;
  final double totalCjcFee;
  final double totalNetPayout;
  final double totalRefunded;
  final int approvedCount;
  final int refundedCount;
  final int totalCount;
  final double ticketMedio;

  MerchantMetrics({
    required this.totalGross,
    required this.totalMpFee,
    required this.totalCjcFee,
    required this.totalNetPayout,
    required this.totalRefunded,
    required this.approvedCount,
    required this.refundedCount,
    required this.totalCount,
    required this.ticketMedio,
  });

  factory MerchantMetrics.fromJson(Map<String, dynamic> json) {
    return MerchantMetrics(
      totalGross: (json['totalGross'] as num?)?.toDouble() ?? 0.0,
      totalMpFee: (json['totalMpFee'] as num?)?.toDouble() ?? 0.0,
      totalCjcFee: (json['totalCjcFee'] as num?)?.toDouble() ?? 0.0,
      totalNetPayout: (json['totalNetPayout'] as num?)?.toDouble() ?? 0.0,
      totalRefunded: (json['totalRefunded'] as num?)?.toDouble() ?? 0.0,
      approvedCount: (json['approvedCount'] as num?)?.toInt() ?? 0,
      refundedCount: (json['refundedCount'] as num?)?.toInt() ?? 0,
      totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      ticketMedio: (json['ticketMedio'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class MerchantMethodItem {
  final String method;
  final String label;
  final int count;
  final double gross;
  final double mpFee;
  final double cjcCommission;
  final double netPayout;

  MerchantMethodItem({
    required this.method,
    required this.label,
    required this.count,
    required this.gross,
    required this.mpFee,
    required this.cjcCommission,
    required this.netPayout,
  });

  factory MerchantMethodItem.fromJson(Map<String, dynamic> json) {
    return MerchantMethodItem(
      method: json['method']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      gross: (json['gross'] as num?)?.toDouble() ?? 0.0,
      mpFee: (json['mpFee'] as num?)?.toDouble() ?? 0.0,
      cjcCommission: (json['cjcCommission'] as num?)?.toDouble() ?? 0.0,
      netPayout: (json['netPayout'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class MerchantTxItem {
  final String id;
  final DateTime createdAt;
  final String externalReference;
  final String paymentMethod;
  final String status;
  final double amount;
  final double mpFee;
  final double cjcCommission;
  final double netPayout;
  final String? payerName;
  final String? payerEmail;

  MerchantTxItem({
    required this.id,
    required this.createdAt,
    required this.externalReference,
    required this.paymentMethod,
    required this.status,
    required this.amount,
    required this.mpFee,
    required this.cjcCommission,
    required this.netPayout,
    this.payerName,
    this.payerEmail,
  });

  factory MerchantTxItem.fromJson(Map<String, dynamic> json) {
    return MerchantTxItem(
      id: json['id']?.toString() ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      externalReference: json['externalReference']?.toString() ?? '',
      paymentMethod: json['paymentMethod']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      mpFee: (json['mpFee'] as num?)?.toDouble() ?? 0.0,
      cjcCommission: (json['cjcCommission'] as num?)?.toDouble() ?? 0.0,
      netPayout: (json['netPayout'] as num?)?.toDouble() ?? 0.0,
      payerName: json['payerName']?.toString(),
      payerEmail: json['payerEmail']?.toString(),
    );
  }
}
