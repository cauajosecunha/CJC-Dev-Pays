import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../constants/app_constants.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

class ServerSettingsScreen extends StatefulWidget {
  const ServerSettingsScreen({super.key});

  @override
  State<ServerSettingsScreen> createState() => _ServerSettingsScreenState();
}

class _ServerSettingsScreenState extends State<ServerSettingsScreen> {
  final _urlController = TextEditingController();
  final _auth = AuthService();
  final _api = ApiService();

  bool _isTesting = false;
  bool? _testResult;
  String? _testMessage;

  @override
  void initState() {
    super.initState();
    _urlController.text = _auth.baseUrl;
  }

  Future<void> _testConnection() async {
    setState(() {
      _isTesting = true;
      _testResult = null;
      _testMessage = null;
    });

    final success = await _api.checkHealth(_urlController.text.trim());

    if (!mounted) return;
    setState(() {
      _isTesting = false;
      _testResult = success;
      _testMessage = success
          ? 'Conectado com sucesso à Central!'
          : 'Não foi possível alcançar o servidor nesta URL.';
    });
  }

  Future<void> _saveAndExit() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;
    await _auth.setBaseUrl(url);

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('URL do servidor atualizada com sucesso!'),
        backgroundColor: AppColors.success,
      ),
    );
    Navigator.pop(context);
  }

  void _selectPreset(String presetUrl) {
    _urlController.text = presetUrl;
    _testConnection();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configuração do Servidor'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Endereço da Central de Pagamentos',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Alterne entre o servidor de Produção e o servidor local de desenvolvimento na sua rede.',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 20),

            // Presets
            const Text(
              'Atalhos Rápidos:',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  label: const Text('☁️ Produção (pays.cjcdev.site)'),
                  backgroundColor: AppColors.surfaceAlt,
                  labelStyle: const TextStyle(color: AppColors.primary, fontSize: 12),
                  onPressed: () => _selectPreset(AppConstants.defaultBaseUrl),
                ),
                ActionChip(
                  label: const Text('📱 Emulador Android (10.0.2.2:4020)'),
                  backgroundColor: AppColors.surfaceAlt,
                  labelStyle: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                  onPressed: () => _selectPreset(AppConstants.localDefaultUrl),
                ),
                ActionChip(
                  label: const Text('🏠 Localhost (127.0.0.1:4020)'),
                  backgroundColor: AppColors.surfaceAlt,
                  labelStyle: const TextStyle(color: AppColors.textPrimary, fontSize: 12),
                  onPressed: () => _selectPreset('http://127.0.0.1:4020'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Input URL
            TextField(
              controller: _urlController,
              decoration: InputDecoration(
                labelText: 'Base URL da API',
                hintText: 'https://pays.cjcdev.site',
                prefixIcon: const Icon(Icons.dns_rounded, color: AppColors.primary),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.clear_rounded),
                  onPressed: () => _urlController.clear(),
                ),
              ),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 16),

            // Test Connection Button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _isTesting ? null : _testConnection,
                icon: _isTesting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.wifi_tethering_rounded),
                label: Text(_isTesting ? 'Testando Conexão...' : 'Testar Conexão (Ping)'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: AppColors.primary),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),

            if (_testMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _testResult == true
                      ? AppColors.successBg.withValues(alpha: 0.4)
                      : AppColors.dangerBg.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _testResult == true ? AppColors.success : AppColors.danger,
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _testResult == true
                          ? Icons.check_circle_rounded
                          : Icons.error_outline_rounded,
                      color: _testResult == true ? AppColors.success : AppColors.danger,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _testMessage!,
                        style: TextStyle(
                          color: _testResult == true ? AppColors.success : AppColors.danger,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 32),

            // Save Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saveAndExit,
                child: const Text('Salvar e Aplicar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
