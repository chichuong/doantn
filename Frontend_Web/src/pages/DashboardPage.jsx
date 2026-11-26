import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
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
  ChevronRight,
  Zap,
  Activity,
  ShoppingBag,
  ClipboardList,
  FileCheck,
  Boxes,
  BrainCircuit,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import { managerApi } from '../api/managerApi';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';

const CHANNEL_META = {
  pos: {
    label: 'Bán trực tiếp tại quầy (POS)',
    icon: Store,
    barColor: 'bg-[#b8860b]',
    badge: 'bg-[#fdf8e6] text-[#926a09] border-[#f7e08f]',
  },
  web: {
    label: 'Website trực tuyến',
    icon: Globe,
    barColor: 'bg-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  mobile: {
    label: 'Ứng dụng di động',
    icon: Smartphone,
    barColor: 'bg-violet-600',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
  },
};

export const DashboardPage = () => {
  const { user, hasPermission } = useAuth();
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

  const activeProducts = Number(dashboard?.products?.active_products ?? 0);
  const inactiveProducts = Number(dashboard?.products?.inactive_products ?? 0);
  const totalProducts = Math.max(activeProducts + inactiveProducts, 0);
  const lowStockLines = Number(dashboard?.inventory?.low_stock_lines ?? 0);
  const totalStockUnits = Number(dashboard?.inventory?.total_quantity ?? 0);
  const healthyProducts = Math.max(activeProducts - lowStockLines, 0);

  const byChannel = report?.byChannel || [];
  const byDay = report?.byDay || [];
  const maxDayRevenue = Math.max(...byDay.map((d) => Number(d.revenue || 0)), 1);

  const greetingName =
    (user?.fullName || user?.full_name || user?.name || 'Quản lý').split(' ').slice(-2).join(' ');

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

  // Donut percentages for Stock Health
  const denom = Math.max(healthyProducts + lowStockLines + inactiveProducts, 1);
  const healthyPct = Math.round((healthyProducts / denom) * 100);
  const lowPct = Math.round((lowStockLines / denom) * 100);
  const inactivePct = Math.max(0, 100 - healthyPct - lowPct);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1680px] mx-auto p-4 sm:p-6 space-y-5">
        {/* ============ Page Header (c2-head) ============ */}
        <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trang chủ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Tổng quan Kho & Kinh doanh</span>
            </nav>
            <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 mt-1">
              Điều hành Kho & Bán lẻ
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi trực tiếp lưu chuyển hàng hóa, đơn hàng đa kênh và hiệu suất doanh thu tại kho
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="c2-live">
              <i className="c2-live-dot" aria-hidden="true" />
              <span>Trực tuyến</span>
            </span>

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs shadow-2xs">
              {[
                { key: 7, label: '7 ngày' },
                { key: 30, label: '30 ngày' },
                { key: 'year', label: 'Năm nay' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    activePreset === p.key
                      ? 'bg-[#fdf8e6] text-[#926a09] border border-[#f7e08f]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-xl px-3 h-9 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#b8860b] shrink-0" />
              <input
                type="date"
                aria-label="Từ ngày"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="focus:outline-none focus:shadow-none border-none text-slate-700 tabular-nums bg-transparent"
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
                className="focus:outline-none focus:shadow-none border-none text-slate-700 tabular-nums bg-transparent"
              />
            </div>

            <button type="button" onClick={handleExportCsv} className="wm-btn wm-btn-ghost">
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="wm-btn wm-btn-primary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* ============ Hero Row: Animated Warehouse Scene (8 cols) + 2 Live Widgets (4 cols) ============ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          <div className="xl:col-span-8 flex flex-col gap-3.5">
            {/* Warehouse Illustrated Hero Banner */}
            <section
              className="hw-banner flex-1 min-h-[270px] sm:min-h-[300px] flex flex-col justify-start"
              aria-label="Tổng quan vận hành kho"
            >
              <svg
                className="hw-scene"
                viewBox="0 0 1200 300"
                preserveAspectRatio="xMaxYMax slice"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <radialGradient id="hwSun" cx=".5" cy=".5" r=".5">
                    <stop offset="0" stopColor="#fff6cc" stopOpacity=".95" />
                    <stop offset=".5" stopColor="#f7d268" stopOpacity=".45" />
                    <stop offset="1" stopColor="#f7d268" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="hwRoof" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f7d268" />
                    <stop offset=".55" stopColor="#d4af37" />
                    <stop offset="1" stopColor="#b8860b" />
                  </linearGradient>
                  <g id="hwTruck">
                    <rect x="0" y="0" width="92" height="38" rx="5" fill="#fff" stroke="#d4af37" strokeWidth="1.5" />
                    <path d="M10 19h72" stroke="#d4af37" strokeOpacity=".4" />
                    <rect x="95" y="9" width="38" height="29" rx="7" fill="#d4af37" />
                    <rect x="116" y="13" width="13" height="10" rx="3" fill="#fff" />
                    <circle cx="20" cy="41" r="7" fill="#3a2a04" />
                    <circle cx="66" cy="41" r="7" fill="#3a2a04" />
                    <circle cx="116" cy="41" r="7" fill="#3a2a04" />
                    <circle cx="20" cy="41" r="2.8" fill="#f7d268" />
                    <circle cx="66" cy="41" r="2.8" fill="#f7d268" />
                    <circle cx="116" cy="41" r="2.8" fill="#f7d268" />
                  </g>
                </defs>
                <g className="hw-sun">
                  <circle cx="930" cy="96" r="130" fill="url(#hwSun)" />
                  <circle cx="930" cy="96" r="44" fill="#fff3c1" />
                  <g className="hw-rays" stroke="#f7d268" strokeWidth="3" strokeLinecap="round" opacity=".7">
                    <path d="M992 96L1014 96" />
                    <path d="M985.9 122.9L1005.7 132.4" />
                    <path d="M968.7 144.5L982.4 161.7" />
                    <path d="M943.8 156.4L948.7 177.9" />
                    <path d="M916.2 156.4L911.3 177.9" />
                    <path d="M891.3 47.5L877.6 30.3" />
                    <path d="M968.7 47.5L982.4 30.3" />
                  </g>
                </g>
                <g className="hw-cloud" style={{ '--d': '65s', '--t': '0s' }} transform="translate(0 38)">
                  <rect x="0" y="22" width="150" height="30" rx="15" fill="#fff" opacity=".75" />
                  <rect x="26" y="4" width="80" height="34" rx="17" fill="#fff" opacity=".75" />
                </g>
                <rect x="396" y="180" width="78" height="70" rx="4" fill="#e9d28b" opacity=".55" />
                <rect x="480" y="198" width="54" height="52" rx="4" fill="#e9d28b" opacity=".55" />
                <rect x="540" y="146" width="340" height="104" rx="6" fill="#fffdf6" stroke="#d4af37" strokeOpacity=".7" strokeWidth="2" />
                <path d="M522 156Q710 98 898 156L880 168H540Z" fill="url(#hwRoof)" />
                <rect x="662" y="172" width="96" height="18" rx="9" fill="#3a2a04" />
                <text x="710" y="185" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="1.5" fill="#f7d268">
                  WH-01
                </text>
                {[566, 640, 714, 788].map((x) => (
                  <g key={x}>
                    <rect x={x} y="196" width="56" height="54" rx="5" fill="#2a2008" />
                    <rect x={x + 6} y="226" width="16" height="18" rx="2" fill="#e9c35a" />
                    <rect x={x + 26} y="232" width="20" height="12" rx="2" fill="#f3e3b0" />
                    <rect x={x} y="196" width="56" height="18" rx="4" fill="#f1ead2" stroke="#cdbf98" />
                  </g>
                ))}
                <rect x="920" y="176" width="230" height="74" rx="6" fill="#fffdf6" stroke="#d4af37" strokeOpacity=".6" strokeWidth="2" />
                <path d="M906 184Q1035 146 1164 184L1150 194H920Z" fill="url(#hwRoof)" />
                <rect x="940" y="206" width="50" height="44" rx="4" fill="#2a2008" />
                <rect x="1010" y="206" width="50" height="44" rx="4" fill="#2a2008" />
                <rect x="1080" y="206" width="50" height="44" rx="4" fill="#2a2008" />
                <rect x="0" y="250" width="1200" height="50" fill="#4a3a14" />
                <rect x="0" y="250" width="1200" height="4" fill="#d4af37" opacity=".7" />
                <path d="M0 278H1200" stroke="#fff3c1" strokeWidth="3" strokeDasharray="26 22" opacity=".8" />
                <g className="hw-tr1">
                  <use href="#hwTruck" transform="translate(-170 226) scale(.9)" />
                </g>
                <g className="hw-tr2">
                  <g transform="translate(1380 258)">
                    <use href="#hwTruck" transform="scale(-.78 .78)" />
                  </g>
                </g>
              </svg>

              <div className="max-w-lg relative z-10 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-xs border border-[#d4af37]/40 text-[11px] font-bold text-[#735309]">
                  <Activity className="w-3.5 h-3.5 text-[#b8860b]" />
                  <span>Trung tâm Điều phối Kho & Bán lẻ Karat</span>
                </span>

                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1e1604]">
                  Xin chào, {greetingName}
                </h2>

                <p className="text-xs sm:text-sm text-[#4a3a14] leading-relaxed bg-white/65 backdrop-blur-xs rounded-xl p-3 border border-white/80">
                  Hiện có <b className="font-extrabold text-[#1e1604]">{formatNumber(openOrders)}</b> đơn đang xử lý,{' '}
                  <b className="font-extrabold text-[#926a09]">{formatNumber(lowStockLines)}</b> mặt hàng chạm ngưỡng cảnh báo tồn và tổng{' '}
                  <b className="font-extrabold text-[#1e1604]">{formatNumber(totalStockUnits)}</b> đơn vị hàng hóa trong kho.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Link to="/orders" className="wm-btn wm-btn-primary shadow-md">
                    <ShoppingBag className="w-4 h-4" />
                    <span>Quản lý đơn hàng</span>
                  </Link>
                  <Link to="/inventory" className="wm-btn wm-btn-ghost !bg-white/90">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Rà soát tồn kho thấp</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* 3 Summary KPI Cards placed cleanly BELOW the animated warehouse road */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="c2-card !p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Tổng đơn kỳ</span>
                  <b className="text-xl font-extrabold text-slate-900 tabular-nums">
                    {formatNumber(totalOrders)}
                  </b>
                </div>
                <span className="w-9 h-9 rounded-xl bg-[#fdf8e6] border border-[#f7e08f] text-[#b8860b] flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </span>
              </div>

              <div className="c2-card !p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Đã hoàn tất</span>
                  <b className="text-xl font-extrabold text-emerald-700 tabular-nums">
                    {formatNumber(completedOrders)}
                  </b>
                </div>
                <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>

              <div className="c2-card !p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Nhân sự Active</span>
                  <b className="text-xl font-extrabold text-slate-900 tabular-nums">
                    {formatNumber(dashboard?.users?.active_users ?? 0)} / {formatNumber(dashboard?.users?.total_users ?? 0)}
                  </b>
                </div>
                <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          {/* Two Stacked Right Live Widgets */}
          <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-5">
            {/* Widget 1: Revenue Sparkline */}
            <section className="c2-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="c2-ico">
                      <DollarSign className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Doanh thu hoàn tất</h2>
                      <p className="text-[11px] text-slate-500">Tổng hợp tất cả kênh bán</p>
                    </div>
                  </div>
                  <Link
                    to="/orders"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-[#fdf8e6] text-slate-600 hover:text-[#926a09] flex items-center justify-center transition"
                    aria-label="Mở đơn hàng"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="mt-3 flex items-baseline flex-wrap gap-2">
                  <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {formatCurrency(totalRevenue)}
                  </span>
                  <span className="wm-badge wm-badge-gold">
                    TB/đơn: {formatCurrency(avgOrderValue)}
                  </span>
                </div>
                {returnedAmount > 0 && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1 tabular-nums">
                    Hoàn trả trong kỳ: {formatCurrency(returnedAmount)}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <svg viewBox="0 0 200 52" preserveAspectRatio="none" className="w-full h-12" aria-hidden="true">
                  <defs>
                    <linearGradient id="hwSparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4af37" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 44C20 42 35 36 55 38C75 40 92 26 115 28C138 30 155 15 178 17C190 18 195 10 200 8L200 52L0 52Z"
                    fill="url(#hwSparkFill)"
                  />
                  <path
                    d="M0 44C20 42 35 36 55 38C75 40 92 26 115 28C138 30 155 15 178 17C190 18 195 10 200 8"
                    fill="none"
                    stroke="#b8860b"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>{fromDate}</span>
                  <span>Kỳ báo cáo</span>
                  <span>{toDate}</span>
                </div>
              </div>
            </section>

            {/* Widget 2: Operational Bays / Metrics Grid */}
            <section className="c2-card flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="c2-ico">
                    <Boxes className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Chỉ số Kho & Đơn hàng</h2>
                    <p className="text-[11px] text-slate-500">Kho trung tâm · WH-01</p>
                  </div>
                </div>
                <Link to="/inventory" className="text-xs font-bold text-[#926a09] hover:underline">
                  Tồn kho
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                    <span>Hoàn tất</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg font-extrabold text-emerald-900 mt-0.5 tabular-nums">
                    {formatNumber(completedOrders)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#fdf8e6] border border-[#f7e08f]">
                  <div className="flex items-center justify-between text-[11px] text-[#735309] font-semibold">
                    <span>Đang xử lý</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-[#b8860b]" />
                  </div>
                  <div className="text-lg font-extrabold text-[#5a4208] mt-0.5 tabular-nums">
                    {formatNumber(openOrders)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                    <span>SP kinh doanh</span>
                    <Package className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5 tabular-nums">
                    {formatNumber(activeProducts)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                  <div className="flex items-center justify-between text-[11px] text-amber-800 font-semibold">
                    <span>Tồn chạm ngưỡng</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-extrabold text-amber-700 mt-0.5 tabular-nums">
                    {formatNumber(lowStockLines)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* ============ Row 2: Stock Health Donut + Omnichannel Breakdown + Quick Actions ============ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Card 1: Stock Health Donut (modeled on c2-health-card) */}
          <section className="c2-card flex flex-col justify-between">
            <div>
              <header className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="c2-ico">
                    <Activity className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Sức khỏe Hàng tồn kho</h2>
                    <p className="text-[11px] text-slate-500">
                      {formatNumber(totalProducts)} danh mục sản phẩm trên hệ thống
                    </p>
                  </div>
                </div>
                <Link to="/inventory" className="text-xs font-bold text-[#926a09] hover:underline">
                  Chi tiết
                </Link>
              </header>

              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="11" pathLength="100" />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="11"
                      pathLength="100"
                      strokeDasharray={`${healthyPct} 100`}
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="11"
                      pathLength="100"
                      strokeDasharray={`${lowPct} 100`}
                      strokeDashoffset={`-${healthyPct}`}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="11"
                      pathLength="100"
                      strokeDasharray={`${inactivePct} 100`}
                      strokeDashoffset={`-${healthyPct + lowPct}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <b className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">
                      {formatNumber(totalProducts)}
                    </b>
                    <small className="text-[10px] text-slate-500 mt-0.5">sản phẩm</small>
                  </div>
                </div>

                <ul className="flex-1 space-y-2.5 text-xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600">
                      <i className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Đủ tồn an toàn</span>
                    </span>
                    <span className="tabular-nums font-bold text-slate-900">
                      {formatNumber(healthyProducts)}{' '}
                      <em className="not-italic text-[11px] font-normal text-slate-400">({healthyPct}%)</em>
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600">
                      <i className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Chạm ngưỡng thấp</span>
                    </span>
                    <span className="tabular-nums font-bold text-amber-700">
                      {formatNumber(lowStockLines)}{' '}
                      <em className="not-italic text-[11px] font-normal text-slate-400">({lowPct}%)</em>
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-slate-600">
                      <i className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Ngừng kinh doanh</span>
                    </span>
                    <span className="tabular-nums font-bold text-slate-700">
                      {formatNumber(inactiveProducts)}{' '}
                      <em className="not-italic text-[11px] font-normal text-slate-400">({inactivePct}%)</em>
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-100 text-center">
              <div className="p-2 rounded-xl bg-slate-50">
                <small className="block text-[10.5px] text-slate-500">Tổng tồn</small>
                <b className="text-xs font-extrabold text-slate-900 tabular-nums">
                  {formatNumber(totalStockUnits)} ĐV
                </b>
              </div>
              <div className="p-2 rounded-xl bg-slate-50">
                <small className="block text-[10.5px] text-slate-500">Đang mở bán</small>
                <b className="text-xs font-extrabold text-emerald-700 tabular-nums">
                  {formatNumber(activeProducts)} SP
                </b>
              </div>
              <div className="p-2 rounded-xl bg-slate-50">
                <small className="block text-[10.5px] text-slate-500">Cần nhập thêm</small>
                <b className="text-xs font-extrabold text-amber-700 tabular-nums">
                  {formatNumber(lowStockLines)} SP
                </b>
              </div>
            </div>
          </section>

          {/* Card 2: Omnichannel Revenue Share */}
          <section className="c2-card flex flex-col justify-between">
            <div>
              <header className="flex items-center gap-2.5 mb-4">
                <span className="c2-ico">
                  <TrendingUp className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Doanh thu theo Kênh bán</h2>
                  <p className="text-[11px] text-slate-500">So sánh tỷ trọng POS, Website và Mobile</p>
                </div>
              </header>

              <div className="space-y-3">
                {['pos', 'web', 'mobile'].map((chKey) => {
                  const row = byChannel.find((c) => c.channel === chKey) || { orders: 0, revenue: 0 };
                  const meta = CHANNEL_META[chKey];
                  const Icon = meta.icon;
                  const rev = Number(row.revenue || 0);
                  const ord = Number(row.orders || 0);
                  const pct = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;

                  return (
                    <div
                      key={chKey}
                      className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`p-1.5 rounded-lg border shrink-0 ${meta.badge}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{meta.label}</div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {formatNumber(ord)} đơn hàng
                            </div>
                          </div>
                        </div>
                        <div className="text-right tabular-nums shrink-0">
                          <div className="text-xs font-extrabold text-slate-900">{formatCurrency(rev)}</div>
                          <div className="text-[11px] text-slate-500">{pct}%</div>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.barColor} transition-all duration-300`}
                          style={{ width: `${Math.max(pct, rev > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Tài khoản vận hành</span>
              </span>
              <span className="font-bold text-slate-800 tabular-nums">
                {formatNumber(dashboard?.users?.active_users ?? 0)} đang hoạt động
              </span>
            </div>
          </section>

          {/* Card 3: Quick Actions Grid (modeled on c2-qa-card) */}
          <section className="c2-card flex flex-col justify-between">
            <header className="flex items-center gap-2.5 mb-4">
              <span className="c2-ico">
                <Zap className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tác vụ Kho & Bán hàng nhanh</h2>
                <p className="text-[11px] text-slate-500">Truy cập ngay các nghiệp vụ thường dùng</p>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-2.5 flex-1">
              {[
                {
                  to: '/pos',
                  title: 'Mở Quầy POS',
                  sub: 'Bán lẻ & in bill K80',
                  icon: ShoppingBag,
                },
                {
                  to: '/orders',
                  title: 'Xử lý Đơn hàng',
                  sub: 'Theo dõi & giao vận',
                  icon: ClipboardList,
                },
                {
                  to: '/products',
                  title: 'Danh mục SP',
                  sub: 'Giá vốn & mã SKU',
                  icon: Package,
                },
                {
                  to: '/warehouse-approvals',
                  title: 'Duyệt Phiếu kho',
                  sub: 'Xác thực QR & IoT',
                  icon: FileCheck,
                },
                {
                  to: '/inventory',
                  title: 'Cân & Kiểm kho',
                  sub: 'Điều chỉnh tồn thực tế',
                  icon: Boxes,
                },
                {
                  to: '/forecasting',
                  title: 'Dự báo AI',
                  sub: 'Gợi ý nhập hàng sớm',
                  icon: BrainCircuit,
                },
              ].map((qa) => {
                const Icon = qa.icon;
                return (
                  <Link
                    key={qa.to}
                    to={qa.to}
                    className="group p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-[#fdf8e6] hover:border-[#f7d268] transition flex flex-col justify-between"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 group-hover:border-[#f7d268] text-[#926a09] flex items-center justify-center shadow-2xs mb-2">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <b className="block text-xs font-bold text-slate-900 group-hover:text-[#735309]">
                        {qa.title}
                      </b>
                      <small className="block text-[11px] text-slate-500">{qa.sub}</small>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        {/* ============ Row 3: Daily Revenue Golden Area Chart & Detailed Table ============ */}
        <section className="c2-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Biến động Doanh thu & Lưu lượng Đơn theo ngày
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Thống kê chi tiết các ngày phát sinh giao dịch trong kỳ ({byDay.length} ngày ghi nhận)
              </p>
            </div>
            <div className="text-right tabular-nums">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Tổng lũy kế kỳ chọn
              </span>
              <span className="text-xl font-extrabold text-[#926a09]">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          {byDay.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              Chưa có dữ liệu đơn hàng trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
              {/* Golden Area Chart */}
              {byDay.length > 1 &&
                (() => {
                  const chartItems = byDay.slice(-14);
                  const w = 560;
                  const h = 165;
                  const padX = 28;
                  const padY = 20;
                  const pts = chartItems.map((d, idx) => {
                    const x = padX + (idx / Math.max(chartItems.length - 1, 1)) * (w - padX * 2);
                    const y = h - padY - (Number(d.revenue || 0) / maxDayRevenue) * (h - padY * 2);
                    return { x, y, date: String(d.date || '').slice(5, 10), rev: Number(d.revenue || 0) };
                  });
                  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${h - padY} L ${pts[0].x} ${h - padY} Z`;
                  const lastPt = pts[pts.length - 1];

                  return (
                    <div className="xl:col-span-7 p-4 rounded-2xl bg-gradient-to-b from-[#fffdf7] to-slate-50/70 border border-[#f7e08f]/60">
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 overflow-visible">
                        <defs>
                          <linearGradient id="c2GoldArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.38" />
                            <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
                          </linearGradient>
                          <linearGradient id="c2GoldStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#b8860b" />
                            <stop offset="55%" stopColor="#d4af37" />
                            <stop offset="100%" stopColor="#eab308" />
                          </linearGradient>
                        </defs>
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
                        <path d={areaPath} fill="url(#c2GoldArea)" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="url(#c2GoldStroke)"
                          strokeWidth="2.75"
                          strokeLinecap="round"
                        />
                        {pts.map((p, idx) => (
                          <g key={idx}>
                            <circle cx={p.x} cy={p.y} r="3.8" fill="#ffffff" stroke="#b8860b" strokeWidth="2.2" />
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
                        {lastPt && (
                          <circle cx={lastPt.x} cy={lastPt.y} r="8" fill="#d4af37" fillOpacity="0.25" />
                        )}
                      </svg>
                    </div>
                  );
                })()}

              {/* Table */}
              <div
                className={`${
                  byDay.length > 1 ? 'xl:col-span-5' : 'xl:col-span-12'
                } overflow-x-auto max-h-72 rounded-xl border border-slate-200`}
              >
                <table className="wm-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th className="text-right">Số đơn</th>
                      <th className="text-right">Doanh thu</th>
                      <th className="w-28">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {[...byDay].reverse().map((row) => {
                      const dateStr = String(row.date || '').slice(0, 10);
                      const rev = Number(row.revenue || 0);
                      const ord = Number(row.orders || 0);
                      const barPct = Math.round((rev / maxDayRevenue) * 100);
                      return (
                        <tr key={dateStr}>
                          <td className="font-mono font-semibold text-slate-800">{dateStr}</td>
                          <td className="text-right text-slate-600">{formatNumber(ord)}</td>
                          <td className="text-right font-bold text-slate-900">{formatCurrency(rev)}</td>
                          <td>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#d4af37] to-[#b8860b] rounded-full"
                                style={{ width: `${Math.max(barPct, rev > 0 ? 5 : 0)}%` }}
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
        </section>
      </div>
    </div>
  );
};
