import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../constants/app_colors.dart';
import '../models/application.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ApplicationsTab extends StatefulWidget {
  const ApplicationsTab({super.key});

  @override
  State<ApplicationsTab> createState() => _ApplicationsTabState();
}

class _ApplicationsTabState extends State<ApplicationsTab> {
  final _api = ApiService();
  final _auth = AuthService();

  List<ApplicationModel> _apps = [];
  bool _isLoading = true;
  String? _errorMessage;
  final Map<String, bool> _pingingMap = {};
  final Map<String, String> _pingResultMap = {};

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

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado com sucesso!'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _copyEnvBlock(ApplicationModel app) {
    final establishmentId = app.slug.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '-');
    final envContent = '''# Gateway CJC Dev Pays (${app.name})
CJC_PAYS_BASE_URL=${_auth.baseUrl}
CJC_PAYS_API_KEY=${app.apiKey}
CJC_PAYS_WEBHOOK_SECRET=${app.webhookSecret}
ID_ESTABELECIMENTO=$establishmentId''';

    _copyToClipboard(envContent, 'Bloco de variáveis .env');
  }

  Future<void> _pingApp(String appId) async {
    setState(() {
      _pingingMap[appId] = true;
      _pingResultMap.remove(appId);
    });

    try {
      final res = await _api.pingApplication(appId);
      final latency = res['latencyMs'] ?? 0;
      final msg = res['message'] ?? 'Conectividade OK (${latency}ms)';
      if (!mounted) return;
      setState(() {
        _pingResultMap[appId] = msg;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pingResultMap[appId] = 'Falha no ping: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _pingingMap[appId] = false;
        });
      }
    }
  }

  // ==================== CREATE MODAL ====================
  void _showCreateDialog() {
    final nameCtrl = TextEditingController();
    final slugCtrl = TextEditingController();
    final webhookCtrl = TextEditingController();
    bool isAutoSlug = true;

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
                  controller: webhookCtrl,
                  decoration: const InputDecoration(
                    labelText: 'URL de Webhook (Opcional)',
                    hintText: 'https://seusite.com/webhook',
                  ),
                  keyboardType: TextInputType.url,
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
                        webhookUrl: webhookCtrl.text.trim().isNotEmpty ? webhookCtrl.text.trim() : null,
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
    final webhookCtrl = TextEditingController(text: app.webhookUrl ?? '');
    bool isActive = app.isActive;

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
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () async {
                    final messenger = ScaffoldMessenger.of(context);
                    Navigator.pop(ctx);
                    try {
                      await _api.updateApplication(
                        id: app.id,
                        name: nameCtrl.text.trim(),
                        webhookUrl: webhookCtrl.text.trim(),
                        isActive: isActive,
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

  // ==================== DELETE MODAL ====================
  Future<void> _handleDelete(ApplicationModel app) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Excluir Aplicação'),
        content: Text('Deseja realmente excluir a aplicação "${app.name}" (${app.slug})? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await _api.deleteApplication(app.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aplicação excluída com sucesso!'), backgroundColor: AppColors.success),
      );
      _fetchApps();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao excluir: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  // ==================== REGENERATE API KEY ====================
  Future<void> _handleRegenerateKey(ApplicationModel app) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Rotacionar Chave de API'),
        content: Text(
          'Deseja gerar uma nova Chave de API para "${app.name}"? A chave atual deixará de funcionar imediatamente nas lojas clientes.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.warning),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Rotacionar Chave', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final newKey = await _api.regenerateApiKey(app.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Nova chave gerada: $newKey'), backgroundColor: AppColors.success),
      );
      _fetchApps();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao rotacionar chave: $e'), backgroundColor: AppColors.danger),
      );
    }
  }

  // ==================== CLEAR TRANSACTIONS ====================
  Future<void> _handleClearTransactions(ApplicationModel app) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Limpar Transações'),
        content: Text(
          'Deseja zerar todas as ${app.totalPayments} transações e ${app.totalDeliveries} webhooks da aplicação "${app.name}"?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Limpar Dados', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final msg = await _api.clearApplicationTransactions(app.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: AppColors.success),
      );
      _fetchApps();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Falha ao limpar transações: $e'), backgroundColor: AppColors.danger),
      );
    }
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

  Widget _buildAppCard(ApplicationModel app) {
    final isPinging = _pingingMap[app.id] ?? false;
    final pingResult = _pingResultMap[app.id];

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
          // Header (Name + Status + Menu Actions)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
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
                      app.slug,
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontFamily: 'monospace',
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Row(
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
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert_rounded, color: AppColors.textSecondary, size: 20),
                    color: AppColors.surfaceAlt,
                    onSelected: (val) {
                      switch (val) {
                        case 'edit':
                          _showEditDialog(app);
                          break;
                        case 'regen_key':
                          _handleRegenerateKey(app);
                          break;
                        case 'clear_tx':
                          _handleClearTransactions(app);
                          break;
                        case 'delete':
                          _handleDelete(app);
                          break;
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit_rounded, size: 16, color: AppColors.primary),
                            SizedBox(width: 8),
                            Text('Editar Aplicação'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'regen_key',
                        child: Row(
                          children: [
                            Icon(Icons.key_rounded, size: 16, color: AppColors.warning),
                            SizedBox(width: 8),
                            Text('Rotacionar API Key'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'clear_tx',
                        child: Row(
                          children: [
                            Icon(Icons.cleaning_services_rounded, size: 16, color: AppColors.danger),
                            SizedBox(width: 8),
                            Text('Limpar Transações'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete_forever_rounded, size: 16, color: AppColors.danger),
                            SizedBox(width: 8),
                            Text('Excluir Aplicação', style: TextStyle(color: AppColors.danger)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Stats (Total Payments & Deliveries)
          Row(
            children: [
              Expanded(
                child: _buildStatBox(
                  'Pagamentos',
                  app.totalPayments.toString(),
                  Icons.payments_rounded,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildStatBox(
                  'Webhooks',
                  app.totalDeliveries.toString(),
                  Icons.send_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // API Key Box
          _buildSecretBox('Chave de API (X-Api-Key)', app.apiKey),
          const SizedBox(height: 8),

          // Webhook Secret Box
          _buildSecretBox('Segredo HMAC (Webhook)', app.webhookSecret),
          const SizedBox(height: 8),

          // Webhook URL Box
          if (app.webhookUrl != null && app.webhookUrl!.isNotEmpty) ...[
            _buildUrlBox('Endpoint Webhook Receptor', app.webhookUrl!),
            const SizedBox(height: 10),
          ],

          // Quick Action Buttons Row: Ping & Copy .env
          Row(
            children: [
              if (app.webhookUrl != null && app.webhookUrl!.isNotEmpty)
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: isPinging ? null : () => _pingApp(app.id),
                    icon: isPinging
                        ? const SizedBox(
                            width: 12,
                            height: 12,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.bolt_rounded, size: 16),
                    label: Text(
                      isPinging ? 'Testando...' : 'Ping Webhook',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
              if (app.webhookUrl != null && app.webhookUrl!.isNotEmpty)
                const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => _copyEnvBlock(app),
                  icon: const Icon(Icons.copy_all_rounded, size: 16, color: AppColors.secondary),
                  label: const Text('Copiar .env', style: TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ),

          if (pingResult != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline_rounded, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      pingResult,
                      style: const TextStyle(fontSize: 11, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatBox(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSecretBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 16, color: AppColors.primary),
            onPressed: () => _copyToClipboard(value, label),
          ),
        ],
      ),
    );
  }

  Widget _buildUrlBox(String label, String url) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10)),
                const SizedBox(height: 2),
                Text(
                  url,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: AppColors.primaryLight,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 16, color: AppColors.primary),
            onPressed: () => _copyToClipboard(url, label),
          ),
        ],
      ),
    );
  }
}
