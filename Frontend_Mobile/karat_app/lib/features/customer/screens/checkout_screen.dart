import 'dart:math';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../cart_provider.dart';
import '../customer_service.dart';

class CheckoutScreen extends StatefulWidget {
  final List<CartItem> cartItems;
  const CheckoutScreen({super.key, required this.cartItems});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  List<Map<String, dynamic>> _addresses = [];
  String? _selectedAddressId;
  String _paymentMethod = 'cod'; // 'cod' | 'transfer'
  bool _loadingAddresses = true;
  bool _placing = false;
  final _noteCtrl = TextEditingController();
  late String _idempotencyKey;
  late String _qrOrderCode;

  @override
  void initState() {
    super.initState();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    _idempotencyKey = 'CHK-$nowMs-${Random().nextInt(999999)}';
    _qrOrderCode = 'MOB${nowMs.toString().substring(nowMs.toString().length - 6)}';
    _loadAddresses();
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    try {
      final list = await CustomerService.getAddresses();
      setState(() {
        _addresses = list.cast<Map<String, dynamic>>();
        final def = _addresses.firstWhere((a) => a['is_default'] == true, orElse: () => _addresses.isNotEmpty ? _addresses.first : {});
        _selectedAddressId = def['id'];
        _loadingAddresses = false;
      });
    } catch (_) {
      setState(() => _loadingAddresses = false);
    }
  }

  Future<void> _showAddAddressSheet() async {
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final lineCtrl = TextEditingController();
    final wardCtrl = TextEditingController();
    final districtCtrl = TextEditingController();
    final provinceCtrl = TextEditingController();
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          Future<void> saveAddr() async {
            if (nameCtrl.text.trim().isEmpty ||
                phoneCtrl.text.trim().isEmpty ||
                lineCtrl.text.trim().isEmpty ||
                provinceCtrl.text.trim().isEmpty) {
              showSnack(context, 'Vui lòng điền đầy đủ Người nhận, SĐT, Địa chỉ và Tỉnh/Thành phố', isError: true);
              return;
            }
            setSheetState(() => saving = true);
            try {
              final created = await CustomerService.createAddress({
                'recipientName': nameCtrl.text.trim(),
                'phone': phoneCtrl.text.trim(),
                'addressLine': lineCtrl.text.trim(),
                if (wardCtrl.text.trim().isNotEmpty) 'ward': wardCtrl.text.trim(),
                if (districtCtrl.text.trim().isNotEmpty) 'district': districtCtrl.text.trim(),
                'province': provinceCtrl.text.trim(),
                'isDefault': true,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              await _loadAddresses();
              if (created['id'] != null && mounted) {
                setState(() => _selectedAddressId = created['id'].toString());
              }
              if (mounted) showSnack(context, 'Đã thêm địa chỉ giao hàng mới!');
            } catch (e) {
              setSheetState(() => saving = false);
              if (mounted) showSnack(context, e.toString(), isError: true);
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Thêm địa chỉ giao hàng',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Họ tên người nhận *'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Số điện thoại *'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: lineCtrl,
                    decoration: const InputDecoration(labelText: 'Số nhà, tên đường *'),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: wardCtrl,
                          decoration: const InputDecoration(labelText: 'Phường / Xã'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: districtCtrl,
                          decoration: const InputDecoration(labelText: 'Quận / Huyện'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: provinceCtrl,
                    decoration: const InputDecoration(labelText: 'Tỉnh / Thành phố *'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: saving ? null : saveAddr,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: saving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Text('Lưu địa chỉ nhận hàng', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _placeOrder() async {
    if (_placing) return;
    if (_selectedAddressId == null || _addresses.isEmpty) {
      showSnack(context, 'Vui lòng thêm và chọn địa chỉ nhận hàng trước khi đặt hàng!', isError: true);
      _showAddAddressSheet();
      return;
    }
    setState(() => _placing = true);
    try {
      final cart = context.read<CartProvider>();
      final res = await CustomerService.checkout({
        if (_selectedAddressId != null) 'addressId': _selectedAddressId!,
        if (_noteCtrl.text.isNotEmpty) 'note': _noteCtrl.text.trim(),
        'channel': 'mobile',
        'paymentMethod': _paymentMethod,
        if (_paymentMethod == 'transfer') 'transactionReference': 'VIETQR-$_qrOrderCode',
      }, idempotencyKey: _idempotencyKey);
      cart.clear();
      if (mounted) {
        final orderNumber = res['order_number'] ?? res['orderNumber'] ?? '';
        showSnack(context, orderNumber.isNotEmpty ? 'Đặt hàng thành công! Mã đơn: $orderNumber' : 'Đặt hàng thành công!');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        final errText = e.toString().replaceFirst('Exception: ', '');
        showSnack(context, errText, isError: true);
      }
    }
    if (mounted) setState(() => _placing = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Xác nhận đơn hàng')),
        body: _loadingAddresses
            ? const FullScreenLoader()
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _section('Địa chỉ giao hàng', _buildAddressSection()),
                    const SizedBox(height: 16),
                    _section('Phương thức thanh toán', _buildPaymentSection()),
                    const SizedBox(height: 16),
                    _section('Ghi chú', _buildNoteField()),
                    const SizedBox(height: 16),
                    _section('Sản phẩm', _buildItemsList()),
                    const SizedBox(height: 16),
                    _buildTotal(),
                    const SizedBox(height: 24),
                    GradientButton(
                      label: _paymentMethod == 'transfer' ? 'Hoàn tất chuyển khoản & Đặt hàng' : 'Đặt hàng',
                      icon: Icons.check_circle_outlined,
                      onPressed: _placeOrder,
                      loading: _placing,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      );

  Widget _section(String title, Widget content) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          content,
        ],
      );

  Widget _buildAddressSection() {
    if (_addresses.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.warning)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(children: [
              Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 18),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Bạn chưa có địa chỉ giao hàng. Vui lòng thêm địa chỉ nhận hàng để đặt đơn.',
                  style: TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: _showAddAddressSheet,
              icon: const Icon(Icons.add_location_alt_outlined, size: 18),
              label: const Text('Thêm địa chỉ nhận hàng ngay'),
            ),
          ],
        ),
      );
    }
    return Column(
      children: _addresses.map((addr) {
        final id = addr['id'] as String? ?? '';
        final name = addr['recipient_name'] ?? '';
        final phone = addr['phone'] ?? '';
        final line = addr['address_line'] ?? '';
        final ward = addr['ward'] ?? '';
        final district = addr['district'] ?? '';
        final province = addr['province'] ?? '';
        return GestureDetector(
          onTap: () => setState(() => _selectedAddressId = id),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _selectedAddressId == id ? AppTheme.primary : AppTheme.border, width: _selectedAddressId == id ? 2 : 1),
            ),
            child: Row(
              children: [
                Radio<String>(
                  value: id,
                  groupValue: _selectedAddressId,
                  onChanged: (v) => setState(() => _selectedAddressId = v),
                  activeColor: AppTheme.primary,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$name • $phone', style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                      Text('$line${ward.isNotEmpty ? ', $ward' : ''}${district.isNotEmpty ? ', $district' : ''}, $province',
                          style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }


  Widget _buildPaymentSection() {
    final total = widget.cartItems.fold(0.0, (s, i) => s + i.subtotal).round();
    final qrUrl =
        'https://img.vietqr.io/image/970436-1025321052-compact2.png?amount=$total&addInfo=${Uri.encodeComponent(_qrOrderCode)}&accountName=${Uri.encodeComponent('LY CHI CHUONG')}';

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _paymentMethod = 'cod'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                  decoration: BoxDecoration(
                    color: _paymentMethod == 'cod' ? AppTheme.primary.withValues(alpha: 0.12) : AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _paymentMethod == 'cod' ? AppTheme.primary : AppTheme.border,
                      width: _paymentMethod == 'cod' ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.payments_outlined,
                          size: 18, color: _paymentMethod == 'cod' ? AppTheme.primary : AppTheme.textSecondary),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Tiền mặt (COD)',
                          style: TextStyle(
                            color: _paymentMethod == 'cod' ? AppTheme.primary : AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _paymentMethod = 'transfer'),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
                  decoration: BoxDecoration(
                    color: _paymentMethod == 'transfer' ? AppTheme.primary.withValues(alpha: 0.12) : AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _paymentMethod == 'transfer' ? AppTheme.primary : AppTheme.border,
                      width: _paymentMethod == 'transfer' ? 2 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_2_rounded,
                          size: 18, color: _paymentMethod == 'transfer' ? AppTheme.primary : AppTheme.textSecondary),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Chuyển khoản QR',
                          style: TextStyle(
                            color: _paymentMethod == 'transfer' ? AppTheme.primary : AppTheme.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        if (_paymentMethod == 'transfer') ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border),
            ),
            child: Center(
              child: Image.network(
                qrUrl,
                width: 240,
                height: 240,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Không tải được mã VietQR', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildNoteField() => TextFormField(
        controller: _noteCtrl,
        maxLines: 2,
        style: const TextStyle(color: AppTheme.textPrimary),
        decoration: const InputDecoration(hintText: 'Ghi chú đơn hàng (tùy chọn)', prefixIcon: Icon(Icons.note_outlined)),
      );

  Widget _buildItemsList() => Column(
        children: widget.cartItems.map((item) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppTheme.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.border)),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 40,
                  height: 40,
                  color: AppTheme.surfaceVariant,
                  child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                      ? Image.network(item.imageUrl!, fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const Icon(Icons.image_outlined, size: 18, color: AppTheme.textHint))
                      : const Icon(Icons.image_outlined, size: 18, color: AppTheme.textHint),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(item.productName, style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w500, fontSize: 13))),
              Text('x${item.quantity}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
              const SizedBox(width: 12),
              Text(formatCurrency(item.subtotal), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        )).toList(),
      );

  Widget _buildTotal() {
    final total = widget.cartItems.fold(0.0, (s, i) => s + i.subtotal);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [AppTheme.primary.withValues(alpha: 0.15), AppTheme.secondary.withValues(alpha: 0.1)]),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Tổng thanh toán:', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
          Text(formatCurrency(total), style: const TextStyle(color: AppTheme.primary, fontSize: 20, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
