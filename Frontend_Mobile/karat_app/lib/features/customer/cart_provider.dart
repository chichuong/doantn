import 'package:flutter/foundation.dart';
import 'customer_service.dart';

class CartItem {
  final String productId;
  final String productName;
  final String? sku;
  final String? imageUrl;
  final double price;
  int quantity;

  CartItem({
    required this.productId,
    required this.productName,
    this.sku,
    this.imageUrl,
    required this.price,
    required this.quantity,
  });

  factory CartItem.fromJson(Map<String, dynamic> j) => CartItem(
        productId: j['product_id'] ?? j['productId'] ?? '',
        productName: j['product_name'] ?? j['productName'] ?? j['name'] ?? '',
        sku: j['sku'],
        imageUrl: j['image_url'] ?? j['imageUrl'],
        price: double.tryParse((j['sale_price'] ?? j['price'] ?? j['selling_price'])?.toString() ?? '0') ?? 0,
        quantity: int.tryParse(j['quantity']?.toString() ?? '1') ?? 1,
      );

  double get subtotal => price * quantity;
}

class CartProvider extends ChangeNotifier {
  List<CartItem> _items = [];
  bool _loading = false;
  String? _error;

  List<CartItem> get items => _items;
  bool get loading => _loading;
  String? get error => _error;
  int get totalItems => _items.fold(0, (sum, i) => sum + i.quantity);
  double get totalAmount => _items.fold(0.0, (sum, i) => sum + i.subtotal);

  Future<void> fetchCart() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final res = await CustomerService.getCart();
      final data = res['data'];
      final itemsJson = data is Map ? (data['items'] as List? ?? []) : [];
      _items = itemsJson.map((j) => CartItem.fromJson(j as Map<String, dynamic>)).toList();
    } catch (e) {
      _error = e.toString();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> upsert(String productId, int qty) async {
    await CustomerService.upsertCartItem(productId, qty);
    await fetchCart();
  }

  Future<void> remove(String productId) async {
    await CustomerService.removeCartItem(productId);
    _items.removeWhere((i) => i.productId == productId);
    notifyListeners();
  }

  void clear() {
    _items = [];
    notifyListeners();
  }
}
