import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  const ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ApiClient {
  static String? _token;
  static const Duration timeoutDuration = Duration(seconds: 12);

  static void setToken(String? token) => _token = token;
  static String? get token => _token;

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static Uri _uri(String path, [Map<String, dynamic>? params]) {
    final uri = Uri.parse('${AppConstants.baseUrl}$path');
    if (params != null && params.isNotEmpty) {
      return uri.replace(queryParameters: params.map((k, v) => MapEntry(k, v.toString())));
    }
    return uri;
  }

  static dynamic _parse(http.Response res) {
    dynamic body;
    try {
      body = jsonDecode(res.body);
    } catch (_) {
      body = {'message': res.reasonPhrase ?? 'Lỗi không xác định'};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    final msg = body is Map ? (body['message'] ?? body['error'] ?? 'Lỗi không xác định') : 'Lỗi không xác định';
    throw ApiException(res.statusCode, msg.toString());
  }

  static Future<dynamic> get(String path, {Map<String, dynamic>? params}) async {
    try {
      final res = await http.get(_uri(path, params), headers: _headers).timeout(timeoutDuration);
      return _parse(res);
    } on TimeoutException {
      throw const ApiException(408, 'Hết thời gian chờ máy chủ (Timeout 6s). Kiểm tra kết nối mạng hoặc IP backend.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(503, 'Không thể kết nối máy chủ: $e');
    }
  }

  static Future<dynamic> post(String path, {Map<String, dynamic>? body, Map<String, String>? extraHeaders}) async {
    try {
      final headers = {..._headers, ...?extraHeaders};
      final res = await http.post(_uri(path), headers: headers, body: jsonEncode(body ?? {})).timeout(timeoutDuration);
      return _parse(res);
    } on TimeoutException {
      throw const ApiException(408, 'Hết thời gian chờ máy chủ (Timeout 6s). Kiểm tra kết nối mạng hoặc IP backend.');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(503, 'Không thể kết nối máy chủ: $e');
    }
  }

  static Future<dynamic> put(String path, {Map<String, dynamic>? body}) async {
    try {
      final res = await http.put(_uri(path), headers: _headers, body: jsonEncode(body ?? {})).timeout(timeoutDuration);
      return _parse(res);
    } on TimeoutException {
      throw const ApiException(408, 'Hết thời gian chờ máy chủ (Timeout 6s).');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(503, 'Không thể kết nối máy chủ: $e');
    }
  }

  static Future<dynamic> patch(String path, {Map<String, dynamic>? body}) async {
    try {
      final res = await http.patch(_uri(path), headers: _headers, body: jsonEncode(body ?? {})).timeout(timeoutDuration);
      return _parse(res);
    } on TimeoutException {
      throw const ApiException(408, 'Hết thời gian chờ máy chủ (Timeout 6s).');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(503, 'Không thể kết nối máy chủ: $e');
    }
  }

  static Future<dynamic> delete(String path) async {
    try {
      final res = await http.delete(_uri(path), headers: _headers).timeout(timeoutDuration);
      return _parse(res);
    } on TimeoutException {
      throw const ApiException(408, 'Hết thời gian chờ máy chủ (Timeout 6s).');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(503, 'Không thể kết nối máy chủ: $e');
    }
  }
}
