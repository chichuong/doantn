import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common_widgets.dart';
import '../../router.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _autoDetectServer();
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  // Âm thầm dò địa chỉ máy chủ phù hợp khi chạy trên thiết bị thật
  Future<void> _autoDetectServer() async {
    final candidates = <String>[
      AppConstants.cloudBaseUrl,
      AppConstants.baseUrl,
      if (defaultTargetPlatform == TargetPlatform.android) ...[
        'http://127.0.0.1:3000/api/v1',
        'http://192.168.1.3:3000/api/v1',
        'http://10.0.2.2:3000/api/v1',
      ],
    ];

    for (final url in candidates.toSet()) {
      try {
        AppConstants.setBaseUrl(url);
        final res = await ApiClient.get('/health');
        if (res != null && res['status'] == 'ok') {
          return;
        }
      } catch (_) {
        // Thử địa chỉ tiếp theo
      }
    }
  }

  void _showForgotPasswordSheet() {
    final emailCtrl = TextEditingController(text: _emailCtrl.text.trim());
    final otpCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final confirmPassCtrl = TextEditingController();
    int step = 1;
    bool sheetLoading = false;
    String? devOtp;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          Future<void> sendOtp() async {
            final em = emailCtrl.text.trim();
            if (em.isEmpty || !em.contains('@')) {
              showSnack(context, 'Vui lòng nhập email hợp lệ', isError: true);
              return;
            }
            setSheetState(() => sheetLoading = true);
            final auth = context.read<AuthProvider>();
            final res = await auth.sendForgotPasswordOtp(em);
            setSheetState(() => sheetLoading = false);
            if (res != null) {
              setSheetState(() {
                step = 2;
                devOtp = res['devOtp']?.toString();
              });
              if (mounted) {
                showSnack(context, res['message']?.toString() ?? 'Đã gửi mã OTP đặt lại mật khẩu về Email');
              }
            } else if (mounted) {
              showSnack(context, auth.error ?? 'Không tìm thấy tài khoản với email này', isError: true);
            }
          }

          Future<void> resetPass() async {
            if (otpCtrl.text.trim().length < 6) {
              showSnack(context, 'Vui lòng nhập mã OTP 6 chữ số', isError: true);
              return;
            }
            if (newPassCtrl.text.length < 8) {
              showSnack(context, 'Mật khẩu mới tối thiểu 8 ký tự', isError: true);
              return;
            }
            if (newPassCtrl.text != confirmPassCtrl.text) {
              showSnack(context, 'Mật khẩu xác nhận không khớp', isError: true);
              return;
            }
            setSheetState(() => sheetLoading = true);
            final auth = context.read<AuthProvider>();
            final ok = await auth.resetPasswordWithOtp(
              email: emailCtrl.text.trim(),
              otp: otpCtrl.text.trim(),
              newPassword: newPassCtrl.text,
            );
            setSheetState(() => sheetLoading = false);
            if (ok) {
              if (ctx.mounted) Navigator.pop(ctx);
              if (mounted) {
                _emailCtrl.text = emailCtrl.text.trim();
                showSnack(context, 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
              }
            } else if (mounted) {
              showSnack(context, auth.error ?? 'Đặt lại mật khẩu thất bại', isError: true);
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    step == 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu mới',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    step == 1
                        ? 'Nhập địa chỉ email tài khoản để nhận mã xác thực OTP từ no-reply@karats.studio'
                        : 'Nhập mã OTP vừa gửi tới ${emailCtrl.text.trim()} và mật khẩu mới',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                  ),
                  const SizedBox(height: 18),
                  if (step == 1) ...[
                    TextField(
                      controller: emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email tài khoản',
                        prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: sheetLoading ? null : sendOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: sheetLoading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Gửi mã OTP về Email', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ] else ...[
                    if (devOtp != null && devOtp!.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(8),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Mã OTP: $devOtp',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                        ),
                      ),
                    ],
                    TextField(
                      controller: otpCtrl,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'Mã xác thực OTP (6 chữ số)',
                        counterText: '',
                        prefixIcon: Icon(Icons.pin_outlined, size: 20),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: newPassCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Mật khẩu mới (tối thiểu 8 ký tự)',
                        prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: confirmPassCtrl,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Xác nhận mật khẩu mới',
                        prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: sheetLoading ? null : resetPass,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: sheetLoading
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Xác nhận & Đổi mật khẩu', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
  void _showServerSettingsDialog() {
    final ipCtrl = TextEditingController(
      text: AppConstants.baseUrl.replaceAll('/api/v1', ''),
    );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Địa chỉ máy chủ', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: ipCtrl,
          decoration: const InputDecoration(
            labelText: 'Server URL',
            hintText: 'http://192.168.1.3:3000',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () {
              var text = ipCtrl.text.trim();
              if (text.isNotEmpty) {
                if (!text.endsWith('/api/v1')) text = '$text/api/v1';
                AppConstants.setBaseUrl(text);
              }
              Navigator.pop(ctx);
              _autoDetectServer();
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    final targetEmail = _emailCtrl.text.trim();
    final targetPass = _passCtrl.text;

    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final ok = await auth.login(targetEmail, targetPass);

    if (!mounted) return;
    setState(() => _loading = false);

    if (ok) {
      if (auth.user?.isAdmin == true || auth.user?.isManager == true) {
        await auth.logout();
        if (!mounted) return;
        showSnack(
          context,
          'Tài khoản quản lý vui lòng sử dụng phiên bản Web.',
          isError: true,
        );
        return;
      }
      context.go(roleHome(auth.user?.roleCode));
    } else {
      showSnack(
        context,
        auth.error ?? 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 650;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isDesktop ? (size.width - 420) / 2 : 24,
              vertical: 28,
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GestureDetector(
                    onLongPress: _showServerSettingsDialog,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.shopping_bag_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                        ),
                        const SizedBox(height: 20),
                        const Text(
                          'Chào mừng đến với\nKarat Retail',
                          style: TextStyle(
                            fontSize: 28,
                            height: 1.2,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.textPrimary,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Đăng nhập để tiếp tục mua sắm và theo dõi đơn hàng của bạn',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppTheme.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  const Text(
                    'Email',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
                    decoration: const InputDecoration(
                      hintText: 'Nhập địa chỉ email',
                      prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'Vui lòng nhập email';
                      if (!v.contains('@')) return 'Email không hợp lệ';
                      return null;
                    },
                  ),
                  const SizedBox(height: 18),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Mật khẩu',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      TextButton(
                        onPressed: _showForgotPasswordSheet,
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(0, 0),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          'Quên mật khẩu?',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _passCtrl,
                    obscureText: _obscure,
                    textInputAction: TextInputAction.done,
                    style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Nhập mật khẩu',
                      prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          size: 20,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập mật khẩu' : null,
                    onFieldSubmitted: (_) => _login(),
                  ),
                  const SizedBox(height: 28),

                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      child: _loading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                            )
                          : const Text('Đăng nhập'),
                    ),
                  ),
                  const SizedBox(height: 24),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Bạn là khách hàng mới? ',
                        style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                      ),
                      TextButton(
                        onPressed: () => context.go('/register'),
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text(
                          'Đăng ký ngay',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
