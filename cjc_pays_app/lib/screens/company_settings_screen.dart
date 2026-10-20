import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../models/company_settings.dart';
import '../services/api_service.dart';

class CompanySettingsScreen extends StatefulWidget {
  const CompanySettingsScreen({super.key});

  @override
  State<CompanySettingsScreen> createState() => _CompanySettingsScreenState();
}

class _CompanySettingsScreenState extends State<CompanySettingsScreen> {
  final _api = ApiService();
  final _formKey = GlobalKey<FormState>();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  final _legalNameCtrl = TextEditingController();
  final _tradeNameCtrl = TextEditingController();
  final _cnpjCtrl = TextEditingController();
  final _stateTaxIdCtrl = TextEditingController();
  final _municipalTaxIdCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _cityStateCtrl = TextEditingController();
  final _zipCodeCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _legalNameCtrl.dispose();
    _tradeNameCtrl.dispose();
    _cnpjCtrl.dispose();
    _stateTaxIdCtrl.dispose();
    _municipalTaxIdCtrl.dispose();
    _addressCtrl.dispose();
    _cityStateCtrl.dispose();
    _zipCodeCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final s = await _api.getCompanySettings();
      if (!mounted) return;
      setState(() {
        _legalNameCtrl.text = s.companyLegalName;
        _tradeNameCtrl.text = s.companyTradeName;
        _cnpjCtrl.text = s.companyCnpj;
        _stateTaxIdCtrl.text = s.companyStateTaxId;
        _municipalTaxIdCtrl.text = s.companyMunicipalTaxId;
        _addressCtrl.text = s.companyAddress;
        _cityStateCtrl.text = s.companyCityState;
        _zipCodeCtrl.text = s.companyZipCode;
        _emailCtrl.text = s.companyEmail;
        _phoneCtrl.text = s.companyPhone;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _saveSettings() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final updated = CompanySettingsModel(
        companyLegalName: _legalNameCtrl.text.trim(),
        companyTradeName: _tradeNameCtrl.text.trim(),
        companyCnpj: _cnpjCtrl.text.trim(),
        companyStateTaxId: _stateTaxIdCtrl.text.trim(),
        companyMunicipalTaxId: _municipalTaxIdCtrl.text.trim(),
        companyAddress: _addressCtrl.text.trim(),
        companyCityState: _cityStateCtrl.text.trim(),
        companyZipCode: _zipCodeCtrl.text.trim(),
        companyEmail: _emailCtrl.text.trim(),
        companyPhone: _phoneCtrl.text.trim(),
      );

      await _api.updateCompanySettings(updated);

      if (!mounted) return;
      setState(() => _isSaving = false);
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Dados fiscais da empresa atualizados com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      messenger.showSnackBar(
        SnackBar(
          content: Text('Falha ao salvar dados fiscais: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dados Fiscais & Empresa'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _isLoading || _isSaving ? null : _loadSettings,
            tooltip: 'Recarregar',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.danger),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadSettings, child: const Text('Tentar Novamente')),
                      ],
                    ),
                  ),
                )
              : Form(
                  key: _formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _buildHeaderBanner(),
                      const SizedBox(height: 16),
                      _buildLegalSection(),
                      const SizedBox(height: 16),
                      _buildAddressSection(),
                      const SizedBox(height: 16),
                      _buildContactSection(),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: const Color(0xFF0F172A),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: _isSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)),
                              )
                            : const Icon(Icons.save_rounded, size: 20),
                        label: Text(
                          _isSaving ? 'Salvando Alterações...' : 'Salvar Dados Fiscais',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        onPressed: _isSaving ? null : _saveSettings,
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
    );
  }

  Widget _buildHeaderBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withAlpha(50)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, color: AppColors.primary, size: 24),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Identificação Oficial da Empresa',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                ),
                SizedBox(height: 4),
                Text(
                  'Estes dados são impressos no cabeçalho dos Relatórios Contábeis em PDF (DRE) e Extratos de Repasse aos Lojistas, além de auditados via QR Code público.',
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegalSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.business_rounded, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Dados Cadastrais & Fiscais', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _legalNameCtrl,
            decoration: const InputDecoration(
              labelText: 'Razão Social',
              hintText: 'Ex: CJC Dev Soluções Tecnológicas Ltda',
            ),
            validator: (v) => v == null || v.trim().isEmpty ? 'Razão social obrigatória' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _tradeNameCtrl,
            decoration: const InputDecoration(
              labelText: 'Nome Fantasia',
              hintText: 'Ex: CJC Dev Pays',
            ),
            validator: (v) => v == null || v.trim().isEmpty ? 'Nome fantasia obrigatório' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _cnpjCtrl,
            decoration: const InputDecoration(
              labelText: 'CNPJ',
              hintText: '00.000.000/0001-00',
            ),
            keyboardType: TextInputType.number,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _stateTaxIdCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Inscrição Estadual (IE)',
                    hintText: 'Isento ou número',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _municipalTaxIdCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Inscrição Municipal (IM)',
                    hintText: 'Isento ou número',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAddressSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.location_on_outlined, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Endereço & Localização', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _addressCtrl,
            decoration: const InputDecoration(
              labelText: 'Endereço Comercial',
              hintText: 'Av. Exemplo, 1000 - Sala 10',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: _cityStateCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Cidade / UF',
                    hintText: 'São Paulo - SP',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 1,
                child: TextFormField(
                  controller: _zipCodeCtrl,
                  decoration: const InputDecoration(
                    labelText: 'CEP',
                    hintText: '00000-000',
                  ),
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContactSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.contact_mail_outlined, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Contato Corporativo & Financeiro', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 14),
          TextFormField(
            controller: _emailCtrl,
            decoration: const InputDecoration(
              labelText: 'E-mail Financeiro Oficial',
              hintText: 'financeiro@cjcdev.com.br',
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _phoneCtrl,
            decoration: const InputDecoration(
              labelText: 'Telefone / WhatsApp Comercial',
              hintText: '+55 (11) 99999-9999',
            ),
            keyboardType: TextInputType.phone,
          ),
        ],
      ),
    );
  }
}
