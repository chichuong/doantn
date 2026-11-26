import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePos } from '../../context/PosContext';
import { formatCurrency } from '../../utils/formatters';
import { Store, LogOut, Clock, Menu } from 'lucide-react';

export const Navbar = ({ onOpenShiftClick, onCloseShiftClick, onMenuClick }) => {
  const { user, logout, hasPermission } = useAuth();
  const { currentSession } = usePos();
  const canManageSession = hasPermission('pos.sessions.manage');

  const displayName = user?.fullName || user?.full_name || user?.name || user?.email || 'Người dùng';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'KR';

  const roleLabel =
    user?.role === 'admin'
      ? 'Quản trị viên'
      : user?.role === 'manager'
        ? 'Quản lý'
        : user?.role === 'sales'
          ? 'Thu ngân'
          : user?.role === 'warehouse'
            ? 'Thủ kho'
            : user?.role === 'customer'
              ? 'Khách hàng'
              : user?.role_name || user?.role || 'Nhân viên';

  return (
    <header className="h-16 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-5 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Mở menu chức năng"
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold shadow-xs ring-1 ring-blue-600/20">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-sm tracking-tight text-slate-900">
              KARAT RETAIL
            </h1>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              ĐA KÊNH
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Quản trị bán lẻ đa kênh & Điều hành kho thông minh
          </p>
        </div>
      </div>

      {/* POS Session Status & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* POS Session Badge (Desktop & Mobile compact) */}
        {canManageSession && (
          currentSession ? (
            <>
              <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-900">
                    Ca mở: {currentSession.warehouseName || currentSession.warehouse_name || 'Kho bán lẻ'}
                  </span>
                  <span className="text-[11px] text-slate-600 tabular-nums">
                    Đầu ca: {formatCurrency(currentSession.openingCash || currentSession.opening_cash || 0)}
                  </span>
                </div>
                {onCloseShiftClick && (
                  <button
                    type="button"
                    onClick={onCloseShiftClick}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-[11px] font-semibold transition shadow-2xs"
                  >
                    Đóng ca
                  </button>
                )}
              </div>
              {onCloseShiftClick && (
                <button
                  type="button"
                  onClick={onCloseShiftClick}
                  className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span>Ca mở</span>
                </button>
              )}
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Chưa có ca bán hàng</span>
                {onOpenShiftClick && (
                  <button
                    type="button"
                    onClick={onOpenShiftClick}
                    className="ml-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-2xs"
                  >
                    Mở ca POS
                  </button>
                )}
              </div>
              {onOpenShiftClick && (
                <button
                  type="button"
                  onClick={onOpenShiftClick}
                  className="md:hidden px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-2xs"
                >
                  Mở ca POS
                </button>
              )}
            </>
          )
        )}

        {/* User Info & Logout */}
        <div className="flex items-center gap-2.5 pl-2.5 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-900 leading-tight max-w-[150px] truncate">
              {displayName}
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {roleLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
