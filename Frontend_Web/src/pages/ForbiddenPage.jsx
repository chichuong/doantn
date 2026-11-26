import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export const ForbiddenPage = ({ homePath = '/' }) => (
  <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
    <section
      className="w-full max-w-md wm-card p-7 sm:p-9 text-center shadow-sm"
      aria-labelledby="forbidden-title"
    >
      <div className="mx-auto mb-4 flex h-13 w-13 items-center justify-center rounded-2xl border border-[#f7e08f] bg-[#fdf8e6] text-[#b8860b]">
        <ShieldX className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-xs font-extrabold uppercase tracking-wider text-[#926a09]">Mã lỗi 403</p>
      <h2 id="forbidden-title" className="mt-1.5 text-xl font-extrabold text-slate-900">
        Bạn không có quyền truy cập
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Tài khoản hiện tại chưa được phân quyền sử dụng phân hệ này.
      </p>
      {homePath !== '/403' && (
        <Link to={homePath} replace className="wm-btn wm-btn-primary mt-5 !h-10 !px-5">
          Về trang làm việc chính
        </Link>
      )}
    </section>
  </div>
);
