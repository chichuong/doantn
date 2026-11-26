import React from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useNavItems, WarehouseBrandMark } from './Navbar';

/**
 * Mobile & Tablet Slide-Over Navigation Drawer (mirrors horizontal menu on < lg screens)
 */
export const Sidebar = ({ isOpen = false, onClose }) => {
  const navItems = useNavItems();

  if (!isOpen) return null;

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Đóng menu chức năng"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xs"
      />
      <aside
        aria-label="Điều hướng chức năng"
        className="fixed inset-y-0 left-0 z-10 w-72 max-w-[86vw] hm-shell border-r border-white/10 flex flex-col justify-between py-4 px-3.5 shadow-2xl"
      >
        <div className="space-y-4 overflow-y-auto pr-0.5 relative z-10">
          <div className="px-2 pb-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <WarehouseBrandMark className="w-5 h-6" />
              </div>
              <div>
                <span className="text-sm font-extrabold text-white tracking-tight block">
                  KARAT POS
                </span>
                <span className="text-[10px] text-[#f7d268] font-semibold uppercase tracking-wider">
                  Warehouse System
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng menu chức năng"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {Object.entries(grouped).map(([groupTitle, items]) => (
            <div key={groupTitle} className="space-y-1">
              <div className="px-3 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {groupTitle}
              </div>
              <nav className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-[#d4af37]/20 text-white font-semibold border border-[#f7d268]/35 shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-white/[0.07] border border-transparent'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition ${
                              isActive
                                ? 'bg-[#d4af37] text-[#0f172a]'
                                : 'bg-white/[0.06] text-slate-400 group-hover:text-[#f7d268]'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <span className="truncate">{item.fullLabel}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="px-3 pt-3 mt-2 text-[11px] text-slate-400 border-t border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-semibold text-slate-200">KARAT WAREHOUSE</span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#f7d268]">
            v3.0
          </span>
        </div>
      </aside>
    </div>
  );
};
