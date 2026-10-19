class FeeSettingsModel {
  final double mpPixFeePercent;
  final double mpCreditFeePercent;
  final double mpDebitFeePercent;
  final double commissionPixPercent;
  final double commissionCreditPercent;
  final double commissionDebitPercent;
  final DateTime? updatedAt;

  FeeSettingsModel({
    required this.mpPixFeePercent,
    required this.mpCreditFeePercent,
    required this.mpDebitFeePercent,
    required this.commissionPixPercent,
    required this.commissionCreditPercent,
    required this.commissionDebitPercent,
    this.updatedAt,
  });

  factory FeeSettingsModel.fromJson(Map<String, dynamic> json) {
    return FeeSettingsModel(
      mpPixFeePercent: (json['mpPixFeePercent'] as num?)?.toDouble() ?? 0.99,
      mpCreditFeePercent: (json['mpCreditFeePercent'] as num?)?.toDouble() ?? 4.99,
      mpDebitFeePercent: (json['mpDebitFeePercent'] as num?)?.toDouble() ?? 1.99,
      commissionPixPercent: (json['commissionPixPercent'] as num?)?.toDouble() ?? 1.00,
      commissionCreditPercent: (json['commissionCreditPercent'] as num?)?.toDouble() ?? 2.00,
      commissionDebitPercent: (json['commissionDebitPercent'] as num?)?.toDouble() ?? 1.50,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'mpPixFeePercent': mpPixFeePercent,
      'mpCreditFeePercent': mpCreditFeePercent,
      'mpDebitFeePercent': mpDebitFeePercent,
      'commissionPixPercent': commissionPixPercent,
      'commissionCreditPercent': commissionCreditPercent,
      'commissionDebitPercent': commissionDebitPercent,
    };
  }

  FeeSettingsModel copyWith({
    double? mpPixFeePercent,
    double? mpCreditFeePercent,
    double? mpDebitFeePercent,
    double? commissionPixPercent,
    double? commissionCreditPercent,
    double? commissionDebitPercent,
  }) {
    return FeeSettingsModel(
      mpPixFeePercent: mpPixFeePercent ?? this.mpPixFeePercent,
      mpCreditFeePercent: mpCreditFeePercent ?? this.mpCreditFeePercent,
      mpDebitFeePercent: mpDebitFeePercent ?? this.mpDebitFeePercent,
      commissionPixPercent: commissionPixPercent ?? this.commissionPixPercent,
      commissionCreditPercent: commissionCreditPercent ?? this.commissionCreditPercent,
      commissionDebitPercent: commissionDebitPercent ?? this.commissionDebitPercent,
      updatedAt: updatedAt,
    );
  }
}
