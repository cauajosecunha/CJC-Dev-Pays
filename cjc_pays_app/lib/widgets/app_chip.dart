import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class AppChip extends StatelessWidget {
  final String name;
  final String? slug;
  final double fontSize;

  const AppChip({
    super.key,
    required this.name,
    this.slug,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.secondary.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.secondary.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.business_rounded, size: fontSize + 1, color: AppColors.secondary),
          const SizedBox(width: 4),
          Text(
            name,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
