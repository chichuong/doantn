import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { WarehouseBrandMark } from '../components/common/Navbar';
import {
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Mail,
  Lock,
  User,
  Phone,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

export const LoginPage = () => {
  const [mode, setMode] = useState('login');
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
    <div className="min-h-screen lgn-bg relative isolate flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Decorative Warehouse Silhouette Backdrop (modeled after login.html .lgn-scene) */}
      <svg
        viewBox="0 0 1440 360"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 w-full h-64 sm:h-80 -z-10 opacity-75"
      >
        <defs>
          <linearGradient id="lgnRoof" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7d268" />
            <stop offset="1" stopColor="#b8860b" />
          </linearGradient>
        </defs>
        <rect x="60" y="190" width="260" height="120" rx="6" fill="#e6cfa0" />
        <path d="M44 200Q190 145 336 200Z" fill="url(#lgnRoof)" opacity="0.65" />
        <rect x="1090" y="175" width="290" height="135" rx="6" fill="#e6cfa0" />
        <path d="M1072 186Q1235 130 1398 186Z" fill="url(#lgnRoof)" opacity="0.65" />
        {[1120, 1205, 1290].map((x) => (
          <rect key={x} x={x} y="232" width="56" height="78" rx="4" fill="#cbb07a" />
        ))}
        <rect x="0" y="310" width="1440" height="50" fill="#5a4208" opacity="0.88" />
        <path d="M0 335H1440" stroke="#fff3c1" strokeWidth="2.5" strokeDasharray="24 20" opacity="0.65" />
      </svg>

      <main className="w-full max-w-[430px] relative z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-white/90 p-6 sm:p-8 shadow-[0_28px_60px_-24px_rgba(90,66,8,0.35)] space-y-5">
          {/* Brand Mark */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-[#0f172a] mb-3 shadow-md ring-4 ring-[#fdf8e6]">
              <WarehouseBrandMark className="w-7 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'register' && (step === 1 ? 'Tạo tài khoản mới' : 'Xác thực Email (OTP)')}
              {mode === 'forgot' && (step === 1 ? 'Khôi phục mật khẩu' : 'Thiết lập mật khẩu mới')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'login' && 'Đăng nhập để điều hành kho hàng, tồn kho và bán lẻ đa kênh.'}
              {mode === 'register' &&
                (step === 1
                  ? 'Đăng ký tài khoản mua sắm trực tuyến và theo dõi đơn hàng.'
                  : `Nhập mã OTP 6 số vừa gửi đến ${email}`)}
              {mode === 'forgot' &&
                (step === 1
                  ? 'Nhập email tài khoản để nhận mã xác thực OTP khôi phục.'
                  : `Nhập mã OTP đã gửi tới ${email} và mật khẩu mới.`)}
            </p>
          </div>

          {isExpired && mode === 'login' && (
            <div
              role="status"
              className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2"
            >
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
                      className="text-[#926a09] font-semibold underline hover:text-[#735309]"
                    >
                      Mở xem hộp thư Email vừa nhận ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@congty.com"
                    className="wm-field !h-10.5 w-full pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-[#926a09] hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="wm-field !h-10.5 w-full pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wm-btn wm-btn-primary !h-11 w-full !text-sm shadow-md"
              >
                <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập hệ thống'}</span>
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* REGISTER STEP 1 */}
          {mode === 'register' && step === 1 && (
            <form onSubmit={handleSendRegisterOtp} className="space-y-3.5">
              <div>
                <label htmlFor="register-fullname" className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-fullname"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="wm-field !h-10 w-full pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="khachhang@example.com"
                    className="wm-field !h-10 w-full pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567"
                    className="wm-field !h-10 w-full pl-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="register-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="wm-field !h-10 w-full pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wm-btn wm-btn-primary !h-10.5 w-full shadow-md"
              >
                <Mail className="w-4 h-4" />
                <span>{loading ? 'Đang gửi mã OTP...' : 'Tiếp tục & Nhận mã OTP'}</span>
              </button>
            </form>
          )}

          {/* REGISTER STEP 2 */}
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
                  className="wm-field !h-12 w-full text-center text-lg font-extrabold tracking-widest font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wm-btn wm-btn-primary !h-10.5 w-full shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Đang xác thực...' : 'Xác nhận OTP & Hoàn tất'}</span>
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendRegisterOtp}
                  className="text-[#926a09] font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gửi lại mã OTP</span>
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD STEP 1 */}
          {mode === 'forgot' && step === 1 && (
            <form onSubmit={handleSendForgotOtp} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email tài khoản *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@congty.com"
                    className="wm-field !h-10.5 w-full pl-10"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wm-btn wm-btn-primary !h-10.5 w-full shadow-md"
              >
                <Mail className="w-4 h-4" />
                <span>{loading ? 'Đang gửi mã OTP...' : 'Gửi mã OTP về Email'}</span>
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD STEP 2 */}
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
                  className="wm-field !h-11 w-full text-center text-base font-extrabold tracking-widest font-mono"
                  required
                />
              </div>

              <div>
                <label htmlFor="forgot-new-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="forgot-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    className="wm-field !h-10 w-full pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="forgot-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="forgot-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="wm-field !h-10 w-full pl-10"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="wm-btn wm-btn-primary !h-10.5 w-full shadow-md"
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
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Đổi Email</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSendForgotOtp}
                  className="text-[#926a09] font-semibold hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gửi lại mã OTP</span>
                </button>
              </div>
            </form>
          )}

          {/* Switch Mode Box (modeled on .lgn-signup) */}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 pl-4 pr-1.5 py-1.5 text-xs">
            {mode === 'login' ? (
              <>
                <span className="font-medium text-slate-600">Chưa có tài khoản?</span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="wm-btn wm-btn-ghost !h-8 text-xs"
                >
                  Đăng ký ngay
                </button>
              </>
            ) : (
              <>
                <span className="font-medium text-slate-600">Đã có tài khoản?</span>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="wm-btn wm-btn-ghost !h-8 text-xs"
                >
                  Quay lại Đăng nhập
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
