import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors – light professional palette
  static const Color primary = Color(0xFF1565C0);       // Deep blue
  static const Color primaryDark = Color(0xFF003C8F);
  static const Color primaryLight = Color(0xFFE3F2FD);
  static const Color secondary = Color(0xFF00897B);     // Teal
  static const Color accent = Color(0xFFEF6C00);        // Warm orange
  static const Color accentLight = Color(0xFFFFF3E0);
  static const Color warning = Color(0xFFF9A825);
  static const Color success = Color(0xFF2E7D32);
  static const Color successLight = Color(0xFFE8F5E9);
  static const Color error = Color(0xFFC62828);
  static const Color errorLight = Color(0xFFFFEBEE);

  // Surfaces
  static const Color background = Color(0xFFF5F6FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF0F4FF);
  static const Color card = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE0E4EC);
  static const Color bgLight = Color(0xFFF5F6FA);

  // Text
  static const Color textPrimary = Color(0xFF1A1A2E);
  static const Color textSecondary = Color(0xFF5A5F7A);
  static const Color textHint = Color(0xFF9EA3B8);

  static ThemeData get lightTheme {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: primary,
        secondary: secondary,
        surface: surface,
        error: error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: textPrimary,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: AppBarTheme(
        backgroundColor: surface,
        foregroundColor: textPrimary,
        elevation: 0,
        centerTitle: true,
        shadowColor: Colors.black12,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: const TextStyle(
          color: textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        iconTheme: const IconThemeData(color: textPrimary, size: 22),
        shape: const Border(bottom: BorderSide(color: border, width: 1)),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: border, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceVariant,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: error),
        ),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 14),
        hintStyle: const TextStyle(color: textHint, fontSize: 14),
        prefixIconColor: textSecondary,
        suffixIconColor: textSecondary,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: primary),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: primary),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceVariant,
        labelStyle: const TextStyle(color: textSecondary, fontSize: 13),
        side: const BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      dividerTheme: const DividerThemeData(color: border, thickness: 1, space: 1),
      listTileTheme: const ListTileThemeData(
        tileColor: Colors.transparent,
        iconColor: textSecondary,
        textColor: textPrimary,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: primary,
        unselectedItemColor: textHint,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 11),
      ),
      tabBarTheme: const TabBarThemeData(
        labelColor: primary,
        unselectedLabelColor: textSecondary,
        indicatorColor: primary,
        dividerColor: border,
        labelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.normal, fontSize: 13),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: textPrimary,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        behavior: SnackBarBehavior.floating,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        titleTextStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: textPrimary),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
        displayLarge: const TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
        displayMedium: const TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
        titleLarge: const TextStyle(color: textPrimary, fontWeight: FontWeight.w700, fontSize: 20),
        titleMedium: const TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 16),
        titleSmall: const TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
        bodyLarge: const TextStyle(color: textPrimary, fontSize: 15),
        bodyMedium: const TextStyle(color: textSecondary, fontSize: 14),
        bodySmall: const TextStyle(color: textHint, fontSize: 12),
        labelLarge: const TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
      ),
    );
  }

  // Keep darkTheme as alias for backward compat
  static ThemeData get darkTheme => lightTheme;
}

// Status label/color helpers
extension OrderStatusX on String {
  String get orderStatusLabel => switch (this) {
        'pending' => 'Chờ xác nhận',
        'confirmed' => 'Đã xác nhận',
        'ready_to_pack' => 'Chuẩn bị giao kho',
        'packed' => 'Đã đóng gói',
        'handover' => 'Bàn giao shipper',
        'shipping' => 'Đang giao',
        'delivered' => 'Đã giao',
        'cancelled' => 'Đã hủy',
        'returned' => 'Hoàn hàng',
        _ => this,
      };

  Color get orderStatusColor => switch (this) {
        'pending' => AppTheme.warning,
        'confirmed' => AppTheme.primary,
        'ready_to_pack' => const Color(0xFF0277BD),
        'packed' => AppTheme.secondary,
        'handover' => const Color(0xFFE65100),
        'shipping' => AppTheme.primary,
        'delivered' => AppTheme.success,
        'cancelled' => AppTheme.error,
        'returned' => const Color(0xFF6A1B9A),
        _ => AppTheme.textHint,
      };

  String get shipmentStatusLabel => switch (this) {
        'assigned' => 'Đã phân công',
        'picked_up' => 'Đã lấy hàng',
        'in_transit' => 'Đang vận chuyển',
        'delivered' => 'Đã giao',
        'failed' => 'Giao thất bại',
        'returned' => 'Hoàn hàng',
        _ => this,
      };

  Color get shipmentStatusColor => switch (this) {
        'assigned' => AppTheme.warning,
        'picked_up' => AppTheme.primary,
        'in_transit' => const Color(0xFF0277BD),
        'delivered' => AppTheme.success,
        'failed' => AppTheme.error,
        'returned' => const Color(0xFF6A1B9A),
        _ => AppTheme.textHint,
      };

  String get warehouseDocStatusLabel => switch (toLowerCase()) {
        'pending' => 'Chờ duyệt',
        'approved' => 'Đã duyệt',
        'rejected' => 'Từ chối',
        'completed' => 'Hoàn tất',
        'draft' => 'Bản nháp',
        'cancelled' => 'Đã hủy',
        _ => this,
      };

  Color get warehouseDocStatusColor => switch (toLowerCase()) {
        'pending' => AppTheme.warning,
        'approved' => AppTheme.primary,
        'completed' => AppTheme.success,
        'rejected' => AppTheme.error,
        'cancelled' => AppTheme.textHint,
        _ => AppTheme.textHint,
      };
}
