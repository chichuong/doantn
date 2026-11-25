import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../network/api_client.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  AuthStatus _status = AuthStatus.unknown;
  UserModel? _user;
  String? _error;

  AuthStatus get status => _status;
  UserModel? get user => _user;
  String? get error => _error;
  bool get isLoggedIn => _status == AuthStatus.authenticated && _user != null;

  AuthProvider() {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token == null) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    ApiClient.setToken(token);
    try {
      final res = await ApiClient.get('/auth/me');
      final data = res['data'] as Map<String, dynamic>? ?? res as Map<String, dynamic>;
      _user = UserModel.fromJson(data);
      _status = AuthStatus.authenticated;
    } catch (_) {
      await _clearSession();
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _error = null;
    try {
      final res = await ApiClient.post('/auth/login', body: {'email': email, 'password': password});
      final auth = AuthResponse.fromJson(res as Map<String, dynamic>);
      ApiClient.setToken(auth.accessToken);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_token', auth.accessToken);
      _user = auth.user;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Không thể kết nối đến máy chủ';
      notifyListeners();
      return false;
    }
  }

  Future<Map<String, dynamic>?> sendRegisterOtp(String email) async {
    _error = null;
    try {
      final res = await ApiClient.post('/auth/register/send-otp', body: {'email': email});
      final map = res as Map<String, dynamic>;
      return map['data'] as Map<String, dynamic>? ?? map;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Không thể kết nối đến máy chủ';
      notifyListeners();
      return null;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    required String otp,
    String? phone,
  }) async {
    _error = null;
    try {
      await ApiClient.post('/auth/register', body: {
        'email': email,
        'password': password,
        'fullName': fullName,
        'otp': otp,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      });
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Không thể kết nối đến máy chủ';
      notifyListeners();
      return false;
    }
  }

  Future<Map<String, dynamic>?> sendForgotPasswordOtp(String email) async {
    _error = null;
    try {
      final res = await ApiClient.post('/auth/forgot-password', body: {'email': email});
      final map = res as Map<String, dynamic>;
      return map['data'] as Map<String, dynamic>? ?? map;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Không thể kết nối đến máy chủ';
      notifyListeners();
      return null;
    }
  }

  Future<bool> resetPasswordWithOtp({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    _error = null;
    try {
      await ApiClient.post('/auth/reset-password', body: {
        'email': email,
        'otp': otp,
        'newPassword': newPassword,
      });
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Không thể kết nối đến máy chủ';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _clearSession();
    notifyListeners();
  }

  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    ApiClient.setToken(null);
    _user = null;
    _status = AuthStatus.unauthenticated;
  }
}
