import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../shipper_service.dart';

class ShipperProfileScreen extends StatefulWidget {
  const ShipperProfileScreen({super.key});

  @override
  State<ShipperProfileScreen> createState() => _ShipperProfileScreenState();
}

class _ShipperProfileScreenState extends State<ShipperProfileScreen> {
  int _deliveredCount = 0;
  int _activeCount = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchStats();
  }

  Future<void> _fetchStats() async {
    try {
      final resDelivered = await ShipperService.getShipments(status: 'delivered', limit: 1);
      final resActive = await ShipperService.getShipments(status: 'in_transit', limit: 1);
      if (mounted) {
        setState(() {
          _deliveredCount = resDelivered['pagination']?['total'] ?? 0;
          _activeCount = resActive['pagination']?['total'] ?? 0;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final phone = user?.phone?.trim();
    final roleLabel = (user?.roleName == null ||
            user!.roleName == 'Nhan vien giao hang' ||
            user.roleName == 'Shipper')
        ? 'Nhân viên giao hàng'
        : user.roleName!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tài khoản giao hàng'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: AppTheme.primaryLight,
                  child: Text(
                    (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'S').toUpperCase(),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.fullName ?? 'Nhân viên giao hàng',
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
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          roleLabel,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primary),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Stats cards
          Row(
            children: [
              Expanded(
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.local_shipping, color: AppTheme.primary, size: 20),
                          SizedBox(width: 6),
                          Text('Đang giao', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _isLoading ? '...' : '$_activeCount',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.primary),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.check_circle, color: AppTheme.success, size: 20),
                          SizedBox(width: 6),
                          Text('Đã hoàn tất', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _isLoading ? '...' : '$_deliveredCount',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppTheme.success),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          if (phone != null && phone.isNotEmpty) ...[
            const SizedBox(height: 16),
            AppCard(
              child: _buildInfoItem(
                icon: Icons.phone_outlined,
                label: 'Số điện thoại',
                value: phone,
              ),
            ),
          ],
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
