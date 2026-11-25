import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../warehouse_service.dart';
import 'pack_order_screen.dart';

class WarehouseOrdersScreen extends StatefulWidget {
  const WarehouseOrdersScreen({super.key});
  @override
  State<WarehouseOrdersScreen> createState() => _WarehouseOrdersScreenState();
}

class _WarehouseOrdersScreenState extends State<WarehouseOrdersScreen> {
  List<Map<String, dynamic>> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) { _page = 1; _hasMore = true; }
    setState(() => _loading = true);
    try {
      final res = await WarehouseService.getOrders(status: 'ready_to_pack', page: _page);
      final data = (res['data'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      final total = (res['pagination'] as Map?)?['total'] as int? ?? 0;
      setState(() {
        if (reset) {
          _orders = data;
        } else {
          _orders.addAll(data);
        }
        _hasMore = _orders.length < total;
        _page++;
      });
    } catch (e) {
      if (mounted) showSnack(context, 'Lỗi tải đơn hàng: $e', isError: true);
    }
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Đơn cần đóng gói'),
          actions: [
            IconButton(icon: const Icon(Icons.refresh), onPressed: () => _load(reset: true)),
          ],
        ),
        body: _loading && _orders.isEmpty
            ? const FullScreenLoader(message: 'Đang tải đơn hàng...')
            : _orders.isEmpty
                ? const EmptyState(
                    icon: Icons.check_circle_outline,
                    title: 'Không có đơn nào cần đóng gói',
                    subtitle: 'Tất cả đơn hàng đã được xử lý',
                  )
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    color: AppTheme.primary,
                    child: ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _orders.length + (_hasMore ? 1 : 0),
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (ctx, i) {
                        if (i >= _orders.length) return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
                        return _OrderCard(order: _orders[i], onPacked: () => _load(reset: true));
                      },
                    ),
                  ),
      );
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onPacked;
  const _OrderCard({required this.order, required this.onPacked});

  @override
  Widget build(BuildContext context) {
    final orderNumber = order['order_number'] ?? order['orderNumber'] ?? '';
    final createdAt = order['created_at'] ?? order['createdAt'];
    final itemCount = (order['items'] as List?)?.length ?? order['item_count'] ?? 0;
    final status = order['status'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '#$orderNumber',
                  style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                ),
              ),
              const SizedBox(width: 8),
              StatusBadge(label: status.orderStatusLabel, color: status.orderStatusColor),
            ],
          ),
          const SizedBox(height: 4),
          Text('Ngày đặt: ${formatDate(createdAt, withTime: true)}', style: const TextStyle(color: AppTheme.textHint, fontSize: 12)),
          const SizedBox(height: 4),
          Text('$itemCount sản phẩm', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(
                      builder: (_) => PackOrderScreen(order: order, onPacked: onPacked))),
                  icon: const Icon(Icons.qr_code_scanner, size: 18),
                  label: const Text('Scan & Đóng gói'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
