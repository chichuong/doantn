import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePos } from '../../context/PosContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Warehouse,
  LogOut,
  Clock,
  Menu,
  Search,
  ShoppingBag,
  BarChart3,
  ClipboardList,
  Package,
  Boxes,
  FileCheck,
  BrainCircuit,
  FileSpreadsheet,
  Users,
  Store,
  X,
  ArrowRight,
} from 'lucide-react';

export const WarehouseBrandMark = ({ className = 'w-8 h-9' }) => (
  <svg viewBox="0 0 269 303" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M21.6363 95.2527C23.8074 74.921 40.9629 59.5 61.4102 59.5H207.169C227.583 59.5 244.722 74.8728 246.933 95.167L258.338 199.834C263.496 247.167 226.422 288.5 178.809 288.5H89.9978C42.4536 288.5 5.40167 247.281 10.4501 200.005L21.6363 95.2527Z"
      fill="#F2CD61"
    />
    <path
      d="M9.72083 210.755C14.194 168.537 49.8046 136.5 92.2588 136.5H177.027C219.579 136.5 255.238 168.68 259.591 211.009C264.624 259.949 226.224 302.5 177.027 302.5H92.2588C42.959 302.5 4.52636 259.78 9.72083 210.755Z"
      fill="#FFFFFF"
    />
    <path
      d="M190.5 75.5L190.5 64.5C190.5 33.0198 164.98 7.50001 133.5 7.50001C102.02 7.50001 76.5 33.0198 76.5 64.5L76.5 75.5"
      strokeWidth="15"
      strokeLinecap="round"
      stroke="#FFFFFF"
    />
    <path d="M198.381 80.5137L183.5 80.5137" strokeWidth="10" strokeLinecap="round" stroke="#FFFFFF" />
    <path d="M84.3807 80.5137L69.5001 80.5137" strokeWidth="10" strokeLinecap="round" stroke="#FFFFFF" />
    <path
      d="M107.542 219.67V287.5H176.392C195.319 287.5 211.525 280.927 225.012 267.78C238.612 254.52 245.412 238.483 245.412 219.67C245.412 200.857 238.612 184.82 225.012 171.56C211.412 158.187 195.205 151.5 176.392 151.5C157.579 151.5 141.372 158.187 127.772 171.56C114.285 184.82 107.542 200.857 107.542 219.67ZM136.272 260.47V219.67C136.272 208.45 140.125 198.817 147.832 190.77C155.652 182.61 165.172 178.53 176.392 178.53C187.612 178.53 197.075 182.61 204.782 190.77C212.602 198.817 216.512 208.45 216.512 219.67C216.512 230.89 212.602 240.523 204.782 248.57C197.075 256.503 187.612 260.47 176.392 260.47H136.272Z"
      fill="#092C4C"
    />
  </svg>
);

export const useNavItems = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const isSalesHistory = hasPermission('pos.sales.read') && !hasPermission('manager.orders.read');

  return useMemo(() => {
    const allItems = [
      {
        to: '/dashboard',
        label: 'Tổng quan',
        fullLabel: 'Tổng quan & Báo cáo',
        group: 'Điều hành',
        icon: BarChart3,
        visible: hasAnyPermission('manager.dashboard.read', 'manager.reports.read'),
      },
      {
        to: '/products',
        label: 'Sản phẩm',
        fullLabel: 'Sản phẩm & Danh mục',
        group: 'Kho & Hàng hóa',
        icon: Package,
        visible: hasAnyPermission('manager.products.read', 'manager.categories.read'),
      },
      {
        to: '/inventory',
        label: 'Tồn kho',
        fullLabel: 'Quản lý Tồn kho',
        group: 'Kho & Hàng hóa',
        icon: Boxes,
        visible: hasPermission('manager.inventory.read'),
      },
      {
        to: '/warehouse-approvals',
        label: 'Duyệt phiếu kho',
        fullLabel: 'Phê duyệt Nhập / Xuất & QR',
        group: 'Kho & Hàng hóa',
        icon: FileCheck,
        dot: 'warn',
        visible: hasAnyPermission('warehouse.documents.approve', 'manager.documents.read'),
      },
      {
        to: '/pos',
        label: 'Quầy POS',
        fullLabel: 'Bán lẻ tại quầy (POS Terminal)',
        group: 'Bán hàng & Đơn',
        icon: ShoppingBag,
        visible: hasAllPermissions('pos.sessions.manage', 'pos.products.read'),
      },
      {
        to: '/orders',
        label: isSalesHistory ? 'Lịch sử POS' : 'Đơn hàng',
        fullLabel: isSalesHistory ? 'Lịch sử hóa đơn POS' : 'Quản lý Đơn hàng Đa kênh',
        group: 'Bán hàng & Đơn',
        icon: ClipboardList,
        visible: hasAnyPermission('manager.orders.read', 'pos.sales.read'),
      },
      {
        to: '/forecasting',
        label: 'Dự báo AI',
        fullLabel: 'Dự báo Nhu cầu AI (Warehouse AI)',
        group: 'Kho & Hàng hóa',
        icon: BrainCircuit,
        visible: hasPermission('forecasting.read'),
      },
      {
        to: '/data-exchange',
        label: 'Nhập / Xuất file',
        fullLabel: 'Đồng bộ Excel / CSV',
        group: 'Hệ thống',
        icon: FileSpreadsheet,
        visible: hasAnyPermission('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read'),
      },
      {
        to: '/users',
        label: 'Nhân sự & Quyền',
        fullLabel: 'Tài khoản & Phân quyền',
        group: 'Hệ thống',
        icon: Users,
        visible: hasAnyPermission('auth.users.read', 'auth.roles.read'),
      },
      {
        to: '/shop',
        label: 'Cửa hàng',
        fullLabel: 'Mua sắm Trực tuyến',
        group: 'Bán hàng & Đơn',
        icon: Store,
        visible: hasAnyPermission('customer.catalog.read', 'customer.orders.read'),
      },
    ];
    return allItems.filter((i) => i.visible);
  }, [hasPermission, hasAnyPermission, hasAllPermissions, isSalesHistory]);
};

export const Navbar = ({
  isCustomerOnly = false,
  onOpenShiftClick,
  onCloseShiftClick,
  onMenuClick,
}) => {
  const { user, logout, hasPermission, hasAllPermissions } = useAuth();
  const { currentSession } = usePos();
  const navigate = useNavigate();
  const navItems = useNavItems();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');

  const canManageSession = hasPermission('pos.sessions.manage');
  const canOpenPos = hasAllPermissions('pos.sessions.manage', 'pos.products.read');

  const displayName = user?.fullName || user?.full_name || user?.name || user?.email || 'Người dùng';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'KW';

  const roleLabel =
    user?.role === 'admin'
      ? 'Quản trị viên'
      : user?.role === 'manager'
        ? 'Quản lý kho & cửa hàng'
        : user?.role === 'sales'
          ? 'Thu ngân POS'
          : user?.role === 'warehouse'
            ? 'Thủ kho'
            : user?.role === 'customer'
              ? 'Khách hàng'
              : user?.role_name || user?.role || 'Nhân viên';

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === 'Escape' && cmdOpen) {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cmdOpen]);

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.fullLabel.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    );
  }, [navItems, cmdQuery]);

  return (
    <>
      <header className="hm-shell shrink-0 select-none">
        {/* ROW 1: Brand, Warehouse Plate, Command Search & Tools */}
        <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-3 relative z-10">
          {/* Left: Hamburger + Brand + Location Plate */}
          <div className="flex items-center gap-3 min-w-0">
            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                aria-label="Mở menu chức năng"
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/12 flex items-center justify-center shadow-inner group-hover:border-[#f7d268]/50 transition">
                <WarehouseBrandMark className="w-6 h-7" />
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[15px] tracking-tight text-white">
                    KARAT
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider bg-[#d4af37]/20 text-[#f7d268] border border-[#f7d268]/30">
                    POS
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-400 hidden sm:block">
                  Warehouse & Omnichannel
                </span>
              </div>
            </Link>

            {/* Location / Warehouse Plate (Signature WareHouse POS element) */}
            {!isCustomerOnly && (
              <div className="hidden md:flex items-center gap-2.5 ml-2 pl-3 pr-2.5 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs">
                <Warehouse className="w-4 h-4 text-[#f7d268] shrink-0" />
                <div className="leading-tight">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Kho vận hành
                  </span>
                  <strong className="font-semibold text-white text-xs truncate max-w-[160px] block">
                    {currentSession?.warehouseName ||
                      currentSession?.warehouse_name ||
                      'Kho trung tâm · TP.HCM'}
                  </strong>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono font-bold text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  WH-01
                </span>
              </div>
            )}
          </div>

          {/* Center: Command Palette Search Trigger */}
          {!isCustomerOnly && (
            <button
              type="button"
              onClick={() => {
                setCmdQuery('');
                setCmdOpen(true);
              }}
              aria-label="Tìm kiếm trang và thao tác nhanh"
              className="hidden sm:flex items-center gap-2.5 flex-1 max-w-md h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-slate-400 text-xs transition"
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 text-left truncate">Tìm nhanh phân hệ kho, đơn hàng, AI...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono font-semibold text-slate-300 border border-white/10">
                Ctrl K
              </kbd>
            </button>
          )}

          {/* Right: POS Terminal CTA + Shift Control + User Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {canOpenPos && (
              <Link
                to="/pos"
                className="wm-btn wm-btn-primary hidden sm:inline-flex !h-9 !px-3.5 text-xs shadow-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>POS Terminal</span>
              </Link>
            )}

            {canManageSession &&
              (currentSession ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="hidden xl:flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-white">Ca đang mở</span>
                    <span className="text-[10px] text-emerald-300 tabular-nums">
                      {formatCurrency(currentSession.openingCash || currentSession.opening_cash || 0)}
                    </span>
                  </div>
                  {onCloseShiftClick && (
                    <button
                      type="button"
                      onClick={onCloseShiftClick}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition"
                    >
                      Đóng ca
                    </button>
                  )}
                </div>
              ) : (
                onOpenShiftClick && (
                  <button
                    type="button"
                    onClick={onOpenShiftClick}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/12 text-slate-200 text-xs font-semibold transition"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#f7d268]" />
                    <span>Mở ca POS</span>
                  </button>
                )
              ))}

            <span className="hidden sm:block w-px h-6 bg-white/12 mx-0.5" aria-hidden="true" />

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f7d268] to-[#b8860b] text-[#0f172a] font-extrabold text-xs flex items-center justify-center ring-2 ring-white/15">
                  {initials}
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0f172a] absolute -bottom-0.5 -right-0.5"
                  aria-hidden="true"
                />
              </div>

              <div className="hidden xl:block text-left leading-tight">
                <div className="text-[13px] font-semibold text-white max-w-[140px] truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-slate-400">{roleLabel}</div>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-400/25 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2: Horizontal Navigation Bar + Network Capacity Ring */}
        {!isCustomerOnly && navItems.length > 0 && (
          <div className="hidden lg:block border-t border-white/10 relative z-10">
            <div className="max-w-[1680px] mx-auto px-4 xl:px-6 min-h-[48px] flex items-center justify-between gap-3">
              <nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-0.5 xl:gap-1 py-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `relative h-9 px-2.5 xl:px-3 rounded-xl text-[12.5px] xl:text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                          isActive
                            ? 'text-white bg-white/[0.1] font-semibold hm-nav-active'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              isActive ? 'text-[#f7d268]' : 'text-slate-500'
                            }`}
                          />
                          <span>{item.label}</span>
                          {item.dot === 'warn' && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-amber-400"
                              aria-hidden="true"
                            />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      {/* Command Palette Modal (Ctrl+K) */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/60 backdrop-blur-xs"
          onMouseDown={() => setCmdOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tìm nhanh trang và chức năng"
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Search className="w-4 h-4 text-[#b8860b] shrink-0" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredCommands[0]) {
                    navigate(filteredCommands[0].to);
                    setCmdOpen(false);
                  }
                }}
                placeholder="Nhập tên trang hoặc chức năng (VD: Tồn kho, POS, AI, Đơn hàng)..."
                className="flex-1 text-sm text-slate-900 placeholder-slate-400 focus:outline-none border-none shadow-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Đóng tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không tìm thấy phân hệ nào khớp với từ khóa.
                </div>
              ) : (
                filteredCommands.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        navigate(item.to);
                        setCmdOpen(false);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-[#fdf8e6] text-left group transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-[#faf0c4] text-slate-600 group-hover:text-[#926a09] flex items-center justify-center shrink-0 transition">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-[#735309] truncate">
                            {item.fullLabel}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.group}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#b8860b] shrink-0" />
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Nhấn Enter để mở trang đầu tiên</span>
              <span className="font-mono">ESC để đóng</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
