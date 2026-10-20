import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/app_colors.dart';
import '../models/application.dart';
import '../models/merchant_settlement_report.dart';
import '../services/api_service.dart';
import '../services/file_download_service.dart';
import '../services/pdf_generator_service.dart';
import '../widgets/app_logo_image.dart';
import '../widgets/logo_upload_field.dart';

class ApplicationDetailScreen extends StatefulWidget {
  final ApplicationModel application;

  const ApplicationDetailScreen({
    super.key,
    required this.application,
  });

  @override
  State<ApplicationDetailScreen> createState() => _ApplicationDetailScreenState();
}

class _ApplicationDetailScreenState extends State<ApplicationDetailScreen> {
  final _apiService = ApiService();
  final _currencyFormat = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$ ');
  final _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  late ApplicationModel _app;
  bool _isLoadingApp = false;
  bool _obscureKey = true;

  // Extrato do Lojista
  int _selectedMonth = DateTime.now().month;
  int _selectedYear = DateTime.now().year;
  bool _isLoadingReport = false;
  MerchantSettlementReportModel? _report;
  String? _reportError;

  final _monthNames = const [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  @override
  void initState() {
    super.initState();
    _app = widget.application;
    _refreshApp();
    _loadMerchantReport();
  }

  Future<void> _refreshApp() async {
    setState(() => _isLoadingApp = true);
    try {
      final updated = await _apiService.getApplication(_app.id);
      if (mounted) {
        setState(() {
          _app = updated;
          _isLoadingApp = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingApp = false);
    }
  }

  Future<void> _loadMerchantReport() async {
    setState(() {
      _isLoadingReport = true;
      _reportError = null;
    });

    try {
      final report = await _apiService.getMerchantSettlementReport(
        _app.id,
        month: _selectedMonth,
        year: _selectedYear,
      );
      if (mounted) {
        setState(() {
          _report = report;
          _isLoadingReport = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _reportError = e.toString();
          _isLoadingReport = false;
        });
      }
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado com sucesso!'),
        backgroundColor: AppColors.surfaceAlt,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _regenerateKey() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Regenerar Chave de API?'),
        content: const Text(
          'Atenção: A chave atual será invalidada imediatamente. As integrações que utilizam esta chave deixarão de funcionar até serem atualizadas.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Regenerar Agora', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _apiService.regenerateApiKey(_app.id);
      await _refreshApp();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Nova Chave de API gerada com sucesso!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _pingWebhook() async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Disparando ping de webhook...'), duration: Duration(seconds: 1)),
      );
      final res = await _apiService.pingApplication(_app.id);
      if (mounted) {
        final status = res['status'] ?? 'OK';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ping enviado com sucesso! Status: $status'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro no ping: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _clearTransactions() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Limpar Transações de Teste?'),
        content: Text(
          'Esta ação removerá permanentemente todos os pagamentos e registros de entrega de webhook vinculados à aplicação "${_app.name}".',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Limpar Transações', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final msg = await _apiService.clearApplicationTransactions(_app.id);
      await _refreshApp();
      await _loadMerchantReport();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _deleteApp() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: Text('Excluir "${_app.name}"?'),
        content: const Text(
          'Todas as chaves, webhooks e histórico desta aplicação serão permanentemente apagados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir Definitivamente', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _apiService.deleteApplication(_app.id);
      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao excluir: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _launchEmail(String email) async {
    final uri = Uri.parse('mailto:$email');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      }
    } catch (e) {
      debugPrint('Erro ao abrir e-mail: $e');
    }
  }

  Future<void> _launchWhatsApp(String phone) async {
    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55$cleanPhone';
    final uri = Uri.parse('https://wa.me/$fullPhone');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('Erro ao abrir WhatsApp: $e');
    }
  }

  void _showEditAppModal() {
    final nameCtrl = TextEditingController(text: _app.name);
    final logoCtrl = TextEditingController(text: _app.logoUrl ?? '');
    final emailCtrl = TextEditingController(text: _app.contactEmail ?? '');
    final phoneCtrl = TextEditingController(text: _app.contactPhone ?? '');
    final webhookCtrl = TextEditingController(text: _app.webhookUrl ?? '');
    bool isActive = _app.isActive;
    bool isCommissionExempt = _app.isCommissionExempt;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '✏️ Editar ${_app.name}',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Nome da Aplicação'),
                ),
                const SizedBox(height: 14),
                LogoUploadField(controller: logoCtrl),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: emailCtrl,
                        decoration: const InputDecoration(
                          labelText: 'E-mail do Responsável',
                          hintText: 'dono@loja.com',
                        ),
                        keyboardType: TextInputType.emailAddress,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: phoneCtrl,
                        decoration: const InputDecoration(
                          labelText: 'WhatsApp do Responsável',
                          hintText: '(11) 99999-9999',
                        ),
                        keyboardType: TextInputType.phone,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: webhookCtrl,
                  decoration: const InputDecoration(labelText: 'URL de Webhook'),
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: 14),
                SwitchListTile(
                  title: const Text('Aplicação Ativa', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  value: isActive,
                  activeThumbColor: AppColors.primary,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (val) => setModalState(() => isActive = val),
                ),
                const SizedBox(height: 10),
                SwitchListTile(
                  title: const Text('Isenta de Comissão', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Apenas taxas diretas do Mercado Pago serão retidas (0% CJC)', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  value: isCommissionExempt,
                  activeThumbColor: AppColors.success,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (val) => setModalState(() => isCommissionExempt = val),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    try {
                      final updated = await _apiService.updateApplication(
                        id: _app.id,
                        name: nameCtrl.text.trim(),
                        logoUrl: logoCtrl.text.trim(),
                        contactEmail: emailCtrl.text.trim(),
                        contactPhone: phoneCtrl.text.trim(),
                        webhookUrl: webhookCtrl.text.trim(),
                        isActive: isActive,
                        isCommissionExempt: isCommissionExempt,
                      );
                      if (mounted) {
                        setState(() => _app = updated);
                        messenger.showSnackBar(
                          const SnackBar(content: Text('Aplicação atualizada com sucesso!'), backgroundColor: AppColors.success),
                        );
                        _loadMerchantReport();
                      }
                    } catch (e) {
                      if (mounted) {
                        messenger.showSnackBar(
                          SnackBar(content: Text('Falha ao atualizar: $e'), backgroundColor: AppColors.danger),
                        );
                      }
                    }
                  },
                  child: const Text('Salvar Alterações'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _sendWhatsApp() async {
    if (_report == null) return;
    final msg =
        '*EXTRATO DE REPASSE — CJC DEV PAYS*\n'
        '🏪 *Loja:* ${_app.name} (Ref: ${_report!.application.establishmentId})\n'
        '📅 *Período:* ${_report!.periodLabel}\n\n'
        '📈 *Faturamento Bruto:* ${_currencyFormat.format(_report!.metrics.totalGross)}\n'
        '💳 *Dedução Mercado Pago:* - ${_currencyFormat.format(_report!.metrics.totalMpFee)}\n'
        '🏢 *Taxa CJC Dev Pays:* - ${_currencyFormat.format(_report!.metrics.totalCjcFee)}\n'
        '💰 *VALOR LÍQUIDO A REPASSAR:* ${_currencyFormat.format(_report!.metrics.totalNetPayout)}\n\n'
        '✅ *Vendas Aprovadas:* ${_report!.metrics.approvedCount}\n'
        '🎯 *Ticket Médio:* ${_currencyFormat.format(_report!.metrics.ticketMedio)}\n\n'
        'Emitido por CJC Dev Soluções Tecnológicas.';

    // ignore: deprecated_member_use
    await Share.share(msg, subject: 'Extrato de Repasse - ${_app.name}');
  }

  Future<void> _exportCsv() async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Baixando CSV de prestação de contas...'), duration: Duration(seconds: 2)),
      );
      final filename = 'extrato-repasse-${_app.slug}-$_selectedYear-$_selectedMonth.csv';
      final bytes = await _apiService.getMerchantSettlementCsvBytes(
        _app.id,
        month: _selectedMonth,
        year: _selectedYear,
      );

      final file = await FileDownloadService.saveFileToDevice(
        filename: filename,
        bytes: bytes,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Extrato CSV salvo em: ${file.path}'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao baixar CSV: $e'), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text(_app.name),
          backgroundColor: AppColors.surface,
          actions: [
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: _showEditAppModal,
              tooltip: 'Editar Aplicação',
            ),
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () {
                _refreshApp();
                _loadMerchantReport();
              },
              tooltip: 'Atualizar',
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded),
              onSelected: (val) {
                if (val == 'clear') {
                  _clearTransactions();
                } else if (val == 'delete') {
                  _deleteApp();
                }
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(
                  value: 'clear',
                  child: Row(
                    children: [
                      Icon(Icons.cleaning_services_outlined, size: 18, color: AppColors.warning),
                      SizedBox(width: 10),
                      Text('Limpar Testes', style: TextStyle(color: AppColors.warning, fontSize: 13)),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      Icon(Icons.delete_forever_outlined, size: 18, color: AppColors.danger),
                      SizedBox(width: 10),
                      Text('Excluir Aplicação', style: TextStyle(color: AppColors.danger, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ],
          bottom: const TabBar(
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            tabs: [
              Tab(icon: Icon(Icons.receipt_long_rounded, size: 18), text: 'Extrato do Lojista'),
              Tab(icon: Icon(Icons.vpn_key_outlined, size: 18), text: 'Credenciais & API'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Aba 1: Extrato do Lojista
            RefreshIndicator(
              onRefresh: () async {
                await _refreshApp();
                await _loadMerchantReport();
              },
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildAppHeaderCard(),
                    const SizedBox(height: 16),
                    _buildMerchantReportCard(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),

            // Aba 2: Credenciais & Integração
            RefreshIndicator(
              onRefresh: () async {
                await _refreshApp();
              },
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildAppHeaderCard(),
                    const SizedBox(height: 16),
                    _buildCredentialsCard(),
                    const SizedBox(height: 16),
                    _buildActionsFooter(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppHeaderCard() {
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
              // Logo da Aplicação com resolução automática de URL
              AppLogoImage(
                logoUrl: _app.logoUrl,
                size: 58,
                borderRadius: 14,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _app.name,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _app.isActive ? AppColors.successBg.withValues(alpha: 0.5) : AppColors.dangerBg.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: _app.isActive ? AppColors.success : AppColors.danger,
                              width: 0.8,
                            ),
                          ),
                          child: Text(
                            _app.isActive ? 'Ativa' : 'Inativa',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _app.isActive ? AppColors.success : AppColors.danger,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'slug: ${_app.slug}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Text(
                          'Estab: ${_app.slug.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '-')}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                            fontFamily: 'monospace',
                          ),
                        ),
                        if (_app.isCommissionExempt) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.successBg.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.success.withValues(alpha: 0.4)),
                            ),
                            child: const Text(
                              '🛡️ Isenta de Comissão',
                              style: TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if ((_app.contactEmail != null && _app.contactEmail!.isNotEmpty) ||
              (_app.contactPhone != null && _app.contactPhone!.isNotEmpty)) ...[
            const SizedBox(height: 12),
            const Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_app.contactEmail != null && _app.contactEmail!.isNotEmpty)
                  InkWell(
                    onTap: () => _launchEmail(_app.contactEmail!),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.email_outlined, size: 14, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            _app.contactEmail!,
                            style: const TextStyle(fontSize: 11, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_app.contactPhone != null && _app.contactPhone!.isNotEmpty)
                  InkWell(
                    onTap: () => _launchWhatsApp(_app.contactPhone!),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF25D366).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFF25D366).withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.chat_bubble_outline, size: 14, color: Color(0xFF25D366)),
                          const SizedBox(width: 6),
                          Text(
                            _app.contactPhone!,
                            style: const TextStyle(fontSize: 11, color: Color(0xFF25D366), fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCredentialsCard() {
    final envContent =
        'CJC_PAYS_BASE_URL=https://pays.cjcdev.site\n'
        'CJC_PAYS_API_KEY=${_app.apiKey}\n'
        'CJC_PAYS_WEBHOOK_SECRET=${_app.webhookSecret}';

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
              Icon(Icons.vpn_key_outlined, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text(
                'Credenciais & Integração',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Chave de API
          _buildFieldHeader('CHAVE DE API (X-Api-Key)'),
          Row(
            children: [
              Expanded(
                child: Text(
                  _obscureKey ? '•' * 32 : _app.apiKey,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13, color: AppColors.textSecondary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: Icon(_obscureKey ? Icons.visibility : Icons.visibility_off, size: 20),
                onPressed: () => setState(() => _obscureKey = !_obscureKey),
                tooltip: 'Ver/Ocultar',
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 20),
                onPressed: () => _copyToClipboard(_app.apiKey, 'Chave de API'),
                tooltip: 'Copiar',
              ),
              IconButton(
                icon: const Icon(Icons.refresh, size: 20, color: AppColors.warning),
                onPressed: _regenerateKey,
                tooltip: 'Regenerar Chave',
              ),
            ],
          ),
          const Divider(color: AppColors.border, height: 20),

          // Segredo HMAC
          _buildFieldHeader('SEGREDO HMAC (X-CJC-Signature)'),
          Row(
            children: [
              Expanded(
                child: Text(
                  _app.webhookSecret,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppColors.textSecondary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 20),
                onPressed: () => _copyToClipboard(_app.webhookSecret, 'Segredo HMAC'),
                tooltip: 'Copiar',
              ),
            ],
          ),
          const Divider(color: AppColors.border, height: 20),

          // Webhook Endpoint
          _buildFieldHeader('ENDPOINT DE WEBHOOK'),
          Row(
            children: [
              Expanded(
                child: Text(
                  _app.webhookUrl != null && _app.webhookUrl!.isNotEmpty ? _app.webhookUrl! : 'Nenhum webhook configurado',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: _app.webhookUrl != null && _app.webhookUrl!.isNotEmpty ? AppColors.textSecondary : AppColors.textMuted,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_app.webhookUrl != null && _app.webhookUrl!.isNotEmpty)
                IconButton(
                  icon: const Icon(Icons.sensors, size: 20, color: AppColors.primary),
                  onPressed: _pingWebhook,
                  tooltip: 'Testar Ping',
                ),
            ],
          ),
          const Divider(color: AppColors.border, height: 20),

          // Configuração .env
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildFieldHeader('CONFIGURAÇÃO .ENV DA LOJA'),
              TextButton.icon(
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                icon: const Icon(Icons.copy, size: 14),
                label: const Text('Copiar .env', style: TextStyle(fontSize: 12)),
                onPressed: () => _copyToClipboard(envContent, 'Configuração .env'),
              ),
            ],
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              envContent,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AppColors.primary),
            ),
          ),
          const SizedBox(height: 14),

          // Contatos do Responsável
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('RESPONSÁVEL PELA LOJA', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('📧 E-mail:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    Text(
                      _app.contactEmail != null && _app.contactEmail!.isNotEmpty ? _app.contactEmail! : 'Não informado',
                      style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('📱 WhatsApp:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    if (_app.contactPhone != null && _app.contactPhone!.isNotEmpty)
                      InkWell(
                        onTap: _sendWhatsApp,
                        child: Text(
                          _app.contactPhone!,
                          style: const TextStyle(fontSize: 12, color: Color(0xFF25D366), fontWeight: FontWeight.bold),
                        ),
                      )
                    else
                      const Text('Não informado', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMerchantReportCard() {
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.receipt_long, size: 18, color: AppColors.primary),
                  SizedBox(width: 8),
                  Text(
                    'Extrato de Repasse',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                ],
              ),
              // Seletor Mês / Ano
              Row(
                children: [
                  DropdownButton<int>(
                    value: _selectedMonth,
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                    underline: const SizedBox(),
                    items: List.generate(12, (index) {
                      return DropdownMenuItem(
                        value: index + 1,
                        child: Text(_monthNames[index].substring(0, 3)),
                      );
                    }),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedMonth = val);
                        _loadMerchantReport();
                      }
                    },
                  ),
                  const SizedBox(width: 4),
                  DropdownButton<int>(
                    value: _selectedYear,
                    dropdownColor: AppColors.surface,
                    style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                    underline: const SizedBox(),
                    items: const [
                      DropdownMenuItem(value: 2026, child: Text('2026')),
                      DropdownMenuItem(value: 2025, child: Text('2025')),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => _selectedYear = val);
                        _loadMerchantReport();
                      }
                    },
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Prestação de contas transparente exclusiva de ${_app.name}.',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 14),

          if (_isLoadingReport || _isLoadingApp)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24.0),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_reportError != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text('Erro ao carregar extrato: $_reportError', style: const TextStyle(color: AppColors.danger)),
              ),
            )
          else if (_report != null) ...[
            // Grid de 4 KPIs
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    'Faturamento Bruto',
                    _currencyFormat.format(_report!.metrics.totalGross),
                    '${_report!.metrics.approvedCount} vendas',
                    AppColors.textPrimary,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildMetricTile(
                    'Custos Mercado Pago',
                    '- ${_currencyFormat.format(_report!.metrics.totalMpFee)}',
                    'Adquirência',
                    AppColors.danger,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildMetricTile(
                    'Taxa CJC Dev Pays',
                    '- ${_currencyFormat.format(_report!.metrics.totalCjcFee)}',
                    _app.isCommissionExempt ? 'Isenta (0%)' : 'Intermediação',
                    AppColors.warning,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildMetricTile(
                    'LÍQUIDO A REPASSAR',
                    _currencyFormat.format(_report!.metrics.totalNetPayout),
                    'Repasse da loja',
                    AppColors.success,
                    isHighlight: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Botões de Ação do Extrato
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: const Color(0xFF0F172A),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  icon: const Icon(Icons.picture_as_pdf, size: 16),
                  label: const Text('PDF do Lojista', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  onPressed: () => PdfGeneratorService.printOrSaveMerchantPdf(report: _report!),
                ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  icon: const Icon(Icons.share, size: 16, color: AppColors.textSecondary),
                  label: const Text('Compartilhar PDF', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  onPressed: () => PdfGeneratorService.shareMerchantPdf(report: _report!),
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  icon: const Icon(Icons.chat, size: 16, color: Colors.white),
                  label: const Text('WhatsApp', style: TextStyle(fontSize: 12, color: Colors.white)),
                  onPressed: _sendWhatsApp,
                ),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  icon: const Icon(Icons.table_chart, size: 16, color: AppColors.textSecondary),
                  label: const Text('CSV', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  onPressed: _exportCsv,
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Tabela Analítica de Vendas
            const Text(
              'Vendas Aprovadas no Mês',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            if (_report!.transactions.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text('Nenhuma venda aprovada registrada neste mês.', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _report!.transactions.length,
                separatorBuilder: (context, index) => const Divider(color: AppColors.border, height: 1),
                itemBuilder: (context, index) {
                  final tx = _report!.transactions[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tx.externalReference,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'monospace', color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${_dateFormat.format(tx.createdAt)} • ${tx.paymentMethod}',
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              _currencyFormat.format(tx.amount),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Líq: ${_currencyFormat.format(tx.netPayout)}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.success),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, String sub, Color color, {bool isHighlight = false}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isHighlight ? AppColors.successBg.withValues(alpha: 0.3) : AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isHighlight ? AppColors.success.withValues(alpha: 0.5) : AppColors.border,
          width: isHighlight ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: color,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _buildFieldHeader(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        text,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted, letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildActionsFooter() {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.warning,
              side: const BorderSide(color: AppColors.warning),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            icon: const Icon(Icons.cleaning_services, size: 16),
            label: const Text('Limpar Testes', style: TextStyle(fontSize: 12)),
            onPressed: _clearTransactions,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
              padding: const EdgeInsets.symmetric(vertical: 12),
            ),
            icon: const Icon(Icons.delete_forever, size: 16),
            label: const Text('Excluir App', style: TextStyle(fontSize: 12)),
            onPressed: _deleteApp,
          ),
        ),
      ],
    );
  }
}
