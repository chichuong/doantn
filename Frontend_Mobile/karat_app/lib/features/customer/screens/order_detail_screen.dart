import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../customer_service.dart';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;
  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;
  Timer? _liveTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _liveTimer = Timer.periodic(const Duration(seconds: 4), (_) => _silentRefresh());
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    super.dispose();
  }

  Future<void> _silentRefresh() async {
    final currentStatus = _order?['status']?.toString() ?? '';
    if (['delivered', 'cancelled', 'returned'].contains(currentStatus)) return;
    try {
      final updated = await CustomerService.getOrder(widget.orderId);
      if (!mounted) return;
      final newStatus = updated['status']?.toString() ?? '';
      setState(() => _order = updated);
      if (currentStatus.isNotEmpty && newStatus.isNotEmpty && currentStatus != newStatus) {
        showSnack(context, 'Đơn hàng vừa chuyển sang: ${newStatus.orderStatusLabel}');
      }
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final order = await CustomerService.getOrder(widget.orderId);
      setState(() { _order = order; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _cancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.card,
        title: const Text('Hủy đơn hàng', style: TextStyle(color: AppTheme.textPrimary)),
        content: const Text('Bạn chắc chắn muốn hủy đơn hàng này?', style: TextStyle(color: AppTheme.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Không')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Hủy đơn', style: TextStyle(color: AppTheme.error))),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await CustomerService.cancelOrder(widget.orderId, note: 'Khách hàng yêu cầu hủy đơn');
      await _load();
      if (mounted) showSnack(context, 'Đã hủy đơn hàng');
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Chi tiết đơn hàng')),
        body: _loading
            ? const FullScreenLoader()
            : _error != null
                ? ErrorState(message: _error!, onRetry: _load)
                : _buildContent(),
      );

  Widget _buildContent() {
    final o = _order!;
    final status = o['status'] as String? ?? '';
    final orderNumber = o['order_number'] ?? o['orderNumber'] ?? '';
    final createdAt = o['created_at'] ?? o['createdAt'];
    final items = (o['items'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    final history = (o['status_history'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
    final shipment = o['shipment'] as Map<String, dynamic>?;
    final total = o['total_amount'] ?? o['totalAmount'] ?? 0;
    final canCancel = ['pending', 'confirmed'].contains(status);

    return RefreshIndicator(
      onRefresh: _load,
      color: AppTheme.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Animated Order Tracking Card (Shopee / Grab style)
            _AnimatedOrderTracker(
              status: status,
              trackingNumber: shipment?['tracking_number']?.toString(),
              history: history,
            ),
            const SizedBox(height: 12),
            // Header
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text('Đơn hàng #$orderNumber',
                            style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 16),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 2),
                      ),
                      const SizedBox(width: 8),
                      StatusBadge(label: status.orderStatusLabel, color: status.orderStatusColor),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text('Ngày đặt: ${formatDate(createdAt, withTime: true)}',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(
                    'Thanh toán: ${(o['payment_method'] ?? o['paymentMethod']) == 'transfer' ? 'Chuyển khoản QR (VietQR) • Đã thanh toán' : 'Tiền mặt khi nhận hàng (COD)'}',
                    style: TextStyle(
                      color: (o['payment_method'] ?? o['paymentMethod']) == 'transfer' ? AppTheme.success : AppTheme.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            // Items
            SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Sản phẩm', style: TextStyle(color: AppTheme.textSecondary, fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 10),
                  ...items.map((item) {
                    final imgUrl = (item['image_url'] ?? item['imageUrl'] ?? '').toString();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 42,
                              height: 42,
                              color: AppTheme.surfaceVariant,
                              child: imgUrl.isNotEmpty
                                  ? Image.network(imgUrl, fit: BoxFit.contain,
                                      errorBuilder: (_, _, _) => const Icon(Icons.image_outlined, size: 18, color: AppTheme.textHint))
                                  : const Icon(Icons.image_outlined, size: 18, color: AppTheme.textHint),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              (item['name'] ?? item['product_name'] ?? item['productName'] ?? 'Sản phẩm').toString(),
                              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w500),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text('x${item['quantity']}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                          const SizedBox(width: 12),
                          Text(formatCurrency((double.tryParse(item['unit_price']?.toString() ?? '0') ?? 0) * (item['quantity'] as num? ?? 1)),
                              style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                        ],
                      ),
                    );
                  }),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Tổng cộng', style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600)),
                      Text(formatCurrency(total), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 17)),
                    ],
                  ),
                ],
              ),
            ),
            if (canCancel) ...[
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _cancel,
                  icon: const Icon(Icons.cancel_outlined, color: AppTheme.error),
                  label: const Text('Hủy đơn hàng', style: TextStyle(color: AppTheme.error)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.error),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AnimatedOrderTracker extends StatefulWidget {
  final String status;
  final String? trackingNumber;
  final List<Map<String, dynamic>> history;

  const _AnimatedOrderTracker({
    required this.status,
    this.trackingNumber,
    required this.history,
  });

  @override
  State<_AnimatedOrderTracker> createState() => _AnimatedOrderTrackerState();
}

class _AnimatedOrderTrackerState extends State<_AnimatedOrderTracker>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;

  static const _steps = [
    {'key': 'pending', 'label': 'Đặt đơn', 'icon': Icons.receipt_long_rounded},
    {'key': 'confirmed', 'label': 'Xác nhận', 'icon': Icons.fact_check_rounded},
    {'key': 'packed', 'label': 'Đóng gói', 'icon': Icons.inventory_2_rounded},
    {'key': 'shipping', 'label': 'Đang giao', 'icon': Icons.local_shipping_rounded},
    {'key': 'delivered', 'label': 'Đã nhận', 'icon': Icons.verified_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  int _resolveStageIndex(String st) {
    switch (st) {
      case 'pending':
        return 0;
      case 'confirmed':
        return 1;
      case 'ready_to_pack':
      case 'packed':
        return 2;
      case 'handover':
      case 'shipping':
        return 3;
      case 'delivered':
        return 4;
      default:
        return -1;
    }
  }

  String _resolveDescription(String st) {
    switch (st) {
      case 'pending':
        return 'Đơn hàng đang chờ cửa hàng xác nhận & giữ tồn kho';
      case 'confirmed':
        return 'Cửa hàng đã xác nhận đơn hàng của bạn';
      case 'ready_to_pack':
        return 'Nhân viên kho đang lấy hàng trên kệ';
      case 'packed':
        return 'Kiện hàng đã quét barcode & đóng gói xong';
      case 'handover':
        return 'Kiện hàng đã bàn giao cho Shipper vận chuyển';
      case 'shipping':
        return 'Shipper đang trên đường giao kiện hàng đến bạn!';
      case 'delivered':
        return 'Giao hàng thành công! Cảm ơn bạn đã mua sắm tại Karat';
      case 'cancelled':
        return 'Đơn hàng đã hủy và hoàn lại tồn kho giữ chỗ';
      case 'returned':
        return 'Đơn hàng đã được hoàn trả về kho';
      default:
        return 'Đang cập nhật trạng thái đơn hàng';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCancelled = widget.status == 'cancelled';
    final isReturned = widget.status == 'returned';
    final stageIdx = _resolveStageIndex(widget.status);
    final progress = (isCancelled || isReturned || stageIdx < 0)
        ? 0.0
        : (stageIdx / (_steps.length - 1)).clamp(0.0, 1.0);

    final activeIcon = isCancelled
        ? Icons.cancel_rounded
        : isReturned
            ? Icons.assignment_return_rounded
            : (_steps[stageIdx.clamp(0, _steps.length - 1)]['icon'] as IconData);

    final bannerColors = isCancelled
        ? [const Color(0xFFDC2626), const Color(0xFF991B1B)]
        : isReturned
            ? [const Color(0xFFD97706), const Color(0xFFB45309)]
            : widget.status == 'delivered'
                ? [const Color(0xFF059669), const Color(0xFF047857)]
                : [const Color(0xFF2563EB), const Color(0xFF1D4ED8)];

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Thanh Tiến trình 5 bước đặt lên đầu gọn gàng
          if (!isCancelled && !isReturned)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
              child: Column(
                children: [
                  Stack(
                    alignment: Alignment.centerLeft,
                    children: [
                      // Track Background
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Container(
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppTheme.border,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                      // Animated Fill Bar
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween<double>(begin: 0, end: progress),
                          duration: const Duration(milliseconds: 900),
                          curve: Curves.easeOutCubic,
                          builder: (ctx, val, _) => FractionallySizedBox(
                            widthFactor: val,
                            child: Container(
                              height: 4,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF10B981), Color(0xFF2563EB)],
                                ),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                        ),
                      ),
                      // Step Circles
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(_steps.length, (i) {
                          final step = _steps[i];
                          final isDone = i < stageIdx;
                          final isCurrent = i == stageIdx;
                          return AnimatedBuilder(
                            animation: _pulseCtrl,
                            builder: (_, _) => Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isCurrent
                                    ? AppTheme.primary
                                    : isDone
                                        ? AppTheme.success
                                        : AppTheme.surfaceVariant,
                                border: Border.all(
                                  color: isCurrent
                                      ? AppTheme.primary.withValues(alpha: 0.35 + 0.35 * _pulseCtrl.value)
                                      : isDone
                                          ? AppTheme.success
                                          : AppTheme.border,
                                  width: isCurrent ? 4 : 1.5,
                                ),
                                boxShadow: isCurrent
                                    ? [
                                        BoxShadow(
                                          color: AppTheme.primary.withValues(alpha: 0.35 * _pulseCtrl.value),
                                          blurRadius: 10,
                                          spreadRadius: 2,
                                        ),
                                      ]
                                    : null,
                              ),
                              child: Icon(
                                isDone ? Icons.check_rounded : (step['icon'] as IconData),
                                size: 17,
                                color: (isDone || isCurrent) ? Colors.white : AppTheme.textHint,
                              ),
                            ),
                          );
                        }),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(_steps.length, (i) {
                      final step = _steps[i];
                      final isDone = i < stageIdx;
                      final isCurrent = i == stageIdx;
                      return SizedBox(
                        width: 56,
                        child: Text(
                          step['label'] as String,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isCurrent ? FontWeight.bold : (isDone ? FontWeight.w600 : FontWeight.normal),
                            color: isCurrent
                                ? AppTheme.primary
                                : isDone
                                    ? AppTheme.success
                                    : AppTheme.textHint,
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),

          // 2. Khung Video Hoạt Cảnh Cỡ Lớn (Thay thế cho Lịch sử chuyển đổi trạng thái)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: bannerColors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                      ),
                      child: Icon(activeIcon, color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.22),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  isCancelled || isReturned
                                      ? widget.status.orderStatusLabel
                                      : 'Tiến độ: Bước ${stageIdx + 1}/${_steps.length} (${(progress * 100).round()}%)',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (widget.trackingNumber != null && widget.trackingNumber!.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Text(
                                    'Mã vận đơn: ${widget.trackingNumber}',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.status.orderStatusLabel,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _resolveDescription(widget.status),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Sân khấu Video Cartoon 60fps cỡ lớn
                if (!isCancelled && !isReturned)
                  Container(
                    width: double.infinity,
                    height: 175,
                    margin: const EdgeInsets.only(top: 14),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                    ),
                    child: AnimatedBuilder(
                      animation: _pulseCtrl,
                      builder: (_, _) => CustomPaint(
                        painter: _OrderCartoonScenePainter(
                          status: widget.status,
                          progress: _pulseCtrl.value,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OrderCartoonScenePainter extends CustomPainter {
  final String status;
  final double progress;

  _OrderCartoonScenePainter({
    required this.status,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;

    // Phóng to toàn bộ nhân vật & cảnh vật 1.38x để lấp đầy khung Video cỡ lớn
    canvas.save();
    canvas.translate(cx, cy);
    canvas.scale(1.38);
    canvas.translate(-cx, -cy);
    _paintScene(canvas, size, cx, cy);
    canvas.restore();
  }

  void _paintScene(Canvas canvas, Size size, double cx, double cy) {
    final wave = math.sin(progress * 2 * math.pi);

    // 1. Chờ xác nhận / Đã xác nhận: Nhân viên cầm cuốn sổ Checklist tích chọn & ký bút
    if (status == 'pending' || status == 'confirmed') {
      final floatY = wave * 3.5;

      // Nhân viên bên trái
      final headCenter = Offset(cx - 56, cy - 8 + floatY);
      canvas.drawCircle(headCenter, 14, Paint()..color = const Color(0xFFFDE68A));
      // Tóc
      canvas.drawArc(
        Rect.fromCircle(center: Offset(headCenter.dx, headCenter.dy - 2), radius: 14),
        math.pi,
        math.pi,
        true,
        Paint()..color = const Color(0xFF1E293B),
      );
      // Áo đồng phục
      final bodyRect = RRect.fromRectAndCorners(
        Rect.fromCenter(center: Offset(cx - 56, cy + 24 + floatY), width: 42, height: 28),
        topLeft: const Radius.circular(18),
        topRight: const Radius.circular(18),
      );
      canvas.drawRRect(bodyRect, Paint()..color = const Color(0xFF38BDF8));

      // Cuốn sổ / Bảng Checklist ở giữa
      final boardRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx + 12, cy + 2 + floatY), width: 68, height: 82),
        const Radius.circular(8),
      );
      canvas.drawRRect(boardRect, Paint()..color = Colors.white);
      canvas.drawRRect(
        boardRect,
        Paint()
          ..color = const Color(0xFFCBD5E1)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
      // Kẹp sắt vàng trên đầu sổ
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(cx + 12, cy - 39 + floatY), width: 26, height: 9),
          const Radius.circular(4),
        ),
        Paint()..color = const Color(0xFFFBBF24),
      );

      // 3 dòng task trên cuốn sổ + tích xanh chạy lần lượt
      for (int i = 0; i < 3; i++) {
        final rowY = cy - 18 + (i * 20) + floatY;
        final isChecked = status == 'confirmed' || progress > (i * 0.28);
        final circleColor = isChecked ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
        canvas.drawCircle(Offset(cx - 8, rowY), 6, Paint()..color = circleColor);

        if (isChecked) {
          final checkPath = Path()
            ..moveTo(cx - 11, rowY)
            ..lineTo(cx - 9, rowY + 2.5)
            ..lineTo(cx - 4.5, rowY - 2.5);
          canvas.drawPath(
            checkPath,
            Paint()
              ..color = Colors.white
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2
              ..strokeCap = StrokeCap.round,
          );
        }

        // Dòng chữ mô phỏng
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(cx + 3, rowY - 2.5, i == 1 ? 24 : 30, 5),
            const Radius.circular(2.5),
          ),
          Paint()..color = const Color(0xFF94A3B8),
        );
      }

      // Cây bút đang tích duyệt chuyển động theo dòng
      final penY = cy - 18 + ((progress * 3) % 3) * 16 + floatY;
      final penX = cx + 42 + math.sin(progress * 4 * math.pi) * 4;
      canvas.save();
      canvas.translate(penX, penY);
      canvas.rotate(0.6);
      canvas.drawRRect(
        RRect.fromRectAndRadius(const Rect.fromLTWH(-4, -14, 8, 28), const Radius.circular(3)),
        Paint()..color = const Color(0xFFF97316),
      );
      canvas.restore();
      return;
    }

    // 2. Đóng gói kho: Băng chuyền + Thùng Carton + Tia Laser đỏ quét Barcode
    if (status == 'ready_to_pack' || status == 'packed') {
      final bounceY = wave * 2.5;

      // Băng chuyền kho
      final beltRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, cy + 36), width: 180, height: 12),
        const Radius.circular(6),
      );
      canvas.drawRRect(beltRect, Paint()..color = const Color(0xFF1E293B));
      for (int i = -2; i <= 2; i++) {
        canvas.drawCircle(
          Offset(cx + i * 34, cy + 36),
          3.5,
          Paint()..color = const Color(0xFF94A3B8),
        );
      }

      // Thùng hàng Carton
      final boxRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, cy + 2 + bounceY), width: 78, height: 54),
        const Radius.circular(7),
      );
      canvas.drawRRect(boxRect, Paint()..color = const Color(0xFFFBBF24));
      canvas.drawRRect(
        boxRect,
        Paint()
          ..color = const Color(0xFFD97706)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );
      // Băng keo giữa thùng
      canvas.drawRect(
        Rect.fromLTWH(cx - 7, cy - 25 + bounceY, 14, 20),
        Paint()..color = const Color(0xFFFEF3C7),
      );
      // Tem Barcode trắng
      final barcodeRect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(cx, cy + 12 + bounceY), width: 48, height: 18),
        const Radius.circular(3),
      );
      canvas.drawRRect(barcodeRect, Paint()..color = Colors.white);
      for (int i = 0; i < 9; i++) {
        canvas.drawRect(
          Rect.fromLTWH(cx - 19 + i * 4.5, cy + 6 + bounceY, i.isEven ? 2.2 : 1.2, 12),
          Paint()..color = const Color(0xFF0F172A),
        );
      }

      // Tia Laser đỏ quét lên xuống
      final laserY = cy - 16 + ((wave + 1) / 2) * 38;
      canvas.drawLine(
        Offset(cx - 52, laserY),
        Offset(cx + 52, laserY),
        Paint()
          ..color = const Color(0xFFEF4444)
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round,
      );
      return;
    }

    // 3. Shipper chạy xe tay ga giao hàng trên đường
    if (status == 'handover' || status == 'shipping') {
      final rideBounce = math.sin(progress * 4 * math.pi) * 2.5;
      final roadY = cy + 38;

      // Mặt đường + vạch kẻ đường chạy lùi liên tục
      canvas.drawLine(
        Offset(cx - 105, roadY),
        Offset(cx + 105, roadY),
        Paint()
          ..color = Colors.white.withValues(alpha: 0.35)
          ..strokeWidth = 3,
      );
      final dashOffset = (progress * 60) % 24;
      for (double x = cx - 95 - dashOffset; x < cx + 95; x += 24) {
        if (x > cx - 100 && x < cx + 90) {
          canvas.drawLine(
            Offset(x, roadY),
            Offset(x + 12, roadY),
            Paint()
              ..color = Colors.white
              ..strokeWidth = 3
              ..strokeCap = StrokeCap.round,
          );
        }
      }

      // Khói pô xe bay ra phía sau
      final smokeRadius = 4.0 + (progress * 7);
      canvas.drawCircle(
        Offset(cx - 52 - (progress * 22), cy + 20 - (progress * 8)),
        smokeRadius,
        Paint()..color = Colors.white.withValues(alpha: (1 - progress) * 0.65),
      );

      // Thùng hàng Karat sau yên xe
      final cargoRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - 46, cy - 14 + rideBounce, 30, 26),
        const Radius.circular(5),
      );
      canvas.drawRRect(cargoRect, Paint()..color = const Color(0xFFFBBF24));
      canvas.drawRRect(
        cargoRect,
        Paint()
          ..color = Colors.white
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2,
      );

      // Người Shipper đội mũ bảo hiểm xanh lá
      final riderHead = Offset(cx + 2, cy - 22 + rideBounce);
      canvas.drawCircle(riderHead, 10, Paint()..color = const Color(0xFFFDE68A));
      canvas.drawArc(
        Rect.fromCircle(center: Offset(riderHead.dx, riderHead.dy - 2), radius: 11),
        math.pi,
        math.pi,
        true,
        Paint()..color = const Color(0xFF10B981),
      );
      // Thân áo Shipper
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(cx - 10, cy - 10 + rideBounce, 22, 24),
          const Radius.circular(8),
        ),
        Paint()..color = const Color(0xFF38BDF8),
      );

      // Thân xe Scooter trắng-xanh
      final bikePath = Path()
        ..moveTo(cx - 40, cy + 12 + rideBounce)
        ..lineTo(cx + 12, cy + 12 + rideBounce)
        ..lineTo(cx + 26, cy - 4 + rideBounce)
        ..lineTo(cx + 36, cy - 4 + rideBounce)
        ..lineTo(cx + 44, cy + 22 + rideBounce)
        ..lineTo(cx - 36, cy + 22 + rideBounce)
        ..close();
      canvas.drawPath(bikePath, Paint()..color = Colors.white);

      // Chùm đèn pha vàng phía trước
      final beamPath = Path()
        ..moveTo(cx + 40, cy + 2 + rideBounce)
        ..lineTo(cx + 76, cy - 8 + rideBounce)
        ..lineTo(cx + 76, cy + 14 + rideBounce)
        ..close();
      canvas.drawPath(beamPath, Paint()..color = const Color(0xFFFDE047).withValues(alpha: 0.35));

      // 2 Bánh xe quay
      for (final wheelX in [cx - 26, cx + 34]) {
        final wheelCenter = Offset(wheelX, cy + 24 + rideBounce * 0.4);
        canvas.drawCircle(wheelCenter, 11, Paint()..color = const Color(0xFF0F172A));
        canvas.drawCircle(
          wheelCenter,
          11,
          Paint()
            ..color = Colors.white
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5,
        );
        canvas.drawCircle(wheelCenter, 4, Paint()..color = const Color(0xFF38BDF8));
      }
      return;
    }

    // 4. Giao hàng thành công: Hộp quà hoàn tất + Pháo hoa ngôi sao
    final popScale = 1.0 + wave * 0.05;
    canvas.save();
    canvas.translate(cx, cy);
    canvas.scale(popScale);

    // Các ngôi sao chúc mừng xung quanh
    final starOffsets = [
      const Offset(-58, -22),
      const Offset(58, -24),
      const Offset(-64, 18),
      const Offset(64, 20),
    ];
    for (int i = 0; i < starOffsets.length; i++) {
      final r = 3.5 + ((i.isEven ? wave : -wave) + 1) * 1.5;
      canvas.drawCircle(starOffsets[i], r, Paint()..color = const Color(0xFFFDE047));
    }

    // Hộp quà trắng nắp vàng
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(-32, -16, 64, 48), const Radius.circular(8)),
      Paint()..color = Colors.white,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(-36, -26, 72, 13), const Radius.circular(5)),
      Paint()..color = const Color(0xFFFDE047),
    );
    canvas.drawRect(const Rect.fromLTWH(-6, -26, 12, 58), Paint()..color = const Color(0xFFFBBF24));

    // Huy hiệu tích xanh hoàn tất
    const badgeCenter = Offset(24, 20);
    canvas.drawCircle(badgeCenter, 15, Paint()..color = const Color(0xFF10B981));
    canvas.drawCircle(
      badgeCenter,
      15,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
    final check = Path()
      ..moveTo(badgeCenter.dx - 6, badgeCenter.dy)
      ..lineTo(badgeCenter.dx - 1.5, badgeCenter.dy + 4.5)
      ..lineTo(badgeCenter.dx + 7, badgeCenter.dy - 4.5);
    canvas.drawPath(
      check,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.8
        ..strokeCap = StrokeCap.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OrderCartoonScenePainter oldDelegate) =>
      oldDelegate.status != status || oldDelegate.progress != progress;
}
