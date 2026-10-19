import 'package:flutter/material.dart';

class AppColors {
  // Backgrounds
  static const Color background = Color(0xFF0A0F1D);
  static const Color surface = Color(0xFF111827);
  static const Color surfaceAlt = Color(0xFF1F2937);
  static const Color surfaceElevated = Color(0xFF1A2234);

  // Borders & Dividers
  static const Color border = Color(0xFF1E293B);
  static const Color borderFocus = Color(0xFF38BDF8);

  // Primary Branding (Cyan & Indigo)
  static const Color primary = Color(0xFF38BDF8);
  static const Color primaryDark = Color(0xFF0284C7);
  static const Color primaryLight = Color(0xFF7DD3FC);
  static const Color secondary = Color(0xFF6366F1);

  // Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0xFF064E3B);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFF451A03);
  static const Color danger = Color(0xFFF43F5E);
  static const Color dangerBg = Color(0xFF4C0519);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0xFF1E3A8A);

  // Text Colors
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF38BDF8), Color(0xFF6366F1)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    colors: [Color(0xFF111827), Color(0xFF161F33)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient successGradient = LinearGradient(
    colors: [Color(0xFF10B981), Color(0xFF059669)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
