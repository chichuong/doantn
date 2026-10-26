import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePos } from '../../context/PosContext';
import { formatCurrency } from '../../utils/formatters';
import { Store, LogOut, Clock, Menu } from 'lucide-react';

export const Navbar = ({ onOpenShiftClick, onCloseShiftClick, onMenuClick }) => {
  const { user, logout, hasPermission } = useAuth();
  const { currentSession } = usePos();
  const canManageSession = hasPermission('pos.sessions.manage');

  return (
    <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-3 sm:px-5 lg:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand Logo */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Mở menu chức năng"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-2xs">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-slate-900">
            KARAT RETAIL
          </h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Quản trị bán lẻ & Quản lý kho
          </p>
        </div>
      </div>

      {/* POS Session Status & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* POS Session Badge */}
        {canManageSession && (currentSession ? (
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">
                Ca mở: {currentSession.warehouseName || currentSession.warehouse_name || 'Kho bán lẻ'}
              </span>
              <span className="text-[11px] text-slate-500">
                Đầu ca: {formatCurrency(currentSession.openingCash || currentSession.opening_cash || 0)}
              </span>
            </div>
            {onCloseShiftClick && (
              <button
                type="button"
                onClick={onCloseShiftClick}
                className="ml-1 px-2 py-1 rounded bg-white hover:bg-emerald-100/60 border border-emerald-200 text-emerald-800 text-[11px] font-medium transition"
              >
                Đóng ca
              </button>
            )}
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Chưa có ca bán hàng</span>
            {onOpenShiftClick && (
              <button
                type="button"
                onClick={onOpenShiftClick}
                className="ml-1.5 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition shadow-2xs"
              >
                Mở ca POS
              </button>
            )}
          </div>
        ))}

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 flex items-center justify-end gap-1">
              {user?.fullName || user?.name || user?.email || 'Người dùng'}
            </div>
            <div className="text-[11px] text-slate-500">
              {user?.role === 'admin'
                ? 'Quản trị viên'
                : user?.role === 'manager'
                ? 'Quản lý'
                : user?.role === 'sales'
                ? 'Thu ngân'
                : user?.role === 'warehouse'
                ? 'Thủ kho'
                : user?.role || 'Nhân viên'}
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
