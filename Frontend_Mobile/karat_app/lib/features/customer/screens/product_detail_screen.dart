import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../cart_provider.dart';

class ProductDetailScreen extends StatefulWidget {
  final Map<String, dynamic> product;
  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _quantity = 1;
  bool _busy = false;

  Future<void> _addToCart({
    required String id,
    required String name,
    required int inCart,
    required int effectiveQty,
    required int stock,
    required int maxAddable,
  }) async {
    if (_busy || stock <= 0 || maxAddable <= 0) return;
    setState(() => _busy = true);
    try {
      await context.read<CartProvider>().upsert(id, inCart + effectiveQty);
      if (!mounted) return;
      setState(() => _quantity = 1);
      showSnack(context, 'Đã thêm $effectiveQty "$name" vào giỏ hàng');
    } catch (e) {
      if (!mounted) return;
      showSnack(context, e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final cart = context.watch<CartProvider>();
    final id = p['id'] as String? ?? '';
    final name = p['name'] as String? ?? '';
    final sku = p['sku'] as String? ?? '';
    final barcode = p['barcode'] as String? ?? '';
    final categoryName = p['category_name'] as String? ?? '';
    final description = (p['description'] as String?)?.trim() ?? '';
    final imgUrl = (p['image_url'] ?? p['imageUrl']) as String?;
    final price = double.tryParse(
            (p['sale_price'] ?? p['price'] ?? p['selling_price'])?.toString() ?? '0') ??
        0;
    final stock = int.tryParse(
            (p['available_quantity'] ?? p['available_stock'] ?? p['stock'])?.toString() ?? '0') ??
        0;

    final inCart = cart.items
        .firstWhere(
          (i) => i.productId == id,
          orElse: () => CartItem(productId: '', productName: '', price: 0, quantity: 0),
        )
        .quantity;

    final maxAddable = (stock - inCart).clamp(0, stock);
    final effectiveQty = maxAddable <= 0 ? 0 : _quantity.clamp(1, maxAddable);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết sản phẩm'),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined),
                onPressed: () {
                  Navigator.pop(context);
                  context.go('/customer/cart');
                },
              ),
              if (cart.totalItems > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${cart.totalItems}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Image
                  Container(
                    width: double.infinity,
                    height: 260,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: (imgUrl != null && imgUrl.isNotEmpty)
                          ? Padding(
                              padding: const EdgeInsets.all(16),
                              child: Image.network(
                                imgUrl,
                                fit: BoxFit.contain,
                                errorBuilder: (_, _, _) => _imagePlaceholder(),
                              ),
                            )
                          : _imagePlaceholder(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Category & Stock badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          categoryName.isNotEmpty ? categoryName.toUpperCase() : 'SẢN PHẨM',
                          style: const TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.6,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: (stock <= 0
                                  ? AppTheme.error
                                  : (stock <= 5 ? AppTheme.warning : AppTheme.success))
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          stock <= 0 ? 'Hết hàng' : 'Còn $stock sản phẩm',
                          style: TextStyle(
                            color: stock <= 0
                                ? AppTheme.error
                                : (stock <= 5 ? AppTheme.warning : AppTheme.success),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Product Name & Price
                  Text(
                    name,
                    style: const TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formatCurrency(price),
                    style: const TextStyle(
                      color: AppTheme.primary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),

                  if (inCart > 0) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceVariant,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppTheme.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shopping_bag_outlined, size: 16, color: AppTheme.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Hiện có $inCart sản phẩm này trong giỏ hàng.',
                              style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 18),
                  const Text(
                    'Mô tả sản phẩm',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    description.isNotEmpty
                        ? description
                        : 'Sản phẩm chính hãng tại Karat Retail, đảm bảo chất lượng và đồng bộ tồn kho theo thời gian thực.',
                    style: const TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),

                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Thông tin chi tiết',
                          style: TextStyle(
                            color: AppTheme.textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        _specRow('Mã SKU', sku.isNotEmpty ? sku : '—'),
                        _specRow('Mã vạch', barcode.isNotEmpty ? barcode : '—'),
                        _specRow('Danh mục', categoryName.isNotEmpty ? categoryName : 'Chưa phân loại'),
                        _specRow('Tồn kho', stock > 0 ? '$stock sản phẩm' : 'Tạm hết hàng', isLast: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Add to Cart Bar
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: const BoxDecoration(
              color: AppTheme.surface,
              border: Border(top: BorderSide(color: AppTheme.border)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          onPressed: (stock <= 0 || effectiveQty <= 1)
                              ? null
                              : () => setState(() => _quantity = effectiveQty - 1),
                        ),
                        Text(
                          '$effectiveQty',
                          style: const TextStyle(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          onPressed: (stock <= 0 || effectiveQty >= maxAddable)
                              ? null
                              : () => setState(() => _quantity = effectiveQty + 1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: (_busy || stock <= 0 || maxAddable <= 0)
                            ? null
                            : () => _addToCart(
                                  id: id,
                                  name: name,
                                  inCart: inCart,
                                  effectiveQty: effectiveQty,
                                  stock: stock,
                                  maxAddable: maxAddable,
                                ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.add_shopping_cart_outlined, size: 18),
                        label: Text(
                          stock <= 0
                              ? 'Tạm hết hàng'
                              : maxAddable <= 0
                                  ? 'Đã đạt tối đa'
                                  : 'Thêm vào giỏ',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _specRow(String label, String value, {bool isLast = false}) => Padding(
        padding: EdgeInsets.only(bottom: isLast ? 0 : 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            Text(value, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _imagePlaceholder() => Container(
        color: AppTheme.surfaceVariant,
        child: const Center(child: Icon(Icons.image_outlined, color: AppTheme.textHint, size: 48)),
      );
}
