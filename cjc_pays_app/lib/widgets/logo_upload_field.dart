import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../constants/app_colors.dart';
import '../services/api_service.dart';
import 'app_logo_image.dart';

class LogoUploadField extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String?>? onLogoChanged;

  const LogoUploadField({
    super.key,
    required this.controller,
    this.onLogoChanged,
  });

  @override
  State<LogoUploadField> createState() => _LogoUploadFieldState();
}

class _LogoUploadFieldState extends State<LogoUploadField> {
  final _picker = ImagePicker();
  final _api = ApiService();
  bool _isUploading = false;
  bool _showManualUrl = false;

  Future<void> _pickAndUploadImage() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (picked == null) return;

      setState(() => _isUploading = true);

      final bytes = await picked.readAsBytes();
      final filename = picked.name.isNotEmpty ? picked.name : 'logo.png';

      final uploadedUrl = await _api.uploadLogo(
        bytes: bytes,
        filename: filename,
      );

      widget.controller.text = uploadedUrl;
      widget.onLogoChanged?.call(uploadedUrl);

      if (mounted) {
        setState(() => _isUploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Logo enviado com sucesso!'),
            backgroundColor: AppColors.success,
            duration: Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erro ao enviar logo: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  void _removeLogo() {
    setState(() {
      widget.controller.clear();
      widget.onLogoChanged?.call(null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentUrl = widget.controller.text.trim();
    final hasLogo = currentUrl.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              // Preview do Logo
              AppLogoImage(
                logoUrl: hasLogo ? currentUrl : null,
                size: 54,
                borderRadius: 12,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Logo da Aplicação',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasLogo
                          ? 'Logo configurado (${currentUrl.split('/').last})'
                          : 'Adicione uma imagem PNG, JPG ou WebP',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (_isUploading)
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                )
              else if (hasLogo)
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: AppColors.danger, size: 20),
                  tooltip: 'Remover Logo',
                  onPressed: _removeLogo,
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.photo_library_outlined, size: 16, color: AppColors.primary),
                  label: Text(
                    hasLogo ? 'Trocar Imagem' : 'Fazer Upload de Imagem',
                    style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                  ),
                  onPressed: _isUploading ? null : _pickAndUploadImage,
                ),
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () => setState(() => _showManualUrl = !_showManualUrl),
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Icon(
                    _showManualUrl ? Icons.link_off : Icons.link,
                    size: 20,
                    color: _showManualUrl ? AppColors.primary : AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
          if (_showManualUrl) ...[
            const SizedBox(height: 10),
            TextField(
              controller: widget.controller,
              decoration: const InputDecoration(
                labelText: 'URL da Imagem (Manual)',
                hintText: 'https://seusite.com/logo.png',
                isDense: true,
              ),
              onChanged: (val) => setState(() {}),
            ),
          ],
        ],
      ),
    );
  }
}
