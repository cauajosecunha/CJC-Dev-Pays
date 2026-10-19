import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;
    IconData icon;

    switch (status.toUpperCase()) {
      case 'APPROVED':
      case 'DELIVERED':
        bg = AppColors.successBg.withValues(alpha: 0.5);
        fg = AppColors.success;
        label = status.toUpperCase() == 'APPROVED' ? 'Aprovado' : 'Entregue';
        icon = Icons.check_circle_rounded;
        break;
      case 'PENDING':
        bg = AppColors.warningBg.withValues(alpha: 0.5);
        fg = AppColors.warning;
        label = 'Pendente';
        icon = Icons.access_time_rounded;
        break;
      case 'REFUNDED':
        bg = AppColors.infoBg.withValues(alpha: 0.5);
        fg = AppColors.primaryLight;
        label = 'Estornado';
        icon = Icons.replay_rounded;
        break;
      case 'REJECTED':
      case 'FAILED':
      case 'CANCELLED':
        bg = AppColors.dangerBg.withValues(alpha: 0.5);
        fg = AppColors.danger;
        label = status.toUpperCase() == 'FAILED' ? 'Falha' : 'Cancelado';
        icon = Icons.cancel_rounded;
        break;
      default:
        bg = AppColors.surfaceAlt;
        fg = AppColors.textSecondary;
        label = status;
        icon = Icons.info_outline_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: fg.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: fontSize + 1, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: fontSize,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
