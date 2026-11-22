import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ShoppingBag,
  ClipboardList,
  Package,
  Boxes,
  BrainCircuit,
  FileSpreadsheet,
  FileCheck,
  Users,
  Store,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isOpen = false, onClose }) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const isSalesHistory = hasPermission('pos.sales.read') && !hasPermission('manager.orders.read');

  const menuGroups = [
    {
      title: 'Kinh doanh & Bán hàng',
      items: [
        {
          to: '/dashboard',
          label: 'Tổng quan & Báo cáo',
          icon: BarChart3,
          visible: hasAnyPermission('manager.dashboard.read', 'manager.reports.read'),
        },
        {
          to: '/pos',
          label: 'Bán lẻ tại quầy (POS)',
          icon: ShoppingBag,
          visible: hasAllPermissions('pos.sessions.manage', 'pos.products.read'),
        },
        {
          to: '/orders',
          label: isSalesHistory ? 'Lịch sử đơn POS' : 'Quản lý đơn hàng',
          icon: ClipboardList,
          visible: hasAnyPermission('manager.orders.read', 'pos.sales.read'),
        },
        {
          to: '/shop',
          label: 'Mua sắm Trực tuyến',
          icon: Store,
          visible: hasAnyPermission('customer.catalog.read', 'customer.orders.read'),
        },
      ],
    },
    {
      title: 'Kho hàng & Dự báo AI',
      items: [
        {
          to: '/products',
          label: 'Sản phẩm & Danh mục',
          icon: Package,
          visible: hasAnyPermission('manager.products.read', 'manager.categories.read'),
        },
        {
          to: '/warehouse-approvals',
          label: 'Duyệt nhập / xuất kho',
          icon: FileCheck,
          visible: hasAnyPermission('warehouse.documents.approve', 'manager.documents.read'),
        },
        {
          to: '/inventory',
          label: 'Quản lý tồn kho',
          icon: Boxes,
          visible: hasPermission('manager.inventory.read'),
        },
        {
          to: '/forecasting',
          label: 'Dự báo nhu cầu AI',
          icon: BrainCircuit,
          visible: hasPermission('forecasting.read'),
        },
      ],
    },
    {
      title: 'Hệ thống & Dữ liệu',
      items: [
        {
          to: '/data-exchange',
          label: 'Nhập / Xuất dữ liệu',
          icon: FileSpreadsheet,
          visible: hasAnyPermission('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read'),
        },
        {
          to: '/users',
          label: 'Người dùng & Quyền',
          icon: Users,
          visible: hasAnyPermission('auth.users.read', 'auth.roles.read'),
        },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.visible),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Đóng menu chức năng"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs lg:hidden"
        />
      )}
      <aside
        aria-label="Điều hướng chức năng"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col justify-between py-4 px-3 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-4 overflow-y-auto pr-0.5">
          <div className="px-3 flex items-center justify-between lg:hidden pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Menu điều hướng
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng menu chức năng"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-blue-50/90 text-blue-700 font-semibold border border-blue-200/80 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="px-3 pt-3 mt-2 text-[11px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="font-semibold text-slate-600">KARAT ERP</span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
            v2.5.0
          </span>
        </div>
      </aside>
    </>
  );
};
