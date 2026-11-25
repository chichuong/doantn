import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';

class WarehouseProfileScreen extends StatefulWidget {
  const WarehouseProfileScreen({super.key});

  @override
  State<WarehouseProfileScreen> createState() => _WarehouseProfileScreenState();
}

class _WarehouseProfileScreenState extends State<WarehouseProfileScreen> {
  String _warehouseName = 'Kho trung tâm';

  @override
  void initState() {
    super.initState();
    _loadWarehouseName();
  }

  Future<void> _loadWarehouseName() async {
    try {
      final list = await WarehouseService.getWarehouses();
      if (list.isNotEmpty && mounted) {
        final name = list.first['name']?.toString();
        if (name != null && name.isNotEmpty) {
          setState(() => _warehouseName = name);
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final phone = user?.phone?.trim();
    final roleLabel = (user?.roleName == null || user!.roleName == 'Nhan vien kho')
        ? 'Nhân viên kho'
        : user.roleName!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tài khoản kho'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppTheme.accentLight,
                  child: Text(
                    (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'K').toUpperCase(),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.accent),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName ?? 'Nhân viên kho',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.accentLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          roleLabel,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.accent),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              children: [
                _buildInfoItem(
                  icon: Icons.warehouse_outlined,
                  label: 'Kho phụ trách',
                  value: _warehouseName,
                ),
                if (phone != null && phone.isNotEmpty) ...[
                  const Divider(height: 20),
                  _buildInfoItem(
                    icon: Icons.phone_outlined,
                    label: 'Số điện thoại',
                    value: phone,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
          PrimaryButton(
            label: 'Đăng xuất',
            icon: Icons.logout,
            color: AppTheme.error,
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Xác nhận đăng xuất'),
                  content: const Text('Bạn có chắc chắn muốn đăng xuất tài khoản?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Đăng xuất', style: TextStyle(color: AppTheme.error)),
                    ),
                  ],
                ),
              );
              if (confirm == true) {
                await auth.logout();
                if (context.mounted) context.go('/login');
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem({required IconData icon, required String label, required String value}) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.primary, size: 20),
        const SizedBox(width: 12),
        Text(label, style: const TextStyle(color: AppTheme.textSecondary)),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.w600),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
