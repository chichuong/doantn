import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../shipper_service.dart';
import 'shipment_detail_screen.dart';
import 'shipper_scan_screen.dart';

class ShipmentsScreen extends StatefulWidget {
  const ShipmentsScreen({super.key});

  @override
  State<ShipmentsScreen> createState() => _ShipmentsScreenState();
}

class _ShipmentsScreenState extends State<ShipmentsScreen> {
  final currencyFmt = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ');

  static const _filterTabs = [
    {'label': 'Tất cả', 'status': null},
    {'label': 'Chờ lấy', 'status': 'assigned'},
    {'label': 'Đã lấy', 'status': 'picked_up'},
    {'label': 'Đang giao', 'status': 'in_transit'},
    {'label': 'Đã giao', 'status': 'delivered'},
    {'label': 'Thất bại', 'status': 'failed'},
  ];

  int _selectedFilterIndex = 0;
  List<dynamic> _shipments = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchShipments();
  }

  Future<void> _fetchShipments() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final currentStatus = _filterTabs[_selectedFilterIndex]['status'];

    try {
      final res = await ShipperService.getShipments(
        status: currentStatus,
        page: 1,
        limit: 50,
      );
      final data = res['data'];
      setState(() {
        if (data is List) {
          _shipments = data;
        } else if (data is Map && data['shipments'] is List) {
          _shipments = data['shipments'] as List;
        } else {
          _shipments = [];
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

  void _goToDetail(String shipmentId) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ShipmentDetailScreen(shipmentId: shipmentId),
      ),
    );
    _fetchShipments();
  }

  void _openScanner() async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const ShipperScanScreen(),
      ),
    );
    _fetchShipments();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn giao hàng'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner, color: AppTheme.primary),
            tooltip: 'Quét mã vận đơn',
            onPressed: _openScanner,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _fetchShipments,
          ),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
            child: Row(
              children: List.generate(_filterTabs.length, (i) {
                final selected = _selectedFilterIndex == i;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    selected: selected,
                    label: Text(_filterTabs[i]['label']!),
                    onSelected: (_) {
                      if (_selectedFilterIndex != i) {
                        setState(() => _selectedFilterIndex = i);
                        _fetchShipments();
                      }
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
              }),
            ),
          ),
          const Divider(height: 10),
          Expanded(
            child: _isLoading
                ? const LoadingWidget(message: 'Đang tải danh sách vận đơn...')
                : _error != null
                    ? CustomErrorWidget(message: _error!, onRetry: _fetchShipments)
                    : _shipments.isEmpty
                        ? const EmptyStateWidget(
                            icon: Icons.local_shipping_outlined,
                            message: 'Không có vận đơn nào trong mục này',
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchShipments,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: _shipments.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 10),
                              itemBuilder: (context, idx) {
                                final item = _shipments[idx];
                                final id = item['id'].toString();
                                final tracking = item['tracking_number'] ?? 'N/A';
                                final orderNum = item['order_number'] ?? item['order_id'] ?? '';
                                final custName = item['customer_name'] ?? 'Khách hàng';
                                final custPhone = item['customer_phone']?.toString() ?? '';
                                final totalAmt = double.tryParse('${item['total_amount']}') ?? 0;
                                final status = item['status'] ?? 'assigned';

                                return AppCard(
                                  onTap: () => _goToDetail(id),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(Icons.local_shipping_outlined, size: 17, color: AppTheme.primary),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              tracking,
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          StatusBadge(status: status),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Đơn: $orderNum',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(color: AppTheme.textHint, fontSize: 12),
                                      ),
                                      const Divider(height: 14),
                                      Row(
                                        children: [
                                          const Icon(Icons.person_outline, size: 16, color: AppTheme.textHint),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              custPhone.isNotEmpty ? '$custName • $custPhone' : custName,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          const Text('Thu tiền:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                                          const SizedBox(width: 6),
                                          Text(
                                            currencyFmt.format(totalAmt),
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primary),
                                          ),
                                          const Spacer(),
                                          const Text(
                                            'Chi tiết',
                                            style: TextStyle(color: AppTheme.primary, fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                          const Icon(Icons.chevron_right, size: 18, color: AppTheme.primary),
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
