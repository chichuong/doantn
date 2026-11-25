import 'package:uuid/uuid.dart';
import '../../core/network/api_client.dart';

class WarehouseService {
  static const _uuidGen = Uuid();
  // ── Inventory ───────────────────────────────────────────────
  static Future<Map<String, dynamic>> getInventory({String? warehouseId, String? search, bool lowStock = false, int page = 1, int limit = 20}) async {
    final params = {
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (warehouseId != null && warehouseId.isNotEmpty) params['warehouseId'] = warehouseId;
    if (search != null && search.trim().isNotEmpty) params['search'] = search.trim();
    if (lowStock) params['lowStock'] = 'true';
    final res = await ApiClient.get('/warehouse/inventory', params: params);
    return res as Map<String, dynamic>;
  }

  // ── Scan product ────────────────────────────────────────────
  static Future<Map<String, dynamic>> scanProduct(String identifier, {String? warehouseId}) async {
    final params = {'identifier': identifier};
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    final res = await ApiClient.get('/warehouse/scan', params: params);
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  // ── Orders ──────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getOrders({String? warehouseId, String? status, int page = 1}) async {
    final params = {'page': page.toString(), 'limit': '20'};
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    if (status != null) params['status'] = status;
    final res = await ApiClient.get('/warehouse/orders', params: params);
    return res as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> packOrder(String orderId, {String? warehouseId}) async {
    final res = await ApiClient.post('/warehouse/orders/$orderId/pack',
        body: warehouseId != null ? {'warehouseId': warehouseId} : {});
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>> getOrderCheck(String orderId) async {
    final res = await ApiClient.get('/warehouse/orders/$orderId/check');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>> scanOrderItem(String orderId, String identifier, {int quantity = 1}) async {
    final res = await ApiClient.post('/warehouse/orders/$orderId/scan',
        body: {'identifier': identifier, 'quantity': quantity, 'requestId': _uuid()});
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>?> getReturnReceipt(String orderId) async {
    final res = await ApiClient.get('/warehouse/orders/$orderId/return-receipt');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>?;
  }

  // ── Documents ───────────────────────────────────────────────
  static Future<Map<String, dynamic>> getDocuments({String? warehouseId, String? type, String? status, int page = 1}) async {
    final params = {'page': page.toString(), 'limit': '20'};
    if (warehouseId != null) params['warehouseId'] = warehouseId;
    if (type != null) params['type'] = type;
    if (status != null) params['status'] = status;
    final res = await ApiClient.get('/warehouse/documents', params: params);
    return res as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> getDocument(String documentId) async {
    final res = await ApiClient.get('/warehouse/documents/$documentId');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>> createDocument(Map<String, dynamic> body) async {
    final res = await ApiClient.post('/warehouse/documents', body: body);
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>> lookupDocumentByQr(String identifier) async {
    final res = await ApiClient.get('/warehouse/documents/lookup/${Uri.encodeComponent(identifier)}');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<Map<String, dynamic>> completeDocument(String documentId, {List<Map<String, dynamic>>? items}) async {
    final res = await ApiClient.post(
      '/warehouse/documents/$documentId/complete',
      body: items != null && items.isNotEmpty ? {'items': items} : {},
    );
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  static Future<List<dynamic>> getCatalogProducts() async {
    final res = await ApiClient.get('/catalog/products', params: {'limit': '100'});
    final data = res is Map<String, dynamic> ? res['data'] : res;
    if (data is List) return data;
    if (data is Map && data['products'] is List) return data['products'] as List;
    return [];
  }

  static Future<List<dynamic>> getWarehouses() async {
    try {
      final res = await ApiClient.get('/warehouses');
      final data = res is Map<String, dynamic> ? res['data'] : res;
      if (data is List) return data;
      return [];
    } catch (_) {
      return [];
    }
  }

  static String _uuid() => _uuidGen.v4();
}
