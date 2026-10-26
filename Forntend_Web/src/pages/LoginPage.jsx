import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Store,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDemoRole, setSelectedDemoRole] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const fillAccount = (userEmail, userPass, roleKey) => {
    setEmail(userEmail);
    setPassword(userPass);
    setSelectedDemoRole(roleKey);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* CỘT TRÁI: Nhận diện thương hiệu & Tổng quan hệ thống (Ẩn trên mobile nhỏ) */}
      <div className="hidden lg:flex lg:w-1/2 bg-white border-r border-slate-200 px-12 xl:px-16 py-10 flex-col justify-center">
        <div className="w-full max-w-lg mx-auto">
          {/* Logo KARAT RETAIL */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block">
                KARAT RETAIL
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Hệ thống Quản trị Bán hàng Đa kênh
              </span>
            </div>
          </div>

          {/* Headline & Value Proposition */}
          <div className="mt-12 space-y-3">
            <h1 className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">
              Vận hành bán lẻ trong một hệ thống
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              Quản lý POS, đơn hàng, tồn kho và dự báo nhu cầu tập trung.
            </p>
          </div>

          {/* System Info Footer */}
          <div className="mt-12 pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Hệ thống quản trị bán lẻ</span>
            <span>v2.4.0</span>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: Form Đăng nhập & Lựa chọn tài khoản */}
      <div className="flex-1 flex flex-col justify-center items-center px-5 sm:px-8 py-10 lg:px-14 xl:px-16">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">
              <Store className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">
              KARAT RETAIL
            </span>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Đăng nhập hệ thống
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Nhập thông tin tài khoản được cấp để truy cập không gian làm việc.
            </p>
          </div>

          {/* Alerts */}
          {isExpired && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email công việc
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedDemoRole(null);
                  }}
                  placeholder="name@company.com"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                  Mật khẩu
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedDemoRole(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Phân vùng tài khoản mẫu */}
          <div className="pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tài khoản mẫu
              </span>
              <span className="text-[11px] text-slate-500">
                Nhấp để chọn nhanh
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillAccount('sales@example.com', 'Sales@123', 'sales')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedDemoRole === 'sales'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Thu ngân</span>
                  {selectedDemoRole === 'sales' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Bán lẻ POS</div>
              </button>

              <button
                type="button"
                onClick={() => fillAccount('manager@example.com', 'Manager@123', 'manager')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedDemoRole === 'manager'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Quản lý</span>
                  {selectedDemoRole === 'manager' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Đơn & Tồn kho</div>
              </button>

              <button
                type="button"
                onClick={() => fillAccount('admin@example.com', 'Admin@123', 'admin')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  selectedDemoRole === 'admin'
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>Quản trị</span>
                  {selectedDemoRole === 'admin' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Hệ thống</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
