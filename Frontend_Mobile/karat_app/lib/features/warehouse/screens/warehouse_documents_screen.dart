import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';
import 'warehouse_scan_screen.dart';

class WarehouseDocumentsScreen extends StatefulWidget {
  const WarehouseDocumentsScreen({super.key});

  @override
  State<WarehouseDocumentsScreen> createState() => _WarehouseDocumentsScreenState();
}

class _WarehouseDocumentsScreenState extends State<WarehouseDocumentsScreen> {
  String _selectedType = 'ALL';
  String _selectedStatus = 'ALL';
  List<dynamic> _documents = [];
  bool _isLoading = true;
  String? _error;

  static const _types = [
    {'key': 'ALL', 'label': 'Tất cả loại'},
    {'key': 'receipt', 'label': 'Nhập kho'},
    {'key': 'issue', 'label': 'Xuất kho'},
  ];

  static const _statuses = [
    {'key': 'ALL', 'label': 'Tất cả'},
    {'key': 'pending', 'label': 'Chờ duyệt'},
    {'key': 'approved', 'label': 'Đã duyệt'},
    {'key': 'completed', 'label': 'Hoàn tất'},
    {'key': 'rejected', 'label': 'Từ chối'},
  ];

  @override
  void initState() {
    super.initState();
    _fetchDocuments();
  }

  Future<void> _fetchDocuments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await WarehouseService.getDocuments(
        type: _selectedType == 'ALL' ? null : _selectedType,
        status: _selectedStatus == 'ALL' ? null : _selectedStatus,
      );
      final data = res['data'];
      setState(() {
        if (data is List) {
          _documents = data;
        } else if (data is Map && data['documents'] is List) {
          _documents = data['documents'] as List;
        } else {
          _documents = [];
        }
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  void _showCreateDialog() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _CreateDocumentModal(),
    ).then((created) {
      if (created == true) {
        _fetchDocuments();
      }
    });
  }

  void _showDocumentDetail(dynamic doc) async {
    // Fetch fresh detail with item rows
    dynamic detailedDoc = doc;
    try {
      final res = await WarehouseService.getDocument(doc['id'].toString());
      detailedDoc = res;
    } catch (_) {}

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _DocumentDetailModal(
        doc: detailedDoc,
        onRefresh: _fetchDocuments,
      ),
    );
  }

  String _typeLabel(dynamic type) {
    return switch (type?.toString().toLowerCase()) {
      'receipt' => 'Nhập kho',
      'issue' => 'Xuất kho',
      _ => type?.toString() ?? 'Chưa rõ',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Phiếu kho'),
        actions: [
          PopupMenuButton<String>(
            initialValue: _selectedType,
            tooltip: 'Lọc loại phiếu',
            onSelected: (val) {
              setState(() => _selectedType = val);
              _fetchDocuments();
            },
            itemBuilder: (_) => _types
                .map((t) => PopupMenuItem<String>(
                      value: t['key']!,
                      child: Row(
                        children: [
                          Icon(
                            _selectedType == t['key'] ? Icons.check : Icons.filter_list,
                            size: 16,
                            color: _selectedType == t['key'] ? AppTheme.primary : AppTheme.textHint,
                          ),
                          const SizedBox(width: 8),
                          Text(t['label']!),
                        ],
                      ),
                    ))
                .toList(),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.filter_alt_outlined,
                    size: 18,
                    color: _selectedType == 'ALL' ? AppTheme.textSecondary : AppTheme.primary,
                  ),
                  if (_selectedType != 'ALL') ...[
                    const SizedBox(width: 4),
                    Text(
                      _selectedType == 'receipt' ? 'Nhập' : 'Xuất',
                      style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.bold),
                    ),
                  ],
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchDocuments,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Tạo yêu cầu', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter Statuses (1 hàng gọn)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: Row(
              children: _statuses.map((s) {
                final selected = _selectedStatus == s['key'];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    selected: selected,
                    label: Text(s['label']!),
                    onSelected: (_) {
                      setState(() => _selectedStatus = s['key']!);
                      _fetchDocuments();
                    },
                    selectedColor: AppTheme.primary,
                    backgroundColor: Colors.white,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppTheme.textSecondary,
                      fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const Divider(height: 12),

          Expanded(
            child: _isLoading
                ? const LoadingWidget(message: 'Đang tải danh sách phiếu kho...')
                : _error != null
                    ? CustomErrorWidget(message: _error!, onRetry: _fetchDocuments)
                    : _documents.isEmpty
                        ? const EmptyStateWidget(
                            icon: Icons.folder_open,
                            message: 'Không có phiếu kho nào phù hợp',
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchDocuments,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                              itemCount: _documents.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (context, idx) {
                                final doc = _documents[idx];
                                final isReceipt = doc['type'] == 'receipt';
                                final docNum = doc['document_number'] ?? doc['code'] ?? 'CT-${doc['id']}';
                                final status = doc['status'] ?? 'pending';

                                return AppCard(
                                  onTap: () => _showDocumentDetail(doc),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: Row(
                                              children: [
                                                Icon(
                                                  isReceipt ? Icons.south_west : Icons.north_east,
                                                  size: 16,
                                                  color: isReceipt ? AppTheme.success : AppTheme.primary,
                                                ),
                                                const SizedBox(width: 6),
                                                Expanded(
                                                  child: Text(
                                                    docNum,
                                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          StatusBadge(status: status),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      if (doc['note'] != null && doc['note'].toString().isNotEmpty) ...[
                                        Text(
                                          doc['note'].toString(),
                                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 6),
                                      ],
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: isReceipt ? AppTheme.success.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.1),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              _typeLabel(doc['type']),
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: isReceipt ? AppTheme.success : AppTheme.primary,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              doc['warehouse_name'] ?? 'Kho',
                                              style: const TextStyle(fontSize: 11, color: AppTheme.textHint),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          if (doc['qr_code'] != null)
                                            const Padding(
                                              padding: EdgeInsets.only(right: 4),
                                              child: Icon(Icons.qr_code, size: 16, color: AppTheme.primary),
                                            ),
                                          Text(
                                            formatDate(doc['created_at'] ?? doc['createdAt']),
                                            style: const TextStyle(color: AppTheme.textHint, fontSize: 11),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

/// Modal chi tiết chứng từ kho
class _DocumentDetailModal extends StatefulWidget {
  final dynamic doc;
  final VoidCallback onRefresh;

  const _DocumentDetailModal({required this.doc, required this.onRefresh});

  @override
  State<_DocumentDetailModal> createState() => _DocumentDetailModalState();
}

class _DocumentDetailModalState extends State<_DocumentDetailModal> {
  late dynamic _doc;
  bool _completing = false;
  bool _refreshingDoc = false;

  @override
  void initState() {
    super.initState();
    _doc = widget.doc;
  }

  Future<void> _reloadDoc() async {
    setState(() => _refreshingDoc = true);
    try {
      final res = await WarehouseService.getDocument(_doc['id'].toString());
      if (mounted) {
        setState(() {
          _doc = res;
          _refreshingDoc = false;
        });
        showSnack(context, 'Đã cập nhật trạng thái phiếu mới nhất');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _refreshingDoc = false);
        showSnack(context, 'Lỗi làm mới: ${e.toString().replaceFirst("Exception: ", "")}', isError: true);
      }
    }
  }

  void _confirmExecution() async {
    final doc = _doc;
    final items = doc['items'] as List<dynamic>? ?? [];

    // Controller for actual quantities
    final controllers = <String, TextEditingController>{};
    for (final it in items) {
      final pid = (it['product_id'] ?? it['productId']).toString();
      final expected = (it['quantity'] ?? 1).toString();
      controllers[pid] = TextEditingController(text: expected);
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dCtx) => AlertDialog(
        title: Text(
          doc['type'] == 'receipt' ? 'Xác nhận số lượng thực nhận' : 'Xác nhận số lượng thực xuất',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Kiểm đếm hàng thực tế trước khi xác nhận cập nhật tồn kho:',
                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 12),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 16),
                  itemBuilder: (ctx, i) {
                    final it = items[i];
                    final pid = (it['product_id'] ?? it['productId']).toString();
                    final name = it['name'] ?? it['product_name'] ?? 'Sản phẩm';
                    final exp = it['quantity'] ?? 1;

                    return Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                              Text('Duyệt: $exp', style: const TextStyle(fontSize: 11, color: AppTheme.textHint)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 80,
                          child: TextField(
                            controller: controllers[pid],
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(
                              labelText: 'Thực tế',
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dCtx, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dCtx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Xác nhận & Cập nhật tồn kho', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _completing = true);
    try {
      final actualItems = items.map((it) {
        final pid = (it['product_id'] ?? it['productId']).toString();
        final raw = controllers[pid]?.text ?? it['quantity'].toString();
        final qty = int.tryParse(raw) ?? (it['quantity'] as int);
        return {'productId': pid, 'actualQuantity': qty};
      }).toList();

      await WarehouseService.completeDocument(doc['id'].toString(), items: actualItems);
      if (mounted) {
        Navigator.pop(context);
        showSnack(context, 'Đã hoàn tất phiếu và cập nhật tồn kho thành công!');
        widget.onRefresh();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _completing = false);
        showSnack(context, 'Lỗi: ${e.toString().replaceFirst("Exception: ", "")}', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final doc = _doc;
    final isReceipt = doc['type'] == 'receipt';
    final docNum = doc['document_number'] ?? doc['code'] ?? 'CT-${doc['id']}';
    final status = (doc['status'] ?? 'pending').toString().toLowerCase();
    final items = doc['items'] as List<dynamic>? ?? [];
    final qrCode = doc['qr_code'] as String?;
    final qrScannedAt = doc['qr_scanned_at'];
    final qrScannedSource = doc['qr_scanned_source']?.toString();
    final isQrVerified = qrScannedAt != null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        docNum,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                      Text(
                        doc['warehouse_name'] ?? 'Kho hàng',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textHint),
                      ),
                    ],
                  ),
                ),
                StatusBadge(status: status),
              ],
            ),
            const SizedBox(height: 16),

            // Info rows
            _infoRow('Loại phiếu', isReceipt ? 'Nhập kho (Receipt)' : 'Xuất kho (Issue)'),
            _infoRow('Người tạo', doc['creator_name'] ?? 'Nhân viên kho'),
            _infoRow('Thời gian tạo', formatDate(doc['created_at'], withTime: true)),
            if (doc['note'] != null && doc['note'].toString().isNotEmpty)
              _infoRow('Ghi chú/Lý do', doc['note'].toString()),

            // Approver info
            if (doc['approved_by'] != null) ...[
              const Divider(height: 20),
              _infoRow('Người duyệt', doc['approver_name'] ?? 'Quản lý'),
              _infoRow('Thời gian duyệt', formatDate(doc['approved_at'], withTime: true)),
            ],

            // Rejection banner
            if (status == 'rejected') ...[
              const SizedBox(height: 12),
              Container(
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
                        Icon(Icons.cancel_outlined, size: 16, color: AppTheme.error),
                        SizedBox(width: 6),
                        Text('Lý do từ chối:', style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.bold, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      doc['rejection_reason'] ?? 'Không có lý do chi tiết',
                      style: const TextStyle(color: AppTheme.error, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],

            // QR Code view if approved
            if (status == 'approved' && qrCode != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.bgLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Column(
                  children: [
                    const Text('Mã QR xác định phiếu:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 8),
                    Center(
                      child: Image.network(
                        'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${Uri.encodeComponent(qrCode)}',
                        width: 130,
                        height: 130,
                        errorBuilder: (context, error, stackTrace) => Container(
                          width: 130,
                          height: 130,
                          color: Colors.white,
                          child: const Icon(Icons.qr_code, size: 60, color: AppTheme.primary),
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(qrCode, style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),
            if (items.isNotEmpty) ...[
              const Text('Danh sách mặt hàng:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.border),
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (ctx, i) {
                    final it = items[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(it['name'] ?? it['product_name'] ?? 'Sản phẩm', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                Text('SKU: ${it['sku'] ?? '-'}', style: const TextStyle(fontSize: 11, color: AppTheme.textHint)),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('SL duyệt: ${it['quantity']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              if (it['actual_quantity'] != null)
                                Text('Thực: ${it['actual_quantity']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.primary)),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Action: Confirm execution if approved
            if (status == 'approved') ...[
              if (isQrVerified) ...[
                // Huy hiệu xanh tinh gọn: Đã xác thực QR
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppTheme.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.success.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle, color: AppTheme.success, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Đã xác thực QR',
                              style: TextStyle(
                                color: AppTheme.success,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Wrap(
                              spacing: 4,
                              runSpacing: 2,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Icon(
                                  qrScannedSource == 'esp32_s3_camera' ? Icons.memory : Icons.phone_android,
                                  size: 13,
                                  color: AppTheme.textSecondary,
                                ),
                                Text(
                                  qrScannedSource == 'esp32_s3_camera' ? 'ESP32-S3' : 'App kho',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.textSecondary,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                if (qrScannedAt != null)
                                  Text(
                                    '• ${formatDate(qrScannedAt, withTime: true)}',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: _refreshingDoc
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.refresh, size: 16, color: AppTheme.textSecondary),
                          onPressed: _refreshingDoc ? null : _reloadDoc,
                          tooltip: 'Làm mới',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                PrimaryButton(
                  label: isReceipt ? 'Xác nhận thực nhận hàng' : 'Xác nhận thực xuất hàng',
                  icon: Icons.check_circle_outline,
                  loading: _completing,
                  onPressed: _confirmExecution,
                ),
              ] else ...[
                // Dòng cảnh báo nhỏ gọn: Chưa xác thực QR
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.warning.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.warning.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: AppTheme.warning, size: 18),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Chưa xác thực QR (Quét qua ESP32-S3 hoặc App)',
                          style: TextStyle(color: AppTheme.warning, fontWeight: FontWeight.w600, fontSize: 12),
                        ),
                      ),
                      // Nút quét nhanh bằng App
                      InkWell(
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const WarehouseScanScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(6),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.qr_code_scanner, size: 14, color: AppTheme.primary),
                              SizedBox(width: 4),
                              Text('Quét', style: TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      // Nút làm mới nhỏ
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: _refreshingDoc
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.refresh, size: 16, color: AppTheme.textSecondary),
                          onPressed: _refreshingDoc ? null : _reloadDoc,
                          tooltip: 'Làm mới',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // Nút xác nhận bị vô hiệu hóa khi chưa quét QR
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: null,
                    icon: const Icon(Icons.lock_outline, size: 18),
                    label: Text(isReceipt ? 'Xác nhận thực nhận hàng (Cần quét QR)' : 'Xác nhận thực xuất hàng (Cần quét QR)'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      disabledBackgroundColor: Colors.grey.shade200,
                      disabledForegroundColor: Colors.grey.shade500,
                    ),
                  ),
                ),
              ],
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
                    Icon(Icons.hourglass_empty, size: 18, color: AppTheme.warning),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Yêu cầu đang chờ Quản lý phê duyệt trên Web.',
                        style: TextStyle(color: AppTheme.warning, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

/// Modal tạo yêu cầu nhập / xuất kho mới
class _CreateDocumentModal extends StatefulWidget {
  const _CreateDocumentModal();

  @override
  State<_CreateDocumentModal> createState() => _CreateDocumentModalState();
}

class _CreateDocumentModalState extends State<_CreateDocumentModal> {
  String _type = 'receipt';
  String? _selectedWarehouseId;
  dynamic _selectedProduct;
  final _qtyCtrl = TextEditingController(text: '10');
  final _noteCtrl = TextEditingController();
  bool _loading = false;
  List<dynamic> _products = [];
  bool _loadingProducts = true;

  @override
  void initState() {
    super.initState();
    final authUser = context.read<AuthProvider>().user;
    if (authUser?.warehouseId != null && authUser!.warehouseId!.isNotEmpty) {
      _selectedWarehouseId = authUser.warehouseId;
    }
    _loadProducts();
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      final list = await WarehouseService.getCatalogProducts();
      if (_selectedWarehouseId == null) {
        final whs = await WarehouseService.getWarehouses();
        if (whs.isNotEmpty) {
          _selectedWarehouseId = (whs.first['id'] ?? whs.first['warehouseId'])?.toString();
        }
      }
      setState(() {
        _products = list;
        if (_products.isNotEmpty) {
          _selectedProduct = _products.first;
        }
        _loadingProducts = false;
      });
    } catch (_) {
      setState(() => _loadingProducts = false);
    }
  }

  Future<void> _submit() async {
    if (_selectedProduct == null) {
      showSnack(context, 'Vui lòng chọn sản phẩm', isError: true);
      return;
    }
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) {
      showSnack(context, 'Số lượng dự kiến phải lớn hơn 0', isError: true);
      return;
    }

    setState(() => _loading = true);
    try {
      // Fetch assigned warehouse id or fallback
      final pid = (_selectedProduct['id'] ?? _selectedProduct['productId']).toString();
      final authUser = context.read<AuthProvider>().user;
      final effectiveWhId = _selectedWarehouseId ?? authUser?.warehouseId;

      final body = {
        'type': _type,
        'note': _noteCtrl.text.trim(),
        'items': [
          {
            'productId': pid,
            'quantity': qty,
            'unitCost': _selectedProduct['costPrice'] ?? _selectedProduct['cost_price'] ?? 0,
          }
        ]
      };
      if (effectiveWhId != null && effectiveWhId.isNotEmpty) {
        body['warehouseId'] = effectiveWhId;
      }

      await WarehouseService.createDocument(body);
      if (mounted) {
        showSnack(context, 'Tạo yêu cầu ${_type == "receipt" ? "nhập" : "xuất"} kho thành công! Đang chờ duyệt.');
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        showSnack(context, 'Lỗi: ${e.toString().replaceFirst("Exception: ", "")}', isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _type == 'receipt' ? 'Tạo Yêu Cầu Nhập Kho' : 'Tạo Yêu Cầu Xuất Kho',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Select Type
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    selected: _type == 'receipt',
                    label: const Center(child: Text('Nhập kho (Receipt)')),
                    onSelected: (_) => setState(() => _type = 'receipt'),
                    selectedColor: AppTheme.primaryLight,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ChoiceChip(
                    selected: _type == 'issue',
                    label: const Center(child: Text('Xuất kho (Issue)')),
                    onSelected: (_) => setState(() => _type = 'issue'),
                    selectedColor: AppTheme.primaryLight,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Product selection
            const Text('Chọn sản phẩm:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            _loadingProducts
                ? const Center(child: CircularProgressIndicator())
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.border),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<dynamic>(
                        isExpanded: true,
                        value: _selectedProduct,
                        hint: const Text('Chọn sản phẩm'),
                        items: _products.map((p) {
                          return DropdownMenuItem<dynamic>(
                            value: p,
                            child: Text(
                              '${p['name']} (${p['sku']})',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) => setState(() => _selectedProduct = val),
                      ),
                    ),
                  ),
            const SizedBox(height: 14),

            // Quantity
            const Text('Số lượng dự kiến:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _qtyCtrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'Nhập số lượng (vd: 10)',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
            const SizedBox(height: 14),

            // Note/Reason
            const Text('Lý do / Ghi chú:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            TextField(
              controller: _noteCtrl,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Lý do nhập hoặc xuất kho...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
            const SizedBox(height: 20),

            PrimaryButton(
              label: 'Gửi yêu cầu phê duyệt',
              icon: Icons.send,
              loading: _loading,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
