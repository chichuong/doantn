import 'package:flutter/foundation.dart';

class AppConstants {
  static String? _customBaseUrl;

  static void setBaseUrl(String url) {
    _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static String? get customBaseUrl => _customBaseUrl;

  // Tự động nhận diện nền tảng:
  // - Mặc định ưu tiên kết nối Cloud Production Server 24/7: https://karats.studio/api/v1
  // - Có thể chuyển đổi linh hoạt về Localhost khi nhấn giữ logo ở trang Đăng nhập
  static const String cloudBaseUrl = 'https://karats.studio/api/v1';

  static String get baseUrl {
    if (_customBaseUrl != null && _customBaseUrl!.isNotEmpty) {
      return _customBaseUrl!;
    }
    return cloudBaseUrl;
  }

  // Vai trò (role_code từ backend)
  static const String roleCustomer = 'customer';
  static const String roleWarehouse = 'warehouse';
  static const String roleShipper = 'shipper';
  static const String roleAdmin = 'admin';
  static const String roleManager = 'manager';

  // Trạng thái đơn hàng
  static const List<String> orderStatuses = [
    'pending',
    'confirmed',
    'ready_to_pack',
    'packed',
    'handover',
    'shipping',
    'delivered',
    'cancelled',
    'returned',
  ];

  // Trạng thái vận đơn
  static const List<String> shipmentStatuses = [
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'failed',
    'returned',
  ];
}
