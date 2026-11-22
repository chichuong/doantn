import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import {
  Store,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

export const LoginPage = () => {
  // 'login' | 'register' | 'forgot'
  const [mode, setMode] = useState('login');
  // step 1: nhập thông tin/email, step 2: nhập OTP (& mật khẩu mới nếu forgot)
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [mailPreviewUrl, setMailPreviewUrl] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep(1);
    setOtp('');
    setDevOtpHint('');
    setMailPreviewUrl('');
    setError('');
    setSuccess('');
  };

  // 1. ĐĂNG NHẬP
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  // 2. ĐĂNG KÝ - BƯỚC 1: GỬI OTP XÁC THỰC EMAIL
  const handleSendRegisterOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password || !fullName) {
      setError('Vui lòng nhập đầy đủ họ tên, email và mật khẩu');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const res = await authApi.sendRegisterOtp({ email: email.trim() });
      const data = res?.data || res;
      setStep(2);
      setDevOtpHint(data?.devOtp || '');
      setMailPreviewUrl(data?.previewUrl || '');
      setSuccess(data?.message || `Mã OTP đã được gửi đến ${email.trim()}`);
    } catch (err) {
      setError(err.message || 'Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // 2. ĐĂNG KÝ - BƯỚC 2: XÁC NHẬN OTP & TẠO TÀI KHOẢN
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length < 6) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await authApi.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        otp: otp.trim(),
      });
      setSuccess('Xác thực OTP & đăng ký tài khoản thành công! Đang đăng nhập...');
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Xác thực OTP hoặc đăng ký không thành công.');
    } finally {
      setLoading(false);
    }
  };

  // 3. QUÊN MẬT KHẨU - BƯỚC 1: GỬI OTP VỀ EMAIL
  const handleSendForgotOtp = async (e) => {
    if (e) e.preventDefault();
    if (!email) {
      setError('Vui lòng nhập địa chỉ email đã đăng ký');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const res = await authApi.forgotPassword({ email: email.trim() });
      const data = res?.data || res;
      setStep(2);
      setDevOtpHint(data?.devOtp || '');
      setMailPreviewUrl(data?.previewUrl || '');
      setSuccess(data?.message || `Mã OTP đặt lại mật khẩu đã được gửi đến ${email.trim()}`);
    } catch (err) {
      setError(err.message || 'Không thể gửi mã OTP khôi phục mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  // 3. QUÊN MẬT KHẨU - BƯỚC 2: XÁC NHẬN OTP & ĐẶT LẠI MẬT KHẨU
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length < 6) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số');
      return;
    }
    if (!password || password.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await authApi.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword: password,
      });
      const data = res?.data || res;
      setMode('login');
      setStep(1);
      setOtp('');
      setDevOtpHint('');
      setPassword('');
      setConfirmPassword('');
      setSuccess(data?.message || 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
    } catch (err) {
      setError(err.message || 'Đặt lại mật khẩu không thành công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white mb-3 shadow-sm">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Karat Retail</h1>
          <p className="text-xs text-slate-500 mt-1">Hệ thống quản lý bán hàng & kho</p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'login' && 'Đăng nhập'}
              {mode === 'register' && (step === 1 ? 'Đăng ký tài khoản' : 'Xác thực Email (OTP)')}
              {mode === 'forgot' && (step === 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu mới')}
            </h2>
            {mode === 'register' && step === 2 && (
              <p className="text-xs text-slate-500 mt-1">
                Vui lòng nhập mã OTP gồm 6 chữ số đã được gửi tới <span className="font-semibold text-slate-700">{email}</span>
              </p>
            )}
            {mode === 'forgot' && step === 1 && (
              <p className="text-xs text-slate-500 mt-1">
                Nhập địa chỉ email tài khoản của bạn để nhận mã xác thực OTP khôi phục mật khẩu.
              </p>
            )}
            {mode === 'forgot' && step === 2 && (
              <p className="text-xs text-slate-500 mt-1">
                Nhập mã OTP đã gửi tới <span className="font-semibold text-slate-700">{email}</span> và thiết lập mật khẩu mới.
              </p>
            )}
          </div>

          {isExpired && mode === 'login' && (
            <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {success && (
            <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1.5">
                <p className="leading-relaxed">{success}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {devOtpHint && (
                    <span className="font-mono font-bold text-emerald-900 bg-emerald-100/80 px-2 py-1 rounded inline-block">
                      Mã OTP: {devOtpHint}
                    </span>
                  )}
                  {mailPreviewUrl && (
                    <a
                      href={mailPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-semibold underline hover:text-blue-800"
                    >
                      Mở xem hộp thư Email vừa nhận ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= FORM ĐĂNG NHẬP ================= */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* ================= FORM ĐĂNG KÝ (BƯỚC 1: NHẬP THÔNG TIN) ================= */}
          {mode === 'register' && step === 1 && (
            <form onSubmit={handleSendRegisterOtp} className="space-y-3.5">
              <div>
                <label htmlFor="register-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên *
                </label>
                <input
                  id="register-fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="khachhang@example.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <input
                  id="register-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu *
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>{loading ? 'Đang gửi mã OTP...' : 'Tiếp tục & Nhận mã OTP'}</span>
              </button>
            </form>
          )}

          {/* ================= FORM ĐĂNG KÝ (BƯỚC 2: NHẬP MÃ OTP) ================= */}
          {mode === 'register' && step === 2 && (
            <form onSubmit={handleVerifyAndRegister} className="space-y-4">
              <div>
                <label htmlFor="register-otp" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mã xác thực OTP (6 chữ số) *
                </label>
                <input
                  id="register-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-center text-lg font-bold tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Đang xác thực...' : 'Xác nhận OTP & Hoàn tất đăng ký'}</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại sửa thông tin</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendRegisterOtp}
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gửi lại mã OTP</span>
                </button>
              </div>
            </form>
          )}

          {/* ================= FORM QUÊN MẬT KHẨU (BƯỚC 1: NHẬP EMAIL) ================= */}
          {mode === 'forgot' && step === 1 && (
            <form onSubmit={handleSendForgotOtp} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email tài khoản *
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>{loading ? 'Đang gửi mã OTP...' : 'Gửi mã OTP về Email'}</span>
              </button>
            </form>
          )}

          {/* ================= FORM QUÊN MẬT KHẨU (BƯỚC 2: NHẬP OTP & MẬT KHẨU MỚI) ================= */}
          {mode === 'forgot' && step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label htmlFor="forgot-otp" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã xác thực OTP (6 chữ số) *
                </label>
                <input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-center text-base font-bold tracking-widest text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="forgot-new-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <input
                    id="forgot-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="forgot-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  id="forgot-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Đang cập nhật...' : 'Xác nhận & Đặt lại mật khẩu'}</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Đổi địa chỉ Email</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendForgotOtp}
                  className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gửi lại mã OTP</span>
                </button>
              </div>
            </form>
          )}

          {/* Footer chuyển đổi qua lại giữa Đăng nhập / Đăng ký */}
          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <span>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Đăng ký ngay
                </button>
              </span>
            ) : (
              <span>
                Đã nhớ mật khẩu / có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Quay lại Đăng nhập
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
