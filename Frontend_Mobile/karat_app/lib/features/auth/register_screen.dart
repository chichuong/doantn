import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common_widgets.dart';
import '../../router.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();

  bool _obscure = true;
  bool _loading = false;
  int _step = 1; // 1: Nhập thông tin -> 2: Nhập mã OTP
  String? _devOtpHint;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _confirmCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (_step == 1 && !_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final res = await auth.sendRegisterOtp(_emailCtrl.text.trim());
    if (!mounted) return;
    setState(() => _loading = false);

    if (res != null) {
      setState(() {
        _step = 2;
        _devOtpHint = res['devOtp']?.toString();
      });
      showSnack(
        context,
        res['message']?.toString() ?? 'Mã OTP xác thực đã được gửi tới email của bạn.',
      );
    } else {
      showSnack(context, auth.error ?? 'Không thể gửi mã OTP. Vui lòng thử lại.', isError: true);
    }
  }

  Future<void> _verifyAndRegister() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length < 6) {
      showSnack(context, 'Vui lòng nhập đủ 6 chữ số mã OTP', isError: true);
      return;
    }

    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    final ok = await auth.register(
      email: _emailCtrl.text.trim(),
      password: _passCtrl.text,
      fullName: _nameCtrl.text.trim(),
      phone: _phoneCtrl.text.trim(),
      otp: otp,
    );
    if (!mounted) return;

    if (ok) {
      final loggedIn = await auth.login(_emailCtrl.text.trim(), _passCtrl.text);
      if (!mounted) return;
      setState(() => _loading = false);
      showSnack(context, 'Xác thực OTP & đăng ký tài khoản thành công!');
      if (loggedIn) {
        context.go(roleHome(auth.user?.roleCode));
      } else {
        context.go('/login');
      }
    } else {
      setState(() => _loading = false);
      showSnack(context, auth.error ?? 'Mã OTP không đúng hoặc đã hết hạn', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isDesktop = size.width > 650;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        backgroundColor: AppTheme.surface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () {
            if (_step == 2) {
              setState(() => _step = 1);
            } else {
              context.go('/login');
            }
          },
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isDesktop ? (size.width - 420) / 2 : 24,
              vertical: 12,
            ),
            child: _step == 1 ? _buildStep1Form() : _buildStep2Otp(),
          ),
        ),
      ),
    );
  }

  Widget _buildStep1Form() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Tạo tài khoản mới',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: AppTheme.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Nhập thông tin cá nhân và xác thực mã OTP qua Email để đăng ký thành viên',
            style: TextStyle(fontSize: 14, color: AppTheme.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 24),

          TextFormField(
            controller: _nameCtrl,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            decoration: const InputDecoration(
              labelText: 'Họ và tên *',
              prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
            ),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập họ tên' : null,
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            decoration: const InputDecoration(
              labelText: 'Số điện thoại',
              prefixIcon: Icon(Icons.phone_outlined, size: 20),
            ),
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            decoration: const InputDecoration(
              labelText: 'Email nhận mã OTP *',
              hintText: 'Nhập địa chỉ email thật của bạn',
              prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'Vui lòng nhập email';
              if (!v.contains('@')) return 'Email không hợp lệ';
              return null;
            },
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _passCtrl,
            obscureText: _obscure,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            decoration: InputDecoration(
              labelText: 'Mật khẩu (tối thiểu 8 ký tự) *',
              prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Vui lòng nhập mật khẩu';
              if (v.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
              return null;
            },
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _confirmCtrl,
            obscureText: _obscure,
            style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15),
            decoration: const InputDecoration(
              labelText: 'Xác nhận mật khẩu *',
              prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
            ),
            validator: (v) => v != _passCtrl.text ? 'Mật khẩu xác nhận không khớp' : null,
          ),
          const SizedBox(height: 26),

          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : _sendOtp,
              icon: _loading
                  ? const SizedBox.shrink()
                  : const Icon(Icons.mark_email_read_outlined, size: 20),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              label: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : const Text('Tiếp tục & Nhận mã OTP'),
            ),
          ),
          const SizedBox(height: 20),

          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Đã có tài khoản? ', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
              TextButton(
                onPressed: () => context.go('/login'),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('Đăng nhập', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStep2Otp() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Xác thực Email (OTP)',
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: AppTheme.textPrimary,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Chúng tôi đã gửi mã xác thực gồm 6 chữ số từ no-reply@karats.studio tới hộp thư:\n${_emailCtrl.text.trim()}',
          style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary, height: 1.4),
        ),
        if (_devOtpHint != null && _devOtpHint!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
            ),
            child: Text(
              'Mã OTP: $_devOtpHint',
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
            ),
          ),
        ],
        const SizedBox(height: 24),

        TextFormField(
          controller: _otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: AppTheme.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: 8,
          ),
          decoration: const InputDecoration(
            labelText: 'Mã OTP (6 chữ số)',
            hintText: '123456',
            counterText: '',
            prefixIcon: Icon(Icons.pin_outlined, size: 20),
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          height: 52,
          child: ElevatedButton(
            onPressed: _loading ? null : _verifyAndRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            child: _loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : const Text('Xác nhận OTP & Hoàn tất đăng ký'),
          ),
        ),
        const SizedBox(height: 16),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton.icon(
              onPressed: _loading ? null : () => setState(() => _step = 1),
              icon: const Icon(Icons.edit_outlined, size: 16),
              label: const Text('Sửa thông tin'),
            ),
            TextButton.icon(
              onPressed: _loading ? null : _sendOtp,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Gửi lại mã OTP'),
            ),
          ],
        ),
      ],
    );
  }
}
