import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../customer_service.dart';

class CustomerProfileScreen extends StatefulWidget {
  const CustomerProfileScreen({super.key});
  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen> {
  List<Map<String, dynamic>> _addresses = [];
  bool _loadingAddr = true;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    try {
      final list = await CustomerService.getAddresses();
      setState(() { _addresses = list.cast<Map<String, dynamic>>(); _loadingAddr = false; });
    } catch (_) {
      setState(() => _loadingAddr = false);
    }
  }

  Future<void> _deleteAddress(String id) async {
    try {
      await CustomerService.deleteAddress(id);
      await _loadAddresses();
      if (mounted) showSnack(context, 'Đã xóa địa chỉ');
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản của tôi')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + info
          SectionCard(
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Text(
                      (user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'K').toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.fullName ?? '', style: const TextStyle(color: AppTheme.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
                      Text(user?.email ?? '', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                      if (user?.phone != null) Text(user!.phone!, style: const TextStyle(color: AppTheme.textHint, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Addresses
          _sectionTitle('Địa chỉ giao hàng'),
          if (_loadingAddr)
            const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(color: AppTheme.primary)))
          else if (_addresses.isEmpty)
            SectionCard(
              child: Row(children: [
                const Icon(Icons.location_off_outlined, color: AppTheme.textHint),
                const SizedBox(width: 10),
                const Text('Chưa có địa chỉ', style: TextStyle(color: AppTheme.textSecondary)),
              ]),
            )
          else
            ..._addresses.map((addr) => _AddressTile(
                  addr: addr,
                  onDelete: () => _deleteAddress(addr['id'] as String),
                )),
          const SizedBox(height: 8),
          SectionCard(
            child: ListTile(
              leading: const Icon(Icons.add_location_alt_outlined, color: AppTheme.primary),
              title: const Text('Thêm địa chỉ mới', style: TextStyle(color: AppTheme.primary)),
              onTap: () => _showAddAddressDialog(),
              contentPadding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: 24),
          // Logout
          SectionCard(
            child: ListTile(
              leading: const Icon(Icons.logout, color: AppTheme.error),
              title: const Text('Đăng xuất', style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.w600)),
              onTap: () async {
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
                if (confirm == true && context.mounted) {
                  final auth = context.read<AuthProvider>();
                  await auth.logout();
                  if (context.mounted) {
                    context.go('/login');
                  }
                }
              },
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(t, style: const TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600, fontSize: 13)),
  );

  void _showAddAddressDialog() {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final lineCtrl = TextEditingController();
    final provinceCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 20, right: 20, top: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Thêm địa chỉ', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 17)),
            const SizedBox(height: 16),
            _dlgField(nameCtrl, 'Tên người nhận'),
            const SizedBox(height: 10),
            _dlgField(phoneCtrl, 'Số điện thoại'),
            const SizedBox(height: 10),
            _dlgField(lineCtrl, 'Địa chỉ chi tiết'),
            const SizedBox(height: 10),
            _dlgField(provinceCtrl, 'Tỉnh/Thành phố'),
            const SizedBox(height: 20),
            GradientButton(
              label: 'Lưu địa chỉ',
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final phone = phoneCtrl.text.trim();
                final line = lineCtrl.text.trim();
                final province = provinceCtrl.text.trim();
                if (name.isEmpty || phone.isEmpty || line.isEmpty || province.isEmpty) {
                  showSnack(context, 'Vui lòng nhập đầy đủ thông tin địa chỉ', isError: true);
                  return;
                }
                Navigator.pop(ctx);
                try {
                  await CustomerService.createAddress({
                    'recipientName': name,
                    'phone': phone,
                    'addressLine': line,
                    'province': province,
                  });
                  await _loadAddresses();
                  if (mounted) showSnack(context, 'Đã thêm địa chỉ');
                } catch (e) {
                  if (mounted) showSnack(context, e.toString(), isError: true);
                }
              },
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _dlgField(TextEditingController ctrl, String label) => TextField(
        controller: ctrl,
        style: const TextStyle(color: AppTheme.textPrimary),
        decoration: InputDecoration(labelText: label),
      );
}

class _AddressTile extends StatelessWidget {
  final Map<String, dynamic> addr;
  final VoidCallback onDelete;
  const _AddressTile({required this.addr, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final name = addr['recipient_name'] ?? '';
    final phone = addr['phone'] ?? '';
    final line = addr['address_line'] ?? '';
    final province = addr['province'] ?? '';
    final isDefault = addr['is_default'] == true;

    return SectionCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Flexible(
                    child: Text(
                      '$name  $phone',
                      style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (isDefault) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                      child: const Text('Mặc định', style: TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ]),
                const SizedBox(height: 2),
                Text(
                  '$line, $province',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.delete_outline, color: AppTheme.error, size: 20), onPressed: onDelete),
        ],
      ),
    );
  }
}
