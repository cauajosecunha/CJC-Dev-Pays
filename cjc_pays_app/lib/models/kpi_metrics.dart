class DashboardMetrics {
  final int? selectedMonth;
  final int selectedYear;
  final bool isCurrentMonth;
  final KpiData kpis;
  final WebhookHealthData webhooks;
  final List<AppVolumeData> applications;

  DashboardMetrics({
    this.selectedMonth,
    required this.selectedYear,
    required this.isCurrentMonth,
    required this.kpis,
    required this.webhooks,
    required this.applications,
  });

  factory DashboardMetrics.fromJson(Map<String, dynamic> json) {
    return DashboardMetrics(
      selectedMonth: json['selectedMonth'] as int?,
      selectedYear: json['selectedYear'] as int? ?? DateTime.now().year,
      isCurrentMonth: json['isCurrentMonth'] as bool? ?? true,
      kpis: KpiData.fromJson(json['kpis'] as Map<String, dynamic>? ?? {}),
      webhooks: WebhookHealthData.fromJson(json['webhooks'] as Map<String, dynamic>? ?? {}),
      applications: (json['applications'] as List<dynamic>? ?? [])
          .map((item) => AppVolumeData.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class KpiData {
  final double totalVolume;
  final double netVolume;
  final double totalFees;
  final double todayVolume;
  final double monthVolume;
  final int totalCount;
  final int approvedCount;
  final int pendingCount;
  final int rejectedCount;
  final double approvalRate;

  KpiData({
    required this.totalVolume,
    required this.netVolume,
    required this.totalFees,
    required this.todayVolume,
    required this.monthVolume,
    required this.totalCount,
    required this.approvedCount,
    required this.pendingCount,
    required this.rejectedCount,
    required this.approvalRate,
  });

  factory KpiData.fromJson(Map<String, dynamic> json) {
    return KpiData(
      totalVolume: (json['totalVolume'] as num?)?.toDouble() ?? 0.0,
      netVolume: (json['netVolume'] as num?)?.toDouble() ?? 0.0,
      totalFees: (json['totalFees'] as num?)?.toDouble() ?? 0.0,
      todayVolume: (json['todayVolume'] as num?)?.toDouble() ?? 0.0,
      monthVolume: (json['monthVolume'] as num?)?.toDouble() ?? 0.0,
      totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
      approvedCount: (json['approvedCount'] as num?)?.toInt() ?? 0,
      pendingCount: (json['pendingCount'] as num?)?.toInt() ?? 0,
      rejectedCount: (json['rejectedCount'] as num?)?.toInt() ?? 0,
      approvalRate: (json['approvalRate'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class WebhookHealthData {
  final int total;
  final int success;
  final int failed;
  final double healthPct;

  WebhookHealthData({
    required this.total,
    required this.success,
    required this.failed,
    required this.healthPct,
  });

  factory WebhookHealthData.fromJson(Map<String, dynamic> json) {
    return WebhookHealthData(
      total: (json['total'] as num?)?.toInt() ?? 0,
      success: (json['success'] as num?)?.toInt() ?? 0,
      failed: (json['failed'] as num?)?.toInt() ?? 0,
      healthPct: (json['healthPct'] as num?)?.toDouble() ?? 100.0,
    );
  }
}

class AppVolumeData {
  final String id;
  final String name;
  final String slug;
  final bool isActive;
  final int totalPayments;
  final double approvedVolume;
  final int approvedCount;

  AppVolumeData({
    required this.id,
    required this.name,
    required this.slug,
    required this.isActive,
    required this.totalPayments,
    required this.approvedVolume,
    required this.approvedCount,
  });

  factory AppVolumeData.fromJson(Map<String, dynamic> json) {
    return AppVolumeData(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      isActive: json['isActive'] as bool? ?? true,
      totalPayments: (json['totalPayments'] as num?)?.toInt() ?? 0,
      approvedVolume: (json['approvedVolume'] as num?)?.toDouble() ?? 0.0,
      approvedCount: (json['approvedCount'] as num?)?.toInt() ?? 0,
    );
  }
}
