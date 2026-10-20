import 'package:flutter/material.dart';
import '../constants/app_colors.dart';
import '../services/api_service.dart';

class AppLogoImage extends StatelessWidget {
  final String? logoUrl;
  final double size;
  final double borderRadius;
  final String fallbackEmoji;
  final Color? backgroundColor;

  const AppLogoImage({
    super.key,
    required this.logoUrl,
    this.size = 48,
    this.borderRadius = 12,
    this.fallbackEmoji = '🏢',
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = ApiService().resolveImageUrl(logoUrl);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: resolvedUrl != null && resolvedUrl.isNotEmpty
          ? Image.network(
              resolvedUrl,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Center(
                child: Text(
                  fallbackEmoji,
                  style: TextStyle(fontSize: size * 0.45),
                ),
              ),
              loadingBuilder: (context, child, loadingProgress) {
                if (loadingProgress == null) return child;
                return Center(
                  child: SizedBox(
                    width: size * 0.35,
                    height: size * 0.35,
                    child: const CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              },
            )
          : Center(
              child: Text(
                fallbackEmoji,
                style: TextStyle(fontSize: size * 0.45),
              ),
            ),
    );
  }
}
