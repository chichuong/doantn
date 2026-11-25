import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../shipper_service.dart';

class ShipmentDetailScreen extends StatefulWidget {
  final String shipmentId;
  const ShipmentDetailScreen({super.key, required this.shipmentId});

  @override
  State<ShipmentDetailScreen> createState() => _ShipmentDetailScreenState();
}

class _ShipmentDetailScreenState extends State<ShipmentDetailScreen> {
  Map<String, dynamic>? _shipment;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchDetail();
  }

  Future<void> _fetchDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final data = await ShipperService.getShipmentDetail(widget.shipmentId);
      setState(() {
        _shipment = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _updateStatus(String nextStatus, String actionTitle) async {
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(actionTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bạn có chắc chắn muốn chuyển trạng thái sang "$actionTitle"?'),
            const SizedBox(height: 12),
            TextField(
              controller: noteController,
              decoration: const InputDecoration(
                labelText: 'Ghi chú (tùy chọn)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Xác nhận', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isSubmitting = true);
    try {
      await ShipperService.updateStatus(
        widget.shipmentId,
        status: nextStatus,
        note: noteController.text.trim().isEmpty ? null : noteController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Đã cập nhật: $actionTitle thành công!')),
        );
        _fetchDetail();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: ${e.toString().replaceFirst('Exception: ', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _callCustomer(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể gọi đến số: $phone')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final currencyFmt = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ');

    return Scaffold(
      appBar: AppBar(
        title: Text(_shipment?['tracking_number'] ?? 'Chi tiết vận đơn'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading || _isSubmitting ? null : _fetchDetail,
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Đang tải thông tin vận đơn...')
          : _error != null
              ? CustomErrorWidget(message: _error!, onRetry: _fetchDetail)
              : _shipment == null
                  ? const EmptyStateWidget(message: 'Không tìm thấy vận đơn')
                  : Stack(
                      children: [
                        ListView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                          children: [
                            // Header card
                            AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          _shipment!['tracking_number'] ?? 'N/A',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.primary),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      StatusBadge(status: _shipment!['status'] ?? 'assigned'),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Đơn hàng: ${_shipment!['order_number'] ?? _shipment!['order_id'] ?? 'N/A'}',
                                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                                  ),
                                  if (_shipment!['carrier'] != null) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      'Đơn vị giao vận: ${_shipment!['carrier']}',
                                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Recipient & Delivery Address Card
                            const Text('Thông tin giao hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            const SizedBox(height: 8),
                            AppCard(
                              child: Column(
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
                                              _shipment!['customer_name'] ?? 'Khách hàng',
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              _shipment!['customer_phone'] ?? 'Chưa có SĐT',
                                              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (_shipment!['customer_phone'] != null)
                                        IconButton.filled(
                                          icon: const Icon(Icons.phone),
                                          style: IconButton.styleFrom(backgroundColor: AppTheme.primary),
                                          onPressed: () => _callCustomer(_shipment!['customer_phone']),
                                        ),
                                    ],
                                  ),
                                  const Divider(height: 24),
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.location_on_outlined, color: AppTheme.primary, size: 20),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          _formatAddress(_shipment!['address']),
                                          style: const TextStyle(fontSize: 14, height: 1.4),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Payment & COD Card
                            const Text('Thu tiền & Thanh toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            const SizedBox(height: 8),
                            AppCard(
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Tiền thu hộ (COD):', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                                  Text(
                                    currencyFmt.format(double.tryParse('${_shipment!['total_amount']}') ?? 0),
                                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primary),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),

                            // Timeline History
                            const Text('Lịch sử vận chuyển', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                            const SizedBox(height: 8),
                            AppCard(
                              child: _buildHistorySection(_shipment!['status_history']),
                            ),
                          ],
                        ),

                        // Bottom Action Buttons
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 10,
                                  offset: const Offset(0, -4),
                                ),
                              ],
                            ),
                            child: _buildActionButtons(_shipment!['status']),
                          ),
                        ),
                      ],
                    ),
    );
  }

  String _formatAddress(dynamic address) {
    if (address == null) return 'Địa chỉ không khả dụng';
    if (address is String) return address;
    if (address is Map) {
      if (address['full_address'] != null && address['full_address'].toString().trim().isNotEmpty) {
        return address['full_address'].toString().trim();
      }
      final parts = [
        address['address_line'] ?? address['street'] ?? address['address_line1'] ?? address['address'],
        address['ward'] ?? address['ward_name'],
        address['district'] ?? address['district_name'],
        address['province'] ?? address['city'] ?? address['province_name'],
      ].where((p) => p != null && p.toString().isNotEmpty).toList();
      return parts.isEmpty ? 'Địa chỉ khách hàng' : parts.join(', ');
    }
    return address.toString();
  }

  Widget _buildHistorySection(dynamic history) {
    if (history == null || history is! List || history.isEmpty) {
      return const Text('Chưa có lịch sử trạng thái', style: TextStyle(color: AppTheme.textHint));
    }
    return Column(
      children: history.map<Widget>((h) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.circle, size: 10, color: AppTheme.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _statusLabel(h['status']),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    if (h['note'] != null && h['note'].toString().isNotEmpty)
                      Text(
                        h['note'],
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                      ),
                  ],
                ),
              ),
              Text(
                (h['created_at'] ?? '').toString().replaceFirst('T', ' ').split('.').first,
                style: const TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildActionButtons(String? status) {
    if (_isSubmitting) {
      return const Center(child: CircularProgressIndicator());
    }

    switch (status) {
      case 'assigned':
        return PrimaryButton(
          label: 'Nhận hàng từ kho',
          icon: Icons.inventory_2_outlined,
          onPressed: () => _updateStatus('picked_up', 'Nhận hàng từ kho'),
        );
      case 'picked_up':
        return PrimaryButton(
          label: 'Bắt đầu giao hàng',
          icon: Icons.local_shipping_outlined,
          color: AppTheme.primary,
          onPressed: () => _updateStatus('in_transit', 'Bắt đầu giao hàng'),
        );
      case 'in_transit':
        return Row(
          children: [
            Expanded(
              child: PrimaryButton(
                label: 'Thất bại',
                icon: Icons.cancel_outlined,
                color: AppTheme.error,
                onPressed: () => _updateStatus('failed', 'Giao thất bại'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: PrimaryButton(
                label: 'Giao thành công',
                icon: Icons.check_circle_outline,
                color: AppTheme.success,
                onPressed: () => _updateStatus('delivered', 'Giao thành công'),
              ),
            ),
          ],
        );
      case 'failed':
        return PrimaryButton(
          label: 'Hoàn trả hàng về kho',
          icon: Icons.replay,
          color: AppTheme.accent,
          onPressed: () => _updateStatus('returned', 'Hoàn trả về kho'),
        );
      case 'delivered':
        return const Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, color: AppTheme.success, size: 24),
              SizedBox(width: 8),
              Text('Đơn hàng đã giao thành công', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
        );
      case 'returned':
        return const Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.replay_circle_filled, color: AppTheme.accent, size: 24),
              SizedBox(width: 8),
              Text('Đơn hàng đã hoàn trả về kho', style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  String _statusLabel(dynamic status) {
    return switch (status?.toString()) {
      'assigned' => 'Đã phân công',
      'picked_up' => 'Đã nhận hàng từ kho',
      'in_transit' => 'Đang giao hàng',
      'delivered' => 'Giao thành công',
      'failed' => 'Giao thất bại',
      'returned' => 'Đã hoàn trả về kho',
      _ => status?.toString() ?? 'Không rõ',
    };
  }
}
