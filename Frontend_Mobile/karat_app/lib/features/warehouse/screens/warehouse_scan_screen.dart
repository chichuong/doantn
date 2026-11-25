import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';

class WarehouseScanScreen extends StatefulWidget {
  const WarehouseScanScreen({super.key});
  @override
  State<WarehouseScanScreen> createState() => _WarehouseScanScreenState();
}

class _WarehouseScanScreenState extends State<WarehouseScanScreen> {
  final MobileScannerController _scanner = MobileScannerController();
  final _ctrl = TextEditingController();
  bool _cameraOn = false;
  bool _loading = false;
  String? _error;

  // Result can be either product or document
  Map<String, dynamic>? _productResult;
  Map<String, dynamic>? _documentResult;

  // Controllers for actual quantities when a document is scanned
  final Map<String, TextEditingController> _actualQtyControllers = {};
  bool _completingDoc = false;

  @override
  void dispose() {
    _scanner.dispose();
    _ctrl.dispose();
    for (final c in _actualQtyControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _processScan(String identifier) async {
    final clean = identifier.trim();
    if (clean.isEmpty) return;

    setState(() {
      _loading = true;
      _productResult = null;
      _documentResult = null;
      _error = null;
    });

    final isLikelyDoc = clean.startsWith('DOC:') || clean.startsWith('NK-') || clean.startsWith('XK-');

    if (isLikelyDoc) {
      try {
        final doc = await WarehouseService.lookupDocumentByQr(clean);
        _initDocControllers(doc);
        setState(() {
          _documentResult = doc;
          _loading = false;
        });
        return;
      } catch (_) {
        // Fallback to product scan
      }
    }

    // Try product scan
    try {
      final data = await WarehouseService.scanProduct(clean);
      setState(() {
        _productResult = data;
        _loading = false;
      });
    } catch (e) {
      // If product failed and wasn't attempted as doc, try doc lookup as last resort
      try {
        final doc = await WarehouseService.lookupDocumentByQr(clean);
        _initDocControllers(doc);
        setState(() {
          _documentResult = doc;
          _loading = false;
        });
      } catch (_) {
        setState(() {
          _error = 'Không tìm thấy sản phẩm hoặc phiếu kho theo mã: $clean';
          _loading = false;
        });
      }
    }
  }

  void _initDocControllers(Map<String, dynamic> doc) {
    for (final c in _actualQtyControllers.values) {
      c.dispose();
    }
    _actualQtyControllers.clear();
    final items = doc['items'] as List<dynamic>? ?? [];
    for (final it in items) {
      final pid = (it['product_id'] ?? it['productId']).toString();
      final approvedQty = (it['quantity'] ?? 1).toString();
      _actualQtyControllers[pid] = TextEditingController(text: approvedQty);
    }
  }

  Future<void> _completeScannedDocument() async {
    final doc = _documentResult;
    if (doc == null) return;
    final docId = doc['id'].toString();
    final items = doc['items'] as List<dynamic>? ?? [];

    setState(() => _completingDoc = true);
    try {
      final actualItems = items.map((it) {
        final pid = (it['product_id'] ?? it['productId']).toString();
        final textVal = _actualQtyControllers[pid]?.text ?? it['quantity'].toString();
        final actualQty = int.tryParse(textVal) ?? (it['quantity'] as int);
        return {'productId': pid, 'actualQuantity': actualQty};
      }).toList();

      final updated = await WarehouseService.completeDocument(docId, items: actualItems);
      setState(() {
        _documentResult = updated;
        _completingDoc = false;
      });
      if (mounted) {
        showSnack(context, 'Xác nhận thành công! Tồn kho đã được cập nhật.');
      }
    } catch (e) {
      setState(() => _completingDoc = false);
      if (mounted) {
        showSnack(context, 'Lỗi: ${e.toString().replaceFirst("Exception: ", "")}', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Quét QR Phiếu Kho'),
        ),
        body: Column(
          children: [
            // Input field
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'Nhập mã phiếu (DOC:..., NK-...) hoặc SKU',
                        prefixIcon: Icon(Icons.search),
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      onSubmitted: (v) {
                        _processScan(v);
                        _ctrl.clear();
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: _loading
                        ? null
                        : () {
                            _processScan(_ctrl.text);
                            _ctrl.clear();
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    child: const Text('Tìm'),
                  ),
                ],
              ),
            ),

            // Camera toggle button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _cameraOn = !_cameraOn),
                icon: Icon(_cameraOn ? Icons.videocam_off : Icons.qr_code_scanner),
                label: Text(_cameraOn ? 'Tắt camera quét' : 'Mở camera điện thoại quét QR'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 44),
                ),
              ),
            ),

            if (_cameraOn)
              Container(
                height: 200,
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.primary, width: 2),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: MobileScanner(
                    controller: _scanner,
                    onDetect: (capture) {
                      final code = capture.barcodes.firstOrNull?.rawValue;
                      if (code != null) {
                        _processScan(code);
                        setState(() => _cameraOn = false);
                      }
                    },
                  ),
                ),
              ),

            const Divider(height: 16),

            // Results Display
            Expanded(
              child: _loading
                  ? const FullScreenLoader(message: 'Đang xác định mã...')
                  : _error != null
                      ? ErrorState(message: _error!, onRetry: null)
                      : _documentResult != null
                          ? _buildDocumentView(_documentResult!)
                          : _productResult != null
                              ? _buildProductView(_productResult!)
                              : const EmptyState(
                                  icon: Icons.qr_code_scanner,
                                  title: 'Quét mã QR hoặc mã vạch',
                                  subtitle: 'Quét QR trên phiếu kho để nhận/xuất hàng hoặc quét barcode để tra cứu tồn kho.',
                                ),
            ),
          ],
        ),
      );

  /// DOCUMENT EXECUTION & VERIFICATION VIEW
  Widget _buildDocumentView(Map<String, dynamic> doc) {
    final isReceipt = doc['type'] == 'receipt';
    final docNum = doc['document_number'] ?? doc['code'] ?? 'CT-${doc['id']}';
    final status = (doc['status'] ?? 'pending').toString().toLowerCase();
    final items = doc['items'] as List<dynamic>? ?? [];
    final isApproved = status == 'approved';
    final isCompleted = status == 'completed';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Card
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isReceipt ? Icons.south_west : Icons.north_east,
                          color: isReceipt ? AppTheme.success : AppTheme.primary,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          docNum,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ],
                    ),
                    StatusBadge(status: status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Kho: ${doc['warehouse_name'] ?? doc['warehouse_code'] ?? 'Kho hàng'}',
                  style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
                ),
                if (doc['note'] != null && doc['note'].toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Ghi chú: ${doc['note']}',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textHint),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Text(
                      'Loại: ${isReceipt ? "Nhập kho (Receipt)" : "Xuất kho (Issue)"}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isReceipt ? AppTheme.success : AppTheme.primary,
                      ),
                    ),
                    const Spacer(),
                    if (doc['approver_name'] != null)
                      Text(
                        'Duyệt bởi: ${doc['approver_name']}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textHint),
                      ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Items Verification Card
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isApproved
                      ? 'Xác nhận số lượng thực tế nhận/xuất:'
                      : 'Chi tiết mặt hàng trong phiếu:',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 10),
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 16),
                  itemBuilder: (ctx, i) {
                    final it = items[i];
                    final pid = (it['product_id'] ?? it['productId']).toString();
                    final approvedQty = it['quantity'] ?? 1;

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                it['name'] ?? it['product_name'] ?? 'Sản phẩm',
                                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              Text('SKU: ${it['sku'] ?? '-'}', style: const TextStyle(fontSize: 11, color: AppTheme.textHint)),
                              Text('SL đã duyệt: $approvedQty', style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        if (isApproved) ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              const Text('Thực nhận/xuất:', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                              const SizedBox(height: 4),
                              SizedBox(
                                width: 90,
                                height: 40,
                                child: TextField(
                                  controller: _actualQtyControllers[pid],
                                  keyboardType: TextInputType.number,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  decoration: InputDecoration(
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    contentPadding: EdgeInsets.zero,
                                    isDense: true,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('SL: $approvedQty', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              if (it['actual_quantity'] != null)
                                Text('Thực tế: ${it['actual_quantity']}', style: const TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ],
                    );
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Actions / Status Notices
          if (isApproved) ...[
            PrimaryButton(
              label: isReceipt ? 'Xác nhận nhập kho & Cập nhật tồn' : 'Xác nhận xuất kho & Cập nhật tồn',
              icon: Icons.check_circle,
              loading: _completingDoc,
              onPressed: _completeScannedDocument,
            ),
          ] else if (isCompleted) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.success.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: AppTheme.success, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Phiếu kho đã hoàn tất và tồn kho đã được đồng bộ.',
                      style: const TextStyle(color: AppTheme.success, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (status == 'pending') ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.warning.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.warning.withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.hourglass_empty, color: AppTheme.warning, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Phiếu đang ở trạng thái CHỜ DUYỆT. Vui lòng liên hệ Quản lý phê duyệt trên Web.',
                      style: TextStyle(color: AppTheme.warning, fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ] else if (status == 'rejected') ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.errorLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.error.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.cancel, color: AppTheme.error, size: 20),
                      SizedBox(width: 8),
                      Text('Phiếu này đã bị TỪ CHỐI.', style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.bold, fontSize: 13)),
                    ],
                  ),
                  if (doc['rejection_reason'] != null) ...[
                    const SizedBox(height: 4),
                    Text('Lý do: ${doc['rejection_reason']}', style: const TextStyle(color: AppTheme.error, fontSize: 12)),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// PRODUCT LOOKUP VIEW
  Widget _buildProductView(Map<String, dynamic> p) {
    final stock = p['inventory'] as List<dynamic>? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppTheme.primary, AppTheme.secondary]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(p['name'] ?? '', style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
                        Text('SKU: ${p['sku'] ?? ''}', style: const TextStyle(color: AppTheme.textHint, fontSize: 12)),
                      ],
                    ),
                  ),
                ]),
                const Divider(height: 20),
                _row('Barcode', p['barcode'] ?? '-'),
                _row('Giá bán', formatCurrency(p['sale_price'] ?? p['price'])),
                _row('Tồn thực tế', '${p['quantity'] ?? 0}'),
                _row('Đang giữ chỗ', '${p['reserved_quantity'] ?? 0}'),
                _row('Khả dụng', '${p['available_quantity'] ?? 0}'),
              ],
            ),
          ),
          if (stock.isNotEmpty) ...[
            const SizedBox(height: 12),
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Tồn kho theo từng kho', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 10),
                  ...stock.map((inv) {
                    final i = inv as Map<String, dynamic>;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(child: Text(i['warehouse_name'] ?? 'Kho', style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13))),
                          Text('${i['available_quantity'] ?? 0}', style: const TextStyle(color: AppTheme.secondary, fontWeight: FontWeight.bold, fontSize: 15)),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
            Text(value, style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w500, fontSize: 13)),
          ],
        ),
      );
}
