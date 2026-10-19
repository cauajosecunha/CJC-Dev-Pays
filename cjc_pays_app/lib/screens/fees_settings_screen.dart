import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../models/fee_settings.dart';
import '../services/api_service.dart';

class FeesSettingsScreen extends StatefulWidget {
  const FeesSettingsScreen({super.key});

  @override
  State<FeesSettingsScreen> createState() => _FeesSettingsScreenState();
}

class _FeesSettingsScreenState extends State<FeesSettingsScreen> {
  final _api = ApiService();

  final _mpPixCtrl = TextEditingController(text: '0.99');
  final _mpCreditCtrl = TextEditingController(text: '4.99');
  final _mpDebitCtrl = TextEditingController(text: '1.99');

  final _commPixCtrl = TextEditingController(text: '1.00');
  final _commCreditCtrl = TextEditingController(text: '2.00');
  final _commDebitCtrl = TextEditingController(text: '1.50');

  final _amountCtrl = TextEditingController(text: '100.00');

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _amountCtrl.addListener(_onFieldChanged);
    _mpPixCtrl.addListener(_onFieldChanged);
    _mpCreditCtrl.addListener(_onFieldChanged);
    _mpDebitCtrl.addListener(_onFieldChanged);
    _commPixCtrl.addListener(_onFieldChanged);
    _commCreditCtrl.addListener(_onFieldChanged);
    _commDebitCtrl.addListener(_onFieldChanged);
  }

  @override
  void dispose() {
    _amountCtrl.removeListener(_onFieldChanged);
    _mpPixCtrl.removeListener(_onFieldChanged);
    _mpCreditCtrl.removeListener(_onFieldChanged);
    _mpDebitCtrl.removeListener(_onFieldChanged);
    _commPixCtrl.removeListener(_onFieldChanged);
    _commCreditCtrl.removeListener(_onFieldChanged);
    _commDebitCtrl.removeListener(_onFieldChanged);

    _mpPixCtrl.dispose();
    _mpCreditCtrl.dispose();
    _mpDebitCtrl.dispose();
    _commPixCtrl.dispose();
    _commCreditCtrl.dispose();
    _commDebitCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  void _onFieldChanged() {
    setState(() {});
  }

  Future<void> _loadSettings() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final s = await _api.getFeeSettings();
      if (!mounted) return;
      _mpPixCtrl.text = s.mpPixFeePercent.toStringAsFixed(2);
      _mpCreditCtrl.text = s.mpCreditFeePercent.toStringAsFixed(2);
      _mpDebitCtrl.text = s.mpDebitFeePercent.toStringAsFixed(2);
      _commPixCtrl.text = s.commissionPixPercent.toStringAsFixed(2);
      _commCreditCtrl.text = s.commissionCreditPercent.toStringAsFixed(2);
      _commDebitCtrl.text = s.commissionDebitPercent.toStringAsFixed(2);

      setState(() {
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
    final mpPix = double.tryParse(_mpPixCtrl.text.replaceAll(',', '.'));
    final mpCredit = double.tryParse(_mpCreditCtrl.text.replaceAll(',', '.'));
    final mpDebit = double.tryParse(_mpDebitCtrl.text.replaceAll(',', '.'));
    final commPix = double.tryParse(_commPixCtrl.text.replaceAll(',', '.'));
    final commCredit = double.tryParse(_commCreditCtrl.text.replaceAll(',', '.'));
    final commDebit = double.tryParse(_commDebitCtrl.text.replaceAll(',', '.'));

    if (mpPix == null || mpCredit == null || mpDebit == null ||
        commPix == null || commCredit == null || commDebit == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Por favor, preencha todos os campos com percentuais válidos.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    final messenger = ScaffoldMessenger.of(context);

    try {
      final updated = FeeSettingsModel(
        mpPixFeePercent: mpPix,
        mpCreditFeePercent: mpCredit,
        mpDebitFeePercent: mpDebit,
        commissionPixPercent: commPix,
        commissionCreditPercent: commCredit,
        commissionDebitPercent: commDebit,
      );

      await _api.updateFeeSettings(updated);

      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text('✅ Taxas e comissões atualizadas com sucesso!'),
          backgroundColor: AppColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text('Falha ao salvar taxas: $e'),
          backgroundColor: AppColors.danger,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Taxas & Comissões'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Recarregar',
            onPressed: _isLoading ? null : _loadSettings,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 48),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, style: const TextStyle(color: AppColors.textSecondary), textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _loadSettings,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Subtítulo descritivo
                      const Text(
                        'Configure os custos de intermediação do Mercado Pago e a margem de comissão da plataforma CJC Dev Pays.',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
                      ),
                      const SizedBox(height: 16),

                      // Card 1: Custos Mercado Pago
                      _buildSectionCard(
                        title: 'Taxas do Mercado Pago (Custos)',
                        subtitle: 'Percentual retido pela adquirente em cada método',
                        icon: Icons.account_balance_rounded,
                        iconColor: AppColors.primary,
                        children: [
                          _buildPercentField(
                            label: 'Taxa Pix (%)',
                            hint: 'Aprox. 0.99% no MP',
                            controller: _mpPixCtrl,
                          ),
                          const SizedBox(height: 12),
                          _buildPercentField(
                            label: 'Taxa Cartão de Crédito à Vista (%)',
                            hint: 'Intermediação imediata (~4.99%)',
                            controller: _mpCreditCtrl,
                          ),
                          const SizedBox(height: 12),
                          _buildPercentField(
                            label: 'Taxa Cartão de Débito (%)',
                            hint: 'Taxa de débito (~1.99%)',
                            controller: _mpDebitCtrl,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Card 2: Margem CJC Dev Pays
                      _buildSectionCard(
                        title: 'Comissão CJC Dev Pays (Lucro)',
                        subtitle: 'Spread retido pela plataforma sobre as transações',
                        icon: Icons.monetization_on_rounded,
                        iconColor: AppColors.success,
                        children: [
                          _buildPercentField(
                            label: 'Comissão sobre Pix (%)',
                            hint: 'Lucro retido em Pix (ex: 1.00%)',
                            controller: _commPixCtrl,
                          ),
                          const SizedBox(height: 12),
                          _buildPercentField(
                            label: 'Comissão sobre Cartão de Crédito (%)',
                            hint: 'Lucro retido em Crédito (ex: 2.00%)',
                            controller: _commCreditCtrl,
                          ),
                          const SizedBox(height: 12),
                          _buildPercentField(
                            label: 'Comissão sobre Cartão de Débito (%)',
                            hint: 'Lucro retido em Débito (ex: 1.50%)',
                            controller: _commDebitCtrl,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Card 3: Simulador em Tempo Real
                      _buildSimulationSection(),

                      const SizedBox(height: 24),

                      // Botão Salvar
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _isSaving ? null : _saveSettings,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                              )
                            : const Icon(Icons.save_rounded),
                        label: Text(
                          _isSaving ? 'Salvando Configurações...' : 'Salvar Taxas & Comissões',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ),
                      const SizedBox(height: 30),
                    ],
                  ),
                ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),
          ...children,
        ],
      ),
    );
  }

  Widget _buildPercentField({
    required String label,
    required String hint,
    required TextEditingController controller,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              hint,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
            ),
          ],
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            isDense: true,
            suffixText: '%',
            suffixStyle: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
            filled: true,
            fillColor: AppColors.surfaceAlt,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.primary),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSimulationSection() {
    final amount = double.tryParse(_amountCtrl.text.replaceAll(',', '.')) ?? 100.0;
    final mpPix = double.tryParse(_mpPixCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final mpCredit = double.tryParse(_mpCreditCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final mpDebit = double.tryParse(_mpDebitCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final commPix = double.tryParse(_commPixCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final commCredit = double.tryParse(_commCreditCtrl.text.replaceAll(',', '.')) ?? 0.0;
    final commDebit = double.tryParse(_commDebitCtrl.text.replaceAll(',', '.')) ?? 0.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.calculate_rounded, color: AppColors.warning, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Simulação ao Vivo',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              SizedBox(
                width: 120,
                child: TextField(
                  controller: _amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    isDense: true,
                    prefixText: 'R\$ ',
                    prefixStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    filled: true,
                    fillColor: AppColors.surfaceAlt,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Divisão de valores para uma cobrança:',
            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
          const Divider(height: 20),

          // Métodos: Pix, Crédito, Débito
          _buildMethodSimulation(
            name: 'Pix Instantâneo',
            icon: Icons.qr_code_2_rounded,
            color: AppColors.primary,
            amount: amount,
            mpPercent: mpPix,
            commPercent: commPix,
          ),
          const SizedBox(height: 12),
          _buildMethodSimulation(
            name: 'Cartão de Crédito',
            icon: Icons.credit_card_rounded,
            color: AppColors.secondary,
            amount: amount,
            mpPercent: mpCredit,
            commPercent: commCredit,
          ),
          const SizedBox(height: 12),
          _buildMethodSimulation(
            name: 'Cartão de Débito',
            icon: Icons.payment_rounded,
            color: AppColors.warning,
            amount: amount,
            mpPercent: mpDebit,
            commPercent: commDebit,
          ),
        ],
      ),
    );
  }

  Widget _buildMethodSimulation({
    required String name,
    required IconData icon,
    required Color color,
    required double amount,
    required double mpPercent,
    required double commPercent,
  }) {
    // Cenário Padrão
    final mpAmount = (amount * mpPercent) / 100;
    final commAmount = (amount * commPercent) / 100;
    final totalFee = mpAmount + commAmount;
    final netAmount = (amount - totalFee) > 0 ? (amount - totalFee) : 0.0;

    // Cenário Isento
    final netExempt = (amount - mpAmount) > 0 ? (amount - mpAmount) : 0.0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 6),
              Text(
                name,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Cenário Padrão
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Padrão:', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
              Text(
                'Custo MP: R\$ ${mpAmount.toStringAsFixed(2)} (${mpPercent.toStringAsFixed(1)}%) • Lucro CJC: R\$ ${commAmount.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Retido: ${(mpPercent + commPercent).toStringAsFixed(2)}% (R\$ ${totalFee.toStringAsFixed(2)})',
                style: const TextStyle(color: AppColors.warning, fontSize: 11, fontWeight: FontWeight.w600),
              ),
              Text(
                'Repasse Loja: R\$ ${netAmount.toStringAsFixed(2)}',
                style: const TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),

          // Cenário Isento
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.successBg.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.shield_outlined, size: 12, color: AppColors.success),
                    SizedBox(width: 4),
                    Text(
                      'Loja Isenta (0% CJC):',
                      style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Text(
                  'Repasse: R\$ ${netExempt.toStringAsFixed(2)}',
                  style: const TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
