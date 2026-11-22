import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  Calendar,
  TrendingUp,
  Store,
  Globe,
  Smartphone,
  Download,
} from 'lucide-react';
import { managerApi } from '../api/managerApi';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const CHANNEL_META = {
  pos: { label: 'Bán tại quầy (POS)', icon: Store, color: 'bg-blue-600', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  web: { label: 'Kênh Web trực tuyến', icon: Globe, color: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mobile: { label: 'Ứng dụng Flutter Mobile', icon: Smartphone, color: 'bg-indigo-600', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

export const DashboardPage = () => {
  const { hasPermission } = useAuth();
  const canReadDashboard = hasPermission('manager.dashboard.read');
  const canReadReports = hasPermission('manager.reports.read');

  const todayStr = new Date().toISOString().slice(0, 10);
  const yearStartStr = `${new Date().getFullYear()}-01-01`;

  const [fromDate, setFromDate] = useState(yearStartStr);
  const [toDate, setToDate] = useState(todayStr);
  const [activePreset, setActivePreset] = useState('year');
  const [dashboard, setDashboard] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, repRes] = await Promise.allSettled([
        canReadDashboard ? managerApi.getDashboard({ from: fromDate, to: toDate }) : Promise.resolve(null),
        canReadReports ? managerApi.getSalesReport({ from: fromDate, to: toDate }) : Promise.resolve(null),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        setDashboard(dashRes.value?.data || dashRes.value);
      }
      if (repRes.status === 'fulfilled' && repRes.value) {
        setReport(repRes.value?.data || repRes.value);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu thống kê.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, canReadDashboard, canReadReports]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    if (days === 'year') {
      setFromDate(`${end.getFullYear()}-01-01`);
    } else {
      start.setDate(end.getDate() - (days - 1));
      setFromDate(start.toISOString().slice(0, 10));
    }
    setToDate(end.toISOString().slice(0, 10));
    setActivePreset(days);
  };

  const totalRevenue = Number(dashboard?.sales?.revenue ?? report?.summary?.revenue ?? 0);
  const avgOrderValue = Number(dashboard?.sales?.average_order_value ?? 0);
  const totalOrders = Number(dashboard?.orders?.total_orders ?? 0);
  const completedOrders = Number(dashboard?.orders?.completed_orders ?? report?.summary?.completed_orders ?? 0);
  const openOrders = Number(dashboard?.orders?.open_orders ?? 0);
  const returnedAmount = Number(report?.summary?.returned_amount ?? 0);

  const byChannel = report?.byChannel || [];
  const byDay = report?.byDay || [];
  const maxDayRevenue = Math.max(...byDay.map((d) => Number(d.revenue || 0)), 1);

  const handleExportCsv = () => {
    const headers = ['Ngày', 'Số đơn hàng', 'Doanh thu hoàn tất (VND)'];
    const rows = [...byDay].reverse().map((r) => [
      String(r.date || '').slice(0, 10),
      Number(r.orders || 0),
      Number(r.revenue || 0),
    ]);
    const channelRows = [
      [],
      ['Kênh bán hàng', 'Số đơn', 'Doanh thu (VND)'],
      ...['pos', 'web', 'mobile'].map((ch) => {
        const found = byChannel.find((c) => c.channel === ch) || { orders: 0, revenue: 0 };
        return [CHANNEL_META[ch].label, Number(found.orders || 0), Number(found.revenue || 0)];
      }),
    ];
    const csvContent =
      '\uFEFF' +
      [headers, ...rows, ...channelRows]
        .map((line) => line.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCao_DoanhThu_Karat_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Tổng quan & Báo cáo Kinh doanh Đa kênh</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp doanh thu, đơn hàng, tồn kho và hiệu suất giữa các kênh POS, Web và Flutter Mobile
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {[
              { key: 7, label: '7 ngày' },
              { key: 30, label: '30 ngày' },
              { key: 'year', label: 'Năm nay' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  activePreset === p.key
                    ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('custom');
              }}
              className="focus:outline-none text-slate-700 tabular-nums"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('custom');
              }}
              className="focus:outline-none text-slate-700 tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel (.CSV)</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* KPI Cards Row 1: Doanh thu & Đơn hàng */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Doanh thu hoàn tất</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between tabular-nums">
              <span>Giá trị TB/đơn: {formatCurrency(avgOrderValue)}</span>
              {returnedAmount > 0 && (
                <span className="text-amber-600 font-medium">Hoàn: {formatCurrency(returnedAmount)}</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tổng số đơn hàng</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
              {formatNumber(totalOrders)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-3 tabular-nums">
              <span className="text-emerald-600 font-semibold">Hoàn tất: {formatNumber(completedOrders)}</span>
              <span className="text-blue-600 font-semibold">Đang xử lý: {formatNumber(openOrders)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tồn kho & Sản phẩm</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-600 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
              {formatNumber(dashboard?.inventory?.total_quantity ?? 0)}{' '}
              <span className="text-xs font-normal text-slate-500">đơn vị</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 flex items-center justify-between tabular-nums">
              <span>Đang kinh doanh: {formatNumber(dashboard?.products?.active_products ?? 0)} SP</span>
              <span className="text-slate-400">Ngừng bán: {formatNumber(dashboard?.products?.inactive_products ?? 0)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Cảnh báo tồn & Nhân sự</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl font-extrabold text-amber-600 tabular-nums">
              {formatNumber(dashboard?.inventory?.low_stock_lines ?? 0)}{' '}
              <span className="text-xs font-normal text-slate-500">SP chạm ngưỡng</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5 tabular-nums">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Tài khoản hoạt động: {formatNumber(dashboard?.users?.active_users ?? 0)} /{' '}
                {formatNumber(dashboard?.users?.total_users ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Tỷ trọng theo kênh bán hàng & Biểu đồ doanh thu theo ngày */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tỷ trọng theo kênh bán */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Doanh thu theo Kênh bán hàng</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh hiệu quả giữa bán tại quầy POS, Web và Mobile
              </p>

              <div className="mt-5 space-y-3.5">
                {['pos', 'web', 'mobile'].map((chKey) => {
                  const row = byChannel.find((c) => c.channel === chKey) || { orders: 0, revenue: 0 };
                  const meta = CHANNEL_META[chKey];
                  const Icon = meta.icon;
                  const rev = Number(row.revenue || 0);
                  const ord = Number(row.orders || 0);
                  const pct = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

                  return (
                    <div key={chKey} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={`p-1.5 rounded-lg border ${meta.badge}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{meta.label}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">{formatNumber(ord)} đơn hàng</div>
                          </div>
                        </div>
                        <div className="text-right tabular-nums">
                          <div className="text-xs font-bold text-slate-900">{formatCurrency(rev)}</div>
                          <div className="text-[11px] text-slate-500">{pct}% doanh thu</div>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.color} transition-all duration-300`}
                          style={{ width: `${Math.max(pct, rev > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Kỳ báo cáo:</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                {fromDate} → {toDate}
              </span>
            </div>
          </div>

          {/* Doanh thu theo ngày */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Biến động Doanh thu & Đơn hàng theo ngày</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thống kê chi tiết các ngày phát sinh đơn hàng trong kỳ ({byDay.length} ngày có giao dịch)
                </p>
              </div>
            </div>

            {byDay.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-xs text-slate-400">
                Chưa có dữ liệu đơn hàng trong khoảng thời gian đã chọn.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Biểu đồ Area / Line Chart trực quan */}
                {byDay.length > 1 && (() => {
                  const chartItems = byDay.slice(-14);
                  const w = 560;
                  const h = 135;
                  const padX = 28;
                  const padY = 18;
                  const pts = chartItems.map((d, idx) => {
                    const x = padX + (idx / Math.max(chartItems.length - 1, 1)) * (w - padX * 2);
                    const y = h - padY - (Number(d.revenue || 0) / maxDayRevenue) * (h - padY * 2);
                    return { x, y, date: String(d.date || '').slice(5, 10), rev: Number(d.revenue || 0) };
                  });
                  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${h - padY} L ${pts[0].x} ${h - padY} Z`;

                  return (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36 overflow-visible">
                        <defs>
                          <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Đường lưới ngang */}
                        {[0.25, 0.5, 0.75].map((r) => (
                          <line
                            key={r}
                            x1={padX}
                            y1={padY + r * (h - padY * 2)}
                            x2={w - padX}
                            y2={padY + r * (h - padY * 2)}
                            stroke="#e2e8f0"
                            strokeDasharray="4 4"
                          />
                        ))}
                        <path d={areaPath} fill="url(#revAreaGrad)" />
                        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                        {pts.map((p, idx) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                            <text
                              x={p.x}
                              y={h - 3}
                              textAnchor="middle"
                              className="fill-slate-500 text-[9px] font-mono"
                            >
                              {p.date}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                <div className="overflow-x-auto max-h-72 rounded-lg border border-slate-200/80">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500 bg-slate-50">
                        <th className="py-2.5 px-3.5">Ngày</th>
                        <th className="py-2.5 px-3.5 text-right">Số đơn</th>
                        <th className="py-2.5 px-3.5 text-right">Doanh thu hoàn tất</th>
                        <th className="py-2.5 px-3.5 w-48">Tỷ lệ trong kỳ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs tabular-nums">
                      {[...byDay].reverse().map((row) => {
                        const dateStr = String(row.date || '').slice(0, 10);
                        const rev = Number(row.revenue || 0);
                        const ord = Number(row.orders || 0);
                        const barPct = Math.round((rev / maxDayRevenue) * 100);
                        return (
                          <tr key={dateStr} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3.5 font-mono font-medium text-slate-800">{dateStr}</td>
                            <td className="py-2.5 px-3.5 text-right text-slate-700">{formatNumber(ord)}</td>
                            <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">
                              {formatCurrency(rev)}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${Math.max(barPct, rev > 0 ? 4 : 0)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
