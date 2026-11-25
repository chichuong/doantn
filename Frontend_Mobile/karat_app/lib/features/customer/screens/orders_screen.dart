import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../customer_service.dart';
import 'order_detail_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  static const _tabs = [
    (label: 'Tất cả', status: null),
    (label: 'Chờ xác nhận', status: 'pending'),
    (label: 'Đang xử lý', status: 'confirmed'),
    (label: 'Đang giao', status: 'shipping'),
    (label: 'Đã giao', status: 'delivered'),
    (label: 'Đã hủy', status: 'cancelled'),
  ];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Đơn hàng của tôi'),
          bottom: TabBar(
            controller: _tabCtrl,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppTheme.primary,
            unselectedLabelColor: AppTheme.textHint,
            indicatorColor: AppTheme.primary,
            tabs: _tabs.map((t) => Tab(text: t.label)).toList(),
          ),
        ),
        body: TabBarView(
          controller: _tabCtrl,
          children: _tabs.map((t) => _OrderList(status: t.status)).toList(),
        ),
      );
}

class _OrderList extends StatefulWidget {
  final String? status;
  const _OrderList({this.status});
  @override
  State<_OrderList> createState() => _OrderListState();
}

class _OrderListState extends State<_OrderList> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

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
      final res = await CustomerService.getOrders(status: widget.status, page: _page);
      final data = (res['data'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      final total = (res['pagination'] as Map?)?['total'] as int? ?? 0;
      setState(() {
        if (reset) _orders = data; else _orders.addAll(data);
        _hasMore = _orders.length < total;
        _page++;
      });
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading && _orders.isEmpty) return const FullScreenLoader();
    if (_orders.isEmpty) return EmptyState(
      icon: Icons.receipt_long_outlined,
      title: 'Chưa có đơn hàng',
      subtitle: widget.status != null ? 'Không có đơn hàng trạng thái này' : null,
    );
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      color: AppTheme.primary,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _orders.length + (_hasMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (ctx, i) {
          if (i >= _orders.length) return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
          return _OrderTile(order: _orders[i], onRefresh: () => _load(reset: true));
        },
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback? onRefresh;
  const _OrderTile({required this.order, this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final status = order['status'] as String? ?? '';
    final orderNumber = order['order_number'] ?? order['orderNumber'] ?? '';
    final createdAt = order['created_at'] ?? order['createdAt'];
    final total = order['total_amount'] ?? order['totalAmount'] ?? 0;
    final itemCount = order['item_count'] ?? order['total_items'] ?? (order['items'] as List?)?.length ?? order['item_lines'] ?? 0;

    return GestureDetector(
      onTap: () async {
        await Navigator.push(context, MaterialPageRoute(
            builder: (_) => OrderDetailScreen(orderId: order['id'] as String? ?? '')));
        onRefresh?.call();
      },
      child: Container(
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
                    style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(label: status.orderStatusLabel, color: status.orderStatusColor),
              ],
            ),
            const SizedBox(height: 6),
            Text(formatDate(createdAt, withTime: true), style: const TextStyle(color: AppTheme.textHint, fontSize: 12)),
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('$itemCount sản phẩm', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                Text(formatCurrency(total), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 15)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
