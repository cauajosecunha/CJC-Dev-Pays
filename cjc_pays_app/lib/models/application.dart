class ApplicationModel {
  final String id;
  final String name;
  final String slug;
  final String apiKey;
  final String? webhookUrl;
  final String webhookSecret;
  final bool isActive;
  final DateTime createdAt;
  final int totalPayments;
  final int totalDeliveries;

  ApplicationModel({
    required this.id,
    required this.name,
    required this.slug,
    required this.apiKey,
    this.webhookUrl,
    required this.webhookSecret,
    required this.isActive,
    required this.createdAt,
    required this.totalPayments,
    required this.totalDeliveries,
  });

  factory ApplicationModel.fromJson(Map<String, dynamic> json) {
    final count = json['_count'] as Map<String, dynamic>? ?? {};
    return ApplicationModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      apiKey: json['apiKey']?.toString() ?? '',
      webhookUrl: json['webhookUrl']?.toString(),
      webhookSecret: json['webhookSecret']?.toString() ?? '',
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      totalPayments: (count['payments'] as num?)?.toInt() ?? 0,
      totalDeliveries: (count['deliveries'] as num?)?.toInt() ?? 0,
    );
  }
}
