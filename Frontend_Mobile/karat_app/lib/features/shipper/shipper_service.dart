import '../../core/network/api_client.dart';

class ShipperService {
  // ── Shipments List ──────────────────────────────────────────
  static Future<Map<String, dynamic>> getShipments({String? status, int page = 1, int limit = 20}) async {
    final params = {'page': page.toString(), 'limit': limit.toString()};
    if (status != null && status != 'all') params['status'] = status;
    final res = await ApiClient.get('/shipping/shipments', params: params);
    return res as Map<String, dynamic>;
  }

  // ── Shipment Detail ─────────────────────────────────────────
  static Future<Map<String, dynamic>> getShipmentDetail(String shipmentId) async {
    final res = await ApiClient.get('/shipping/shipments/$shipmentId');
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  // ── Scan Tracking Code ──────────────────────────────────────
  static Future<Map<String, dynamic>> scanTracking(String identifier) async {
    final res = await ApiClient.get('/shipping/scan', params: {'identifier': identifier});
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }

  // ── Update Shipment Status ──────────────────────────────────
  static Future<Map<String, dynamic>> updateStatus(
    String shipmentId, {
    required String status,
    String? note,
  }) async {
    final body = <String, dynamic>{'status': status};
    if (note != null && note.isNotEmpty) body['note'] = note;
    final res = await ApiClient.patch('/shipping/shipments/$shipmentId/status', body: body);
    return (res as Map<String, dynamic>)['data'] as Map<String, dynamic>? ?? res;
  }
}
