class FinancialReportModel {
  final String periodLabel;
  final String startDate;
  final String endDate;
  final String generatedAt;
  final String filterAppId;
  final String filterMethod;
  final FinancialKpisModel kpis;
  final DreModel dre;
  final List<AppFinancialModel> byApplication;
  final List<MethodFinancialModel> byMethod;
  final List<FinancialTransactionModel> transactions;

  FinancialReportModel({
    required this.periodLabel,
    required this.startDate,
    required this.endDate,
    required this.generatedAt,
    required this.filterAppId,
    required this.filterMethod,
    required this.kpis,
    required this.dre,
    required this.byApplication,
    required this.byMethod,
    required this.transactions,
  });

  factory FinancialReportModel.fromJson(Map<String, dynamic> json) {
    return FinancialReportModel(
      periodLabel: json['periodLabel'] as String? ?? '',
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
      generatedAt: json['generatedAt'] as String? ?? '',
      filterAppId: json['filterAppId'] as String? ?? 'ALL',
      filterMethod: json['filterMethod'] as String? ?? 'ALL',
      kpis: FinancialKpisModel.fromJson(json['kpis'] as Map<String, dynamic>? ?? {}),
      dre: DreModel.fromJson(json['dre'] as Map<String, dynamic>? ?? {}),
      byApplication: (json['byApplication'] as List<dynamic>? ?? [])
          .map((item) => AppFinancialModel.fromJson(item as Map<String, dynamic>))
          .toList(),
      byMethod: (json['byMethod'] as List<dynamic>? ?? [])
          .map((item) => MethodFinancialModel.fromJson(item as Map<String, dynamic>))
          .toList(),
      transactions: (json['transactions'] as List<dynamic>? ?? [])
          .map((item) => FinancialTransactionModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class FinancialKpisModel {
  final double totalGrossVolume;
  final double totalMpFees;
  final double totalCjcCommission;
  final double totalNetPayout;
  final double totalRefunded;
  final int totalCount;
  final int approvedCount;
  final int refundedCount;
  final double ticketMedio;
  final double averageRetentionPercent;

  FinancialKpisModel({
    required this.totalGrossVolume,
    required this.totalMpFees,
    required this.totalCjcCommission,
    required this.totalNetPayout,
    required this.totalRefunded,
    required this.totalCount,
    required this.approvedCount,
    required this.refundedCount,
    required this.ticketMedio,
    required this.averageRetentionPercent,
  });

  factory FinancialKpisModel.fromJson(Map<String, dynamic> json) {
    return FinancialKpisModel(
      totalGrossVolume: (json['totalGrossVolume'] as num?)?.toDouble() ?? 0.0,
      totalMpFees: (json['totalMpFees'] as num?)?.toDouble() ?? 0.0,
      totalCjcCommission: (json['totalCjcCommission'] as num?)?.toDouble() ?? 0.0,
      totalNetPayout: (json['totalNetPayout'] as num?)?.toDouble() ?? 0.0,
      totalRefunded: (json['totalRefunded'] as num?)?.toDouble() ?? 0.0,
      totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      approvedCount: (json['approvedCount'] as num?)?.toInt() ?? 0,
      refundedCount: (json['refundedCount'] as num?)?.toInt() ?? 0,
      ticketMedio: (json['ticketMedio'] as num?)?.toDouble() ?? 0.0,
      averageRetentionPercent: (json['averageRetentionPercent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class DreModel {
  final double receitaBrutaTotal;
  final double custoMercadoPago;
  final double margemBruta;
  final double repassesLojas;
  final double lucroLiquidoCJC;
  final double estornosRealizados;
  final double resultadoOperacionalFinal;

  DreModel({
    required this.receitaBrutaTotal,
    required this.custoMercadoPago,
    required this.margemBruta,
    required this.repassesLojas,
    required this.lucroLiquidoCJC,
    required this.estornosRealizados,
    required this.resultadoOperacionalFinal,
  });

  factory DreModel.fromJson(Map<String, dynamic> json) {
    return DreModel(
      receitaBrutaTotal: (json['receitaBrutaTotal'] as num?)?.toDouble() ?? 0.0,
      custoMercadoPago: (json['custoMercadoPago'] as num?)?.toDouble() ?? 0.0,
      margemBruta: (json['margemBruta'] as num?)?.toDouble() ?? 0.0,
      repassesLojas: (json['repassesLojas'] as num?)?.toDouble() ?? 0.0,
      lucroLiquidoCJC: (json['lucroLiquidoCJC'] as num?)?.toDouble() ?? 0.0,
      estornosRealizados: (json['estornosRealizados'] as num?)?.toDouble() ?? 0.0,
      resultadoOperacionalFinal: (json['resultadoOperacionalFinal'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class AppFinancialModel {
  final String applicationId;
  final String name;
  final String slug;
  final String establishmentId;
  final bool isCommissionExempt;
  final int totalTransactions;
  final int approvedTransactions;
  final double grossVolume;
  final double mpFeeVolume;
  final double commissionVolume;
  final double netPayoutVolume;
  final double refundedVolume;
  final double sharePercent;

  AppFinancialModel({
    required this.applicationId,
    required this.name,
    required this.slug,
    required this.establishmentId,
    required this.isCommissionExempt,
    required this.totalTransactions,
    required this.approvedTransactions,
    required this.grossVolume,
    required this.mpFeeVolume,
    required this.commissionVolume,
    required this.netPayoutVolume,
    required this.refundedVolume,
    required this.sharePercent,
  });

  factory AppFinancialModel.fromJson(Map<String, dynamic> json) {
    return AppFinancialModel(
      applicationId: json['applicationId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      establishmentId: json['establishmentId'] as String? ?? '',
      isCommissionExempt: json['isCommissionExempt'] as bool? ?? false,
      totalTransactions: (json['totalTransactions'] as num?)?.toInt() ?? 0,
      approvedTransactions: (json['approvedTransactions'] as num?)?.toInt() ?? 0,
      grossVolume: (json['grossVolume'] as num?)?.toDouble() ?? 0.0,
      mpFeeVolume: (json['mpFeeVolume'] as num?)?.toDouble() ?? 0.0,
      commissionVolume: (json['commissionVolume'] as num?)?.toDouble() ?? 0.0,
      netPayoutVolume: (json['netPayoutVolume'] as num?)?.toDouble() ?? 0.0,
      refundedVolume: (json['refundedVolume'] as num?)?.toDouble() ?? 0.0,
      sharePercent: (json['sharePercent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class MethodFinancialModel {
  final String method;
  final String label;
  final int count;
  final double grossVolume;
  final double mpFeeVolume;
  final double commissionVolume;
  final double netPayoutVolume;
  final double sharePercent;

  MethodFinancialModel({
    required this.method,
    required this.label,
    required this.count,
    required this.grossVolume,
    required this.mpFeeVolume,
    required this.commissionVolume,
    required this.netPayoutVolume,
    required this.sharePercent,
  });

  factory MethodFinancialModel.fromJson(Map<String, dynamic> json) {
    return MethodFinancialModel(
      method: json['method'] as String? ?? '',
      label: json['label'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
      grossVolume: (json['grossVolume'] as num?)?.toDouble() ?? 0.0,
      mpFeeVolume: (json['mpFeeVolume'] as num?)?.toDouble() ?? 0.0,
      commissionVolume: (json['commissionVolume'] as num?)?.toDouble() ?? 0.0,
      netPayoutVolume: (json['netPayoutVolume'] as num?)?.toDouble() ?? 0.0,
      sharePercent: (json['sharePercent'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class FinancialTransactionModel {
  final String id;
  final DateTime? createdAt;
  final String externalReference;
  final String applicationName;
  final String paymentMethod;
  final String status;
  final double amount;
  final double mpFee;
  final double cjcCommission;
  final double netPayout;
  final String? payerName;
  final String? payerEmail;

  FinancialTransactionModel({
    required this.id,
    this.createdAt,
    required this.externalReference,
    required this.applicationName,
    required this.paymentMethod,
    required this.status,
    required this.amount,
    required this.mpFee,
    required this.cjcCommission,
    required this.netPayout,
    this.payerName,
    this.payerEmail,
  });

  factory FinancialTransactionModel.fromJson(Map<String, dynamic> json) {
    return FinancialTransactionModel(
      id: json['id'] as String? ?? '',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      externalReference: json['externalReference'] as String? ?? '',
      applicationName: json['applicationName'] as String? ?? '',
      paymentMethod: json['paymentMethod'] as String? ?? '',
      status: json['status'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      mpFee: (json['mpFee'] as num?)?.toDouble() ?? 0.0,
      cjcCommission: (json['cjcCommission'] as num?)?.toDouble() ?? 0.0,
      netPayout: (json['netPayout'] as num?)?.toDouble() ?? 0.0,
      payerName: json['payerName'] as String?,
      payerEmail: json['payerEmail'] as String?,
    );
  }
}
