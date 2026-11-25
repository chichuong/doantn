import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';

class PackOrderScreen extends StatefulWidget {
  final Map<String, dynamic> order;
  final VoidCallback onPacked;
  const PackOrderScreen({super.key, required this.order, required this.onPacked});

  @override
  State<PackOrderScreen> createState() => _PackOrderScreenState();
}

class _PackOrderScreenState extends State<PackOrderScreen> {
  final MobileScannerController _scanner = MobileScannerController();
  final _manualCtrl = TextEditingController();
  Map<String, dynamic>? _checkData;
  bool _loadingCheck = true;
  bool _scanning = false;
  bool _packing = false;
  bool _scannerActive = false;

  String get orderId => widget.order['id'] as String? ?? '';

  @override
  void initState() {
    super.initState();
    _loadCheck();
  }

  @override
  void dispose() {
    _scanner.dispose();
    _manualCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCheck() async {
    setState(() => _loadingCheck = true);
    try {
      final data = await WarehouseService.getOrderCheck(orderId);
      setState(() { _checkData = data; _loadingCheck = false; });
    } catch (e) {
      setState(() => _loadingCheck = false);
    }
  }

  Future<void> _scanItem(String identifier) async {
    if (_scanning) return;
    setState(() => _scanning = true);
    try {
      await WarehouseService.scanOrderItem(orderId, identifier);
      await _loadCheck();
      if (mounted) showSnack(context, 'Đã quét: $identifier');
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
    if (mounted) setState(() => _scanning = false);
  }

  Future<void> _packOrder() async {
    setState(() => _packing = true);
    try {
      await WarehouseService.packOrder(orderId);
      if (mounted) {
        showSnack(context, 'Đã đóng gói đơn hàng thành công!');
        widget.onPacked();
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
    if (mounted) setState(() => _packing = false);
  }

  bool get _canPack {
    if (_checkData == null) return false;
    final items = _checkData!['items'] as List<dynamic>? ?? [];
    if (items.isEmpty) return false;
    return items.every((item) {
      final req = (item['quantity'] ?? item['required_quantity']) as int? ?? 0;
      final scanned = item['scanned_quantity'] as int? ?? 0;
      return req > 0 && scanned >= req;
    });
  }

  @override
  Widget build(BuildContext context) {
    final orderNumber = widget.order['order_number'] ?? widget.order['orderNumber'] ?? '';
    return Scaffold(
      appBar: AppBar(
        title: Text('Đóng gói #$orderNumber'),
        actions: [
          IconButton(
            icon: Icon(_scannerActive ? Icons.keyboard : Icons.qr_code_scanner, color: AppTheme.primary),
            onPressed: () => setState(() => _scannerActive = !_scannerActive),
          ),
        ],
      ),
      body: Column(
        children: [
          // Scanner or manual input
          if (_scannerActive)
            SizedBox(
              height: 220,
              child: Stack(
                children: [
                  MobileScanner(
                    controller: _scanner,
                    onDetect: (capture) {
                      final code = capture.barcodes.firstOrNull?.rawValue;
                      if (code != null) _scanItem(code);
                    },
                  ),
                  Center(
                    child: Container(
                      width: 180,
                      height: 180,
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.primary, width: 2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _manualCtrl,
                      style: const TextStyle(color: AppTheme.textPrimary),
                      decoration: const InputDecoration(
                        hintText: 'Nhập SKU / Barcode',
                        prefixIcon: Icon(Icons.edit_outlined),
                      ),
                      onSubmitted: (v) {
                        if (v.trim().isNotEmpty) { _scanItem(v.trim()); _manualCtrl.clear(); }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: _scanning ? null : () {
                      final v = _manualCtrl.text.trim();
                      if (v.isNotEmpty) { _scanItem(v); _manualCtrl.clear(); }
                    },
                    child: _scanning ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Quét'),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 12),
          // Check list
          Expanded(
            child: _loadingCheck
                ? const FullScreenLoader(message: 'Đang tải tiến độ...')
                : _buildCheckList(),
          ),
          // Pack button
          Padding(
            padding: const EdgeInsets.all(16),
            child: GradientButton(
              label: 'Hoàn tất đóng gói',
              icon: Icons.inventory_2_outlined,
              onPressed: _canPack ? _packOrder : null,
              loading: _packing,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckList() {
    final items = (_checkData?['items'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    if (items.isEmpty) return const EmptyState(icon: Icons.inventory_outlined, title: 'Không có sản phẩm trong đơn');
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: items.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (ctx, i) {
        final item = items[i];
        final name = (item['name'] ?? item['product_name'] ?? item['productName'] ?? '').toString();
        final sku = (item['sku'] ?? '').toString();
        final imageUrl = (item['image_url'] ?? item['imageUrl'] ?? '').toString();
        final required = (item['quantity'] ?? item['required_quantity']) as int? ?? 0;
        final scanned = item['scanned_quantity'] as int? ?? 0;
        final done = required > 0 && scanned >= required;
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: done ? AppTheme.success.withValues(alpha: 0.5) : AppTheme.border),
          ),
          child: Row(
            children: [
              Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
                  color: done ? AppTheme.success : AppTheme.textHint, size: 22),
              const SizedBox(width: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 44,
                  height: 44,
                  color: AppTheme.surfaceVariant,
                  child: imageUrl.isNotEmpty
                      ? Image.network(imageUrl, fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const Icon(Icons.inventory_2_outlined, size: 20, color: AppTheme.textHint))
                      : const Icon(Icons.inventory_2_outlined, size: 20, color: AppTheme.textHint),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 2),
                  Text('SKU: $sku', style: const TextStyle(color: AppTheme.textHint, fontSize: 12)),
                ],
              )),
              const SizedBox(width: 8),
              if (!done && sku.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: OutlinedButton(
                    onPressed: _scanning ? null : () => _scanItem(sku),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      side: const BorderSide(color: AppTheme.primary),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('+1 Quét', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primary)),
                  ),
                ),
              Text('$scanned / $required', style: TextStyle(
                color: done ? AppTheme.success : AppTheme.warning,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              )),
            ],
          ),
        );
      },
    );
  }
}
