import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingBag, ClipboardList, Boxes, BrainCircuit, FileSpreadsheet, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isOpen = false, onClose }) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const isSalesHistory = hasPermission('pos.sales.read') && !hasPermission('manager.orders.read');
  const menuItems = [
    {
      to: '/pos', label: 'Bán lẻ POS', icon: ShoppingBag,
      visible: hasAllPermissions('pos.sessions.manage', 'pos.products.read'),
    },
    {
      to: '/orders', label: isSalesHistory ? 'Lịch sử đơn POS' : 'Quản lý đơn hàng', icon: ClipboardList,
      visible: hasAnyPermission('manager.orders.read', 'pos.sales.read'),
    },
    {
      to: '/inventory', label: 'Quản lý tồn kho', icon: Boxes,
      visible: hasPermission('manager.inventory.read'),
    },
    {
      to: '/forecasting', label: 'Dự báo nhu cầu', icon: BrainCircuit,
      visible: hasPermission('forecasting.read'),
    },
    {
      to: '/data-exchange', label: 'Nhập / Xuất dữ liệu', icon: FileSpreadsheet,
      visible: hasAnyPermission('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read'),
    },
  ].filter((item) => item.visible);

  return (
    <>
      {isOpen && (
        <button type="button" aria-label="Đóng menu chức năng" onClick={onClose} className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
      )}
      <aside
        aria-label="Điều hướng chức năng"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col justify-between py-5 px-3 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="space-y-4">
          <div className="px-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Chức năng</span>
            <button type="button" onClick={onClose} aria-label="Đóng menu chức năng" className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
          <span>KARAT RETAIL</span><span>v2.4.0</span>
        </div>
      </aside>
    </>
  );
};
