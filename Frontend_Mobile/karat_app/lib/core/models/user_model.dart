class UserModel {
  final String id;
  final String email;
  final String fullName;
  final String? phone;
  final String roleCode;
  final String? roleName;
  final String status;
  final String? warehouseId;

  const UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    this.phone,
    required this.roleCode,
    this.roleName,
    required this.status,
    this.warehouseId,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] ?? '',
        email: json['email'] ?? '',
        fullName: json['full_name'] ?? json['fullName'] ?? '',
        phone: json['phone'],
        roleCode: json['role_code'] ?? json['roleCode'] ?? '',
        roleName: json['role_name'] ?? json['roleName'],
        status: json['status'] ?? 'active',
        warehouseId: json['warehouse_id'] ??
            json['warehouseId'] ??
            (json['warehouse_ids'] is List && (json['warehouse_ids'] as List).isNotEmpty
                ? (json['warehouse_ids'] as List).first?.toString()
                : null) ??
            (json['warehouseIds'] is List && (json['warehouseIds'] as List).isNotEmpty
                ? (json['warehouseIds'] as List).first?.toString()
                : null),
      );

  bool get isCustomer => roleCode == 'customer';
  bool get isWarehouse => roleCode == 'warehouse';
  bool get isShipper => roleCode == 'shipper';
  bool get isAdmin => roleCode == 'admin';
  bool get isManager => roleCode == 'manager';
}

class AuthResponse {
  final String accessToken;
  final UserModel user;

  const AuthResponse({required this.accessToken, required this.user});

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    // backend: { data: { accessToken, user } }
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return AuthResponse(
      accessToken: data['accessToken'] ?? '',
      user: UserModel.fromJson(data['user'] as Map<String, dynamic>? ?? {}),
    );
  }
}
