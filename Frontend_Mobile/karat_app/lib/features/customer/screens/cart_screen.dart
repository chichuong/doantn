import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../cart_provider.dart';
import 'checkout_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Giỏ hàng'),
        actions: [
          if (cart.items.isNotEmpty)
            TextButton(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    backgroundColor: AppTheme.card,
                    title: const Text('Xóa giỏ hàng', style: TextStyle(color: AppTheme.textPrimary)),
                    content: const Text('Bạn có chắc muốn xóa toàn bộ giỏ hàng?', style: TextStyle(color: AppTheme.textSecondary)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
                      TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Xóa', style: TextStyle(color: AppTheme.error))),
                    ],
                  ),
                );
                if (confirm == true) cart.clear();
              },
              child: const Text('Xóa tất cả', style: TextStyle(color: AppTheme.error, fontSize: 13)),
            ),
        ],
      ),
      body: cart.loading
          ? const FullScreenLoader()
          : cart.items.isEmpty
              ? EmptyState(
                  icon: Icons.shopping_cart_outlined,
                  title: 'Giỏ hàng trống',
                  subtitle: 'Hãy thêm sản phẩm vào giỏ hàng',
                  action: ElevatedButton.icon(
                    onPressed: () => context.go('/customer/home'),
                    icon: const Icon(Icons.store_outlined),
                    label: const Text('Khám phá sản phẩm'),
                  ),
                )
              : Column(
                  children: [
                    Expanded(child: _buildList(context, cart)),
                    _buildBottom(context, cart),
                  ],
                ),
    );
  }

  Widget _buildList(BuildContext context, CartProvider cart) => ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: cart.items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (ctx, i) => _CartItemTile(item: cart.items[i]),
      );

  Widget _buildBottom(BuildContext context, CartProvider cart) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AppTheme.surface,
          border: Border(top: BorderSide(color: AppTheme.border)),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tổng cộng:', style: TextStyle(color: AppTheme.textSecondary, fontSize: 15)),
                Text(formatCurrency(cart.totalAmount),
                    style: const TextStyle(color: AppTheme.primary, fontSize: 20, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 16),
            GradientButton(
              label: 'Tiến hành đặt hàng',
              icon: Icons.shopping_bag_outlined,
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CheckoutScreen(cartItems: cart.items))),
            ),
          ],
        ),
      );
}

class _CartItemTile extends StatefulWidget {
  final CartItem item;
  const _CartItemTile({required this.item});

  @override
  State<_CartItemTile> createState() => _CartItemTileState();
}

class _CartItemTileState extends State<_CartItemTile> {
  bool _busy = false;

  Future<void> _update(int newQty) async {
    setState(() => _busy = true);
    try {
      final cart = context.read<CartProvider>();
      if (newQty <= 0) {
        await cart.remove(widget.item.productId);
      } else {
        await cart.upsert(widget.item.productId, newQty);
      }
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.border),
        ),
        child: Row(
          children: [
            // Image
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 64,
                height: 64,
                color: AppTheme.surfaceVariant,
                child: widget.item.imageUrl != null
                    ? Image.network(widget.item.imageUrl!, fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const Icon(Icons.image_outlined, color: AppTheme.textHint))
                    : const Icon(Icons.image_outlined, color: AppTheme.textHint),
              ),
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.item.productName, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600)),
                  if (widget.item.quantity > 1)
                    Text('${formatCurrency(widget.item.price)} / sp',
                        style: const TextStyle(color: AppTheme.textHint, fontSize: 11)),
                  const SizedBox(height: 4),
                  Text(formatCurrency(widget.item.subtotal),
                      style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            // Qty controls
            _busy
                ? const SizedBox(width: 80, child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary))))
                : Row(
                    children: [
                      _Btn(icon: Icons.remove, onTap: () => _update(widget.item.quantity - 1)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Text('${widget.item.quantity}',
                            style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 15)),
                      ),
                      _Btn(icon: Icons.add, onTap: () => _update(widget.item.quantity + 1)),
                    ],
                  ),
          ],
        ),
      );
}

class _Btn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _Btn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
          ),
          child: Icon(icon, size: 16, color: AppTheme.primary),
        ),
      );
}
