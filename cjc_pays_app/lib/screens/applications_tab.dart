import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../models/application.dart';
import '../services/api_service.dart';
import 'application_detail_screen.dart';

class ApplicationsTab extends StatefulWidget {
  const ApplicationsTab({super.key});

  @override
  State<ApplicationsTab> createState() => _ApplicationsTabState();
}

class _ApplicationsTabState extends State<ApplicationsTab> {
  final _api = ApiService();

  List<ApplicationModel> _apps = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchApps();
  }

  Future<void> _fetchApps() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apps = await _api.getApplications();
      if (!mounted) return;
      setState(() {
        _apps = apps;
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

  // ==================== CREATE MODAL ====================
  void _showCreateDialog() {
    final nameCtrl = TextEditingController();
    final slugCtrl = TextEditingController();
    final logoCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final webhookCtrl = TextEditingController();
    bool isAutoSlug = true;
    bool isCommissionExempt = false;

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
                    const Text(
                      '➕ Nova Aplicação',
                      style: TextStyle(
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
                  decoration: const InputDecoration(
                    labelText: 'Nome da Aplicação',
                    hintText: 'Ex: Sua Loja Delivery',
                  ),
                  onChanged: (val) {
                    if (isAutoSlug) {
                      setModalState(() {
                        slugCtrl.text = val
                            .toLowerCase()
                            .trim()
                            .replaceAll(RegExp(r'\s+'), '-')
                            .replaceAll(RegExp(r'[^a-z0-9\-]'), '');
                      });
                    }
                  },
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: slugCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Slug Identificador',
                    hintText: 'ex: sua-loja',
                  ),
                  onChanged: (_) => isAutoSlug = false,
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: logoCtrl,
                  decoration: const InputDecoration(
                    labelText: 'URL do Logo da Loja (Opcional)',
                    hintText: 'https://seusite.com/logo.png',
                  ),
                  keyboardType: TextInputType.url,
                ),
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
                  decoration: const InputDecoration(
                    labelText: 'URL de Webhook (Opcional)',
                    hintText: 'https://seusite.com/webhook',
                  ),
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: 14),
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
                    final name = nameCtrl.text.trim();
                    final slug = slugCtrl.text.trim();
                    if (name.isEmpty || slug.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Nome e slug são obrigatórios!'), backgroundColor: AppColors.danger),
                      );
                      return;
                    }
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    try {
                      await _api.createApplication(
                        name: name,
                        slug: slug,
                        logoUrl: logoCtrl.text.trim().isNotEmpty ? logoCtrl.text.trim() : null,
                        contactEmail: emailCtrl.text.trim().isNotEmpty ? emailCtrl.text.trim() : null,
                        contactPhone: phoneCtrl.text.trim().isNotEmpty ? phoneCtrl.text.trim() : null,
                        webhookUrl: webhookCtrl.text.trim().isNotEmpty ? webhookCtrl.text.trim() : null,
                        isCommissionExempt: isCommissionExempt,
                      );
                      if (!mounted) return;
                      messenger.showSnackBar(
                        const SnackBar(content: Text('Aplicação cadastrada com sucesso!'), backgroundColor: AppColors.success),
                      );
                      _fetchApps();
                    } catch (e) {
                      if (!mounted) return;
                      messenger.showSnackBar(
                        SnackBar(content: Text('Falha ao cadastrar: $e'), backgroundColor: AppColors.danger),
                      );
                    }
                  },
                  child: const Text('Cadastrar Aplicação'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ==================== EDIT MODAL ====================
  void _showEditDialog(ApplicationModel app) {
    final nameCtrl = TextEditingController(text: app.name);
    final logoCtrl = TextEditingController(text: app.logoUrl ?? '');
    final emailCtrl = TextEditingController(text: app.contactEmail ?? '');
    final phoneCtrl = TextEditingController(text: app.contactPhone ?? '');
    final webhookCtrl = TextEditingController(text: app.webhookUrl ?? '');
    bool isActive = app.isActive;
    bool isCommissionExempt = app.isCommissionExempt;

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
                      '✏️ Editar ${app.name}',
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
                TextField(
                  controller: logoCtrl,
                  decoration: const InputDecoration(
                    labelText: 'URL do Logo da Loja (Opcional)',
                    hintText: 'https://seusite.com/logo.png',
                  ),
                  keyboardType: TextInputType.url,
                ),
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
                  subtitle: const Text('Permite criação de cobranças e disparo de webhooks', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
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
                      await _api.updateApplication(
                        id: app.id,
                        name: nameCtrl.text.trim(),
                        logoUrl: logoCtrl.text.trim(),
                        contactEmail: emailCtrl.text.trim(),
                        contactPhone: phoneCtrl.text.trim(),
                        webhookUrl: webhookCtrl.text.trim(),
                        isActive: isActive,
                        isCommissionExempt: isCommissionExempt,
                      );
                      if (!mounted) return;
                      messenger.showSnackBar(
                        const SnackBar(content: Text('Aplicação atualizada com sucesso!'), backgroundColor: AppColors.success),
                      );
                      _fetchApps();
                    } catch (e) {
                      if (!mounted) return;
                      messenger.showSnackBar(
                        SnackBar(content: Text('Falha ao atualizar: $e'), backgroundColor: AppColors.danger),
                      );
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading && _apps.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null && _apps.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.danger),
                        const SizedBox(height: 16),
                        Text(_errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _fetchApps, child: const Text('Recarregar')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchApps,
                  color: AppColors.primary,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                    itemCount: _apps.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 14),
                    itemBuilder: (ctx, i) {
                      final app = _apps[i];
                      return _buildAppCard(app);
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Nova Aplicação', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: _showCreateDialog,
      ),
    );
  }

  /// Card compacto: Logo, Nome, Slug e Botão Visualizar
  Widget _buildAppCard(ApplicationModel app) {
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
              // Logo
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: app.logoUrl != null && app.logoUrl!.isNotEmpty
                    ? Image.network(
                        app.logoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => const Center(
                          child: Text('🏢', style: TextStyle(fontSize: 22)),
                        ),
                      )
                    : const Center(
                        child: Text('🏢', style: TextStyle(fontSize: 22)),
                      ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.name,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'slug: ${app.slug}',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontFamily: 'monospace',
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: app.isActive ? AppColors.successBg.withValues(alpha: 0.5) : AppColors.dangerBg.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      app.isActive ? 'Ativa' : 'Inativa',
                      style: TextStyle(
                        color: app.isActive ? AppColors.success : AppColors.danger,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (app.isCommissionExempt) ...[
                    const SizedBox(height: 4),
                    const Text('🛡️ Isenta', style: TextStyle(fontSize: 10, color: AppColors.success, fontWeight: FontWeight.bold)),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(color: AppColors.border, height: 1),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '💳 ${app.totalPayments} pagamentos • 🔀 ${app.totalDeliveries} webhooks',
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textSecondary),
                    onPressed: () => _showEditDialog(app),
                    tooltip: 'Editar Aplicação',
                  ),
                  const SizedBox(width: 4),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: const Color(0xFF0F172A),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.visibility_rounded, size: 16),
                    label: const Text('Visualizar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ApplicationDetailScreen(application: app),
                        ),
                      ).then((_) => _fetchApps());
                    },
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
