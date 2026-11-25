import '../../core/network/api_client.dart';

class CustomerService {
  // ── Catalog ──────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getCatalog({String? search, String? categoryId, int page = 1}) async {
    final params = {'page': page.toString(), 'limit': '20'};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (categoryId != null) params['categoryId'] = categoryId;
    final res = await ApiClient.get('/customer/catalog', params: params);
    return res as Map<String, dynamic>;
  }

  // ── Cart ────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getCart() async {
    final res = await ApiClient.get('/customer/cart');
    return res as Map<String, dynamic>;
  }

  static Future<void> upsertCartItem(String productId, int quantity) async {
    await ApiClient.put('/customer/cart/items', body: {'productId': productId, 'quantity': quantity});
  }

  static Future<void> removeCartItem(String productId) async {
    await ApiClient.delete('/customer/cart/items/$productId');
  }

  // ── Addresses ───────────────────────────────────────────────
  static Future<List<dynamic>> getAddresses() async {
    final res = await ApiClient.get('/customer/addresses');
    final data = res as Map<String, dynamic>;
    return data['data'] as List<dynamic>? ?? [];
  }

  static Future<Map<String, dynamic>> createAddress(Map<String, dynamic> body) async {
    final res = await ApiClient.post('/customer/addresses', body: body);
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<void> deleteAddress(String addressId) async {
    await ApiClient.delete('/customer/addresses/$addressId');
  }

  // ── Checkout ────────────────────────────────────────────────
  static Future<Map<String, dynamic>> checkout(Map<String, dynamic> body, {String? idempotencyKey}) async {
    final extraHeaders = idempotencyKey != null ? {'Idempotency-Key': idempotencyKey} : null;
    final res = await ApiClient.post('/customer/checkout', body: body, extraHeaders: extraHeaders);
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  // ── Orders ──────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getOrders({String? status, int page = 1}) async {
    final params = {'page': page.toString(), 'limit': '20'};
    if (status != null) params['status'] = status;
    final res = await ApiClient.get('/customer/orders', params: params);
    return res as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> getOrder(String orderId) async {
    final res = await ApiClient.get('/customer/orders/$orderId');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<void> cancelOrder(String orderId, {String? note}) async {
    await ApiClient.post('/customer/orders/$orderId/cancel', body: note != null ? {'note': note} : {});
  }
}
