class CompanySettingsModel {
  final String companyLegalName;
  final String companyTradeName;
  final String companyCnpj;
  final String companyStateTaxId;
  final String companyMunicipalTaxId;
  final String companyAddress;
  final String companyCityState;
  final String companyZipCode;
  final String companyEmail;
  final String companyPhone;
  final DateTime? updatedAt;

  CompanySettingsModel({
    required this.companyLegalName,
    required this.companyTradeName,
    required this.companyCnpj,
    required this.companyStateTaxId,
    required this.companyMunicipalTaxId,
    required this.companyAddress,
    required this.companyCityState,
    required this.companyZipCode,
    required this.companyEmail,
    required this.companyPhone,
    this.updatedAt,
  });

  factory CompanySettingsModel.fromJson(Map<String, dynamic> json) {
    return CompanySettingsModel(
      companyLegalName: json['companyLegalName']?.toString() ?? '',
      companyTradeName: json['companyTradeName']?.toString() ?? '',
      companyCnpj: json['companyCnpj']?.toString() ?? '',
      companyStateTaxId: json['companyStateTaxId']?.toString() ?? '',
      companyMunicipalTaxId: json['companyMunicipalTaxId']?.toString() ?? '',
      companyAddress: json['companyAddress']?.toString() ?? '',
      companyCityState: json['companyCityState']?.toString() ?? '',
      companyZipCode: json['companyZipCode']?.toString() ?? '',
      companyEmail: json['companyEmail']?.toString() ?? '',
      companyPhone: json['companyPhone']?.toString() ?? '',
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'companyLegalName': companyLegalName,
      'companyTradeName': companyTradeName,
      'companyCnpj': companyCnpj,
      'companyStateTaxId': companyStateTaxId,
      'companyMunicipalTaxId': companyMunicipalTaxId,
      'companyAddress': companyAddress,
      'companyCityState': companyCityState,
      'companyZipCode': companyZipCode,
      'companyEmail': companyEmail,
      'companyPhone': companyPhone,
    };
  }
}
