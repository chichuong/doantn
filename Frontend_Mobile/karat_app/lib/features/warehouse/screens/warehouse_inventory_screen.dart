import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';

class WarehouseInventoryScreen extends StatefulWidget {
  const WarehouseInventoryScreen({super.key});

  @override
  State<WarehouseInventoryScreen> createState() => _WarehouseInventoryScreenState();
}

class _WarehouseInventoryScreenState extends State<WarehouseInventoryScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _debounce;

  List<Map<String, dynamic>> _warehouses = [];
  String? _selectedWarehouseId;
  String _selectedWarehouseName = 'Kho hàng';

  List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  int _total = 0;
  String _search = '';
  bool _lowStockOnly = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWarehouses();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      if (!_loading && !_loadingMore && _hasMore) {
        _loadInventory();
      }
    }
  }

  Future<void> _loadWarehouses() async {
    try {
      final list = await WarehouseService.getWarehouses();
      if (mounted) {
        setState(() {
          _warehouses = list.cast<Map<String, dynamic>>();
          if (_warehouses.isNotEmpty) {
            _selectedWarehouseId = _warehouses.first['id']?.toString();
            _selectedWarehouseName = _warehouses.first['name']?.toString() ?? 'Kho hàng';
          }
        });
        _loadInventory(reset: true);
      }
    } catch (_) {
      // Nếu không nạp được danh sách kho, vẫn thử load tồn kho mặc định theo token nhân viên
      _loadInventory(reset: true);
    }
  }

  Future<void> _loadInventory({bool reset = false}) async {
    if (_loading || _loadingMore) return;

    if (reset) {
      setState(() {
        _page = 1;
        _hasMore = true;
        _loading = true;
        _error = null;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final res = await WarehouseService.getInventory(
        warehouseId: _selectedWarehouseId,
        search: _search,
        lowStock: _lowStockOnly,
        page: _page,
        limit: 20,
      );

      final data = res['data'] as List<dynamic>? ?? [];
      final pagination = res['pagination'] as Map<String, dynamic>?;
      final total = pagination?['total'] as int? ?? data.length;
      final newItems = data.cast<Map<String, dynamic>>();

      if (mounted) {
        setState(() {
          if (reset) {
            _items = newItems;
          } else {
            _items.addAll(newItems);
          }
          _total = total;
          _hasMore = _items.length < total;
          _page++;
          _loading = false;
          _loadingMore = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Không thể tải tồn kho: ${e.toString()}';
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      setState(() => _search = value.trim());
      _loadInventory(reset: true);
    });
  }

  Future<void> _scanBarcodeForSearch() async {
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      builder: (ctx) => SizedBox(
        height: 360,
        child: Column(
          children: [
            AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              title: const Text('Quét mã vạch sản phẩm', style: TextStyle(fontSize: 16)),
              leading: IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
            Expanded(
              child: MobileScanner(
                onDetect: (capture) {
                  final raw = capture.barcodes.firstOrNull?.rawValue;
                  if (raw != null && raw.trim().isNotEmpty) {
                    Navigator.pop(ctx, raw.trim());
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (code != null && mounted) {
      _searchCtrl.text = code;
      setState(() => _search = code);
      _loadInventory(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tồn kho'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới',
            onPressed: () => _loadInventory(reset: true),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchAndFilters(),
          _buildSummaryBar(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Tìm theo tên sản phẩm, SKU, Barcode...',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_searchCtrl.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _search = '');
                        _loadInventory(reset: true);
                      },
                    ),
                  IconButton(
                    icon: const Icon(Icons.qr_code_scanner, size: 20, color: AppTheme.primary),
                    tooltip: 'Quét mã vạch SP',
                    onPressed: _scanBarcodeForSearch,
                  ),
                ],
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
            onChanged: _onSearchChanged,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              FilterChip(
                selected: !_lowStockOnly,
                label: const Text('Tất cả'),
                onSelected: (_) {
                  if (_lowStockOnly) {
                    setState(() => _lowStockOnly = false);
                    _loadInventory(reset: true);
                  }
                },
                selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                checkmarkColor: AppTheme.primary,
                labelStyle: TextStyle(
                  color: !_lowStockOnly ? AppTheme.primary : AppTheme.textSecondary,
                  fontWeight: !_lowStockOnly ? FontWeight.bold : FontWeight.normal,
                  fontSize: 12,
                ),
              ),
              const SizedBox(width: 8),
              FilterChip(
                selected: _lowStockOnly,
                avatar: Icon(Icons.warning_amber_rounded, size: 16, color: _lowStockOnly ? AppTheme.warning : AppTheme.textHint),
                label: const Text('Sắp hết / Tồn thấp'),
                onSelected: (_) {
                  if (!_lowStockOnly) {
                    setState(() => _lowStockOnly = true);
                    _loadInventory(reset: true);
                  }
                },
                selectedColor: AppTheme.warning.withValues(alpha: 0.15),
                checkmarkColor: AppTheme.warning,
                labelStyle: TextStyle(
                  color: _lowStockOnly ? AppTheme.warning : AppTheme.textSecondary,
                  fontWeight: _lowStockOnly ? FontWeight.bold : FontWeight.normal,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Text(
            'Hiển thị ${_items.length}/$_total sản phẩm',
            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w500),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _selectedWarehouseName,
              textAlign: TextAlign.end,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, color: AppTheme.textHint),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _items.isEmpty) {
      return const FullScreenLoader(message: 'Đang tải dữ liệu tồn kho...');
    }

    if (_error != null && _items.isEmpty) {
      return ErrorState(
        message: _error!,
        onRetry: () => _loadInventory(reset: true),
      );
    }

    if (_items.isEmpty) {
      return EmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'Không có sản phẩm tồn kho',
        subtitle: _search.isNotEmpty ? 'Không tìm thấy kết quả phù hợp cho "$_search"' : 'Kho này chưa có mặt hàng nào',
        action: _search.isNotEmpty
            ? OutlinedButton(
                onPressed: () {
                  _searchCtrl.clear();
                  setState(() => _search = '');
                  _loadInventory(reset: true);
                },
                child: const Text('Xóa tìm kiếm'),
              )
            : null,
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadInventory(reset: true),
      color: AppTheme.primary,
      child: ListView.separated(
        controller: _scrollCtrl,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        itemCount: _items.length + (_hasMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (ctx, i) {
          if (i >= _items.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary)),
            );
          }
          return _InventoryCard(item: _items[i]);
        },
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _InventoryCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final name = item['product_name'] ?? item['name'] ?? 'Sản phẩm';
    final sku = item['sku']?.toString() ?? '-';
    final barcode = item['barcode']?.toString();
    final imgUrl = item['image_url'] as String?;

    final quantity = int.tryParse(item['quantity']?.toString() ?? '0') ?? 0;
    final reserved = int.tryParse((item['reserved_quantity'] ?? item['reservedQuantity'])?.toString() ?? '0') ?? 0;
    final available = int.tryParse((item['available_quantity'] ?? item['available_stock'])?.toString() ?? '${quantity - reserved}') ?? (quantity - reserved);
    final reorder = int.tryParse((item['reorder_level'] ?? item['reorderLevel'])?.toString() ?? '0') ?? 0;

    // Trạng thái tồn kho
    String statusLabel;
    Color statusColor;
    if (available <= 0) {
      statusLabel = 'Hết hàng';
      statusColor = AppTheme.error;
    } else if (reorder > 0 && available <= reorder) {
      statusLabel = 'Sắp hết hàng';
      statusColor = AppTheme.warning;
    } else {
      statusLabel = 'Còn hàng';
      statusColor = AppTheme.success;
    }

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Header info (Ảnh + Tên + SKU + Trạng thái)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: imgUrl != null && imgUrl.isNotEmpty
                      ? Image.network(imgUrl, fit: BoxFit.cover, errorBuilder: (context, error, stackTrace) => _imagePlaceholder())
                      : _imagePlaceholder(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textPrimary),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: AppTheme.bgLight,
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: AppTheme.border),
                          ),
                          child: Text(
                            sku,
                            style: const TextStyle(fontSize: 11, fontFamily: 'monospace', fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                          ),
                        ),
                        if (barcode != null && barcode.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              barcode,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppTheme.textHint),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: AppTheme.border),
          const SizedBox(height: 10),

          // Row 2: Thống kê số lượng (Tồn thực tế | Giữ chỗ | Khả dụng)
          Row(
            children: [
              Expanded(
                child: _stockMetric(
                  label: 'Tồn thực tế',
                  value: quantity.toString(),
                  color: AppTheme.textPrimary,
                ),
              ),
              Container(width: 1, height: 32, color: AppTheme.border),
              Expanded(
                child: _stockMetric(
                  label: 'Đang giữ',
                  value: reserved.toString(),
                  color: reserved > 0 ? AppTheme.warning : AppTheme.textHint,
                ),
              ),
              Container(width: 1, height: 32, color: AppTheme.border),
              Expanded(
                child: _stockMetric(
                  label: 'Khả dụng',
                  value: available.toString(),
                  color: available > 0 ? AppTheme.primary : AppTheme.error,
                  isBold: true,
                ),
              ),
            ],
          ),

          if (reorder > 0) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                'Ngưỡng an toàn: $reorder',
                style: const TextStyle(fontSize: 11, color: AppTheme.textHint),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _stockMetric({required String label, required String value, required Color color, bool isBold = false}) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppTheme.textHint, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w700,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _imagePlaceholder() {
    return Container(
      color: AppTheme.bgLight,
      child: const Center(
        child: Icon(Icons.inventory_2_outlined, size: 24, color: AppTheme.textHint),
      ),
    );
  }
}
