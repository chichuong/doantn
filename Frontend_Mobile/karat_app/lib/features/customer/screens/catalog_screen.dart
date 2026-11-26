import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common_widgets.dart';
import '../cart_provider.dart';
import '../customer_service.dart';
import 'product_detail_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});
  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _debounce;
  List<Map<String, dynamic>> _products = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 1;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _loadProducts(reset: true);
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
      if (!_loading && _hasMore) _loadProducts();
    }
  }

  Future<void> _loadProducts({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _page = 1;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final res = await CustomerService.getCatalog(search: _search, page: _page);
      final data = res['data'] as List<dynamic>? ?? [];
      final pagination = res['pagination'] as Map<String, dynamic>?;
      final total = pagination?['total'] as int? ?? 0;
      final newItems = data.cast<Map<String, dynamic>>();
      setState(() {
        if (reset) {
          _products = newItems;
        } else {
          _products.addAll(newItems);
        }
        _hasMore = _products.length < total;
        _page++;
      });
    } catch (e) {
      if (mounted) showSnack(context, 'Không tải được sản phẩm', isError: true);
    }
    setState(() => _loading = false);
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    final trimmed = v.trim();
    if (trimmed == _search) return;
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() => _search = trimmed);
      _loadProducts(reset: true);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const GradientText('Karat Retail',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          actions: [
            IconButton(icon: const Icon(Icons.refresh), onPressed: () => _loadProducts(reset: true)),
          ],
        ),
        body: Column(
          children: [
            _buildSearchBar(),
            Expanded(child: _buildGrid()),
          ],
        ),
      );

  Widget _buildSearchBar() => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
        child: TextField(
          controller: _searchCtrl,
          style: const TextStyle(color: AppTheme.textPrimary),
          decoration: InputDecoration(
            hintText: 'Tìm kiếm sản phẩm...',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _search.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _searchCtrl.clear();
                      _onSearch('');
                    },
                  )
                : null,
          ),
          onChanged: _onSearch,
        ),
      );

  Widget _buildGrid() {
    if (_loading && _products.isEmpty) return const FullScreenLoader(message: 'Đang tải sản phẩm...');
    if (_products.isEmpty) return EmptyState(
      icon: Icons.inventory_2_outlined,
      title: 'Không có sản phẩm',
      subtitle: _search.isNotEmpty ? 'Thử tìm với từ khóa khác' : null,
    );

    return RefreshIndicator(
      onRefresh: () => _loadProducts(reset: true),
      color: AppTheme.primary,
      child: GridView.builder(
        controller: _scrollCtrl,
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.7,
        ),
        itemCount: _products.length + (_hasMore ? 1 : 0),
        itemBuilder: (ctx, i) {
          if (i >= _products.length) {
            return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
          }
          return _ProductCard(product: _products[i]);
        },
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final id = product['id'] as String? ?? '';
    final name = product['name'] as String? ?? '';
    final price = double.tryParse((product['sale_price'] ?? product['price'] ?? product['selling_price'])?.toString() ?? '0') ?? 0;
    final imgUrl = product['image_url'] as String?;
    final stock = int.tryParse((product['available_quantity'] ?? product['available_stock'] ?? product['stock'])?.toString() ?? '0') ?? 0;
    final inCart = cart.items.firstWhere((i) => i.productId == id, orElse: () => CartItem(productId: '', productName: '', price: 0, quantity: 0)).quantity;

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ChangeNotifierProvider.value(
              value: cart,
              child: ProductDetailScreen(product: product),
            ),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                child: (imgUrl != null && imgUrl.isNotEmpty)
                    ? Container(
                        color: Colors.white,
                        padding: const EdgeInsets.all(6),
                        width: double.infinity,
                        child: Image.network(imgUrl, fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => _placeholder()),
                      )
                    : _placeholder(),
              ),
            ),
            // Info
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(formatCurrency(price),
                      style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text(
                    stock <= 0 ? 'Hết hàng' : (stock <= 5 ? 'Sắp hết hàng' : 'Còn hàng'),
                    style: TextStyle(
                      color: stock <= 0 ? AppTheme.error : (stock <= 5 ? AppTheme.warning : AppTheme.success),
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _AddToCartRow(productId: id, inCart: inCart, stock: stock),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _placeholder() => Container(
        color: AppTheme.surfaceVariant,
        child: const Center(child: Icon(Icons.image_outlined, color: AppTheme.textHint, size: 36)),
      );
}

class _AddToCartRow extends StatefulWidget {
  final String productId;
  final int inCart;
  final int stock;
  const _AddToCartRow({required this.productId, required this.inCart, required this.stock});

  @override
  State<_AddToCartRow> createState() => _AddToCartRowState();
}

class _AddToCartRowState extends State<_AddToCartRow> {
  bool _busy = false;

  Future<void> _add() async {
    if (widget.stock <= 0) return;
    setState(() => _busy = true);
    try {
      await context.read<CartProvider>().upsert(widget.productId, widget.inCart + 1);
    } catch (e) {
      if (mounted) showSnack(context, e.toString(), isError: true);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _remove() async {
    setState(() => _busy = true);
    try {
      if (widget.inCart <= 1) {
        await context.read<CartProvider>().remove(widget.productId);
      } else {
        await context.read<CartProvider>().upsert(widget.productId, widget.inCart - 1);
      }
    } catch (_) {}
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const SizedBox(height: 32, child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary))));
    if (widget.inCart == 0) {
      return SizedBox(
        width: double.infinity,
        height: 32,
        child: ElevatedButton.icon(
          onPressed: widget.stock > 0 ? _add : null,
          icon: const Icon(Icons.add_shopping_cart, size: 14),
          label: const Text('Thêm', style: TextStyle(fontSize: 12)),
          style: ElevatedButton.styleFrom(padding: EdgeInsets.zero),
        ),
      );
    }
    return Row(
      children: [
        _CircleBtn(icon: Icons.remove, onTap: _remove),
        Expanded(
          child: Center(
            child: Text('${widget.inCart}', style: const TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold)),
          ),
        ),
        _CircleBtn(icon: Icons.add, onTap: widget.inCart < widget.stock ? _add : null),
      ],
    );
  }
}

class _CircleBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  const _CircleBtn({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: onTap != null ? AppTheme.primary.withValues(alpha: 0.15) : AppTheme.border,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: onTap != null ? AppTheme.primary.withValues(alpha: 0.5) : AppTheme.border),
          ),
          child: Icon(icon, size: 16, color: onTap != null ? AppTheme.primary : AppTheme.textHint),
        ),
      );
}
