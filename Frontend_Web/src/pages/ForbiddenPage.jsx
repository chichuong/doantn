import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';

export const ForbiddenPage = ({ homePath = '/' }) => (
  <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 sm:p-6 flex items-center justify-center">
    <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm" aria-labelledby="forbidden-title">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <ShieldX className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Lỗi 403</p>
      <h2 id="forbidden-title" className="mt-2 text-xl font-bold text-slate-900">
        Bạn không có quyền truy cập
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Tài khoản hiện tại không được phép sử dụng chức năng này.
      </p>
      {homePath !== '/403' && (
        <Link
          to={homePath}
          replace
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Về trang phù hợp
        </Link>
      )}
    </section>
  </div>
);
