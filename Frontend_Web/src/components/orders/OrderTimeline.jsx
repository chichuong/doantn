import React from 'react';
import { ORDER_TIMELINE_STEPS } from '../../utils/stateMachine';
import { ORDER_STATUS_META } from '../../utils/formatters';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  CheckCheck,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const OrderTimeline = ({ currentStatus, statusHistory = [] }) => {
  const isCancelled = currentStatus === 'cancelled';
  const isReturned = currentStatus === 'returned';

  const currentStepIdx = ORDER_TIMELINE_STEPS.findIndex(
    (step) => step.key === currentStatus
  );

  const stepIcons = {
    pending: Clock,
    confirmed: CheckCircle2,
    ready_to_pack: Package,
    packed: Package,
    handover: Truck,
    shipping: Truck,
    delivered: CheckCheck,
  };

  const stepDescriptions = {
    pending: 'Đơn hàng vừa được đặt, đang chờ cửa hàng xác nhận',
    confirmed: 'Cửa hàng đã xác nhận đơn & giữ chỗ tồn kho',
    ready_to_pack: 'Nhân viên kho đang lấy hàng trên kệ',
    packed: 'Kiện hàng đã được quét barcode & đóng gói hoàn tất',
    handover: 'Kiện hàng đã bàn giao cho Shipper vận chuyển',
    shipping: 'Shipper đang trên đường giao kiện hàng đến bạn',
    delivered: 'Giao hàng thành công! Cảm ơn bạn đã mua sắm tại Karat',
  };

  const progressPercent =
    isCancelled || isReturned || currentStepIdx < 0
      ? 0
      : Math.round((currentStepIdx / (ORDER_TIMELINE_STEPS.length - 1)) * 100);

  const ActiveBannerIcon = stepIcons[currentStatus] || Truck;

  const renderAnimatedScene = (status) => {
    // 1. Chờ xác nhận / Đã xác nhận: Nhân viên cầm sổ checklist tích chọn & ký duyệt (Widescreen 520x190)
    if (status === 'pending' || status === 'confirmed') {
      return (
        <svg viewBox="0 0 520 190" className="w-full h-44 sm:h-48 overflow-visible">
          <style>{`
            @keyframes penWriteWide {
              0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
              25% { transform: translate(18px, 14px) rotate(-10deg); }
              50% { transform: translate(6px, 34px) rotate(6deg); }
              75% { transform: translate(20px, 52px) rotate(-8deg); }
            }
            @keyframes boardFloatWide {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
            }
            @keyframes staffBob {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-3px); }
            }
            @keyframes checkPopW1 { 0%, 15% { opacity: 0.25; transform: scale(0.7); } 30%, 100% { opacity: 1; transform: scale(1); } }
            @keyframes checkPopW2 { 0%, 40% { opacity: 0.25; transform: scale(0.7); } 55%, 100% { opacity: 1; transform: scale(1); } }
            @keyframes checkPopW3 { 0%, 65% { opacity: 0.25; transform: scale(0.7); } 80%, 100% { opacity: 1; transform: scale(1); } }
            @keyframes pulseRing {
              0% { r: 8; opacity: 0.6; }
              100% { r: 22; opacity: 0; }
            }
          `}</style>

          {/* Nền trang trí văn phòng / quầy xử lý đơn */}
          <rect x="24" y="156" width="472" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
          <circle cx="80" cy="40" r="26" fill="rgba(255,255,255,0.06)" />
          <circle cx="440" cy="52" r="34" fill="rgba(255,255,255,0.05)" />

          {/* Nhân viên điều phối đơn hàng (bên trái) */}
          <g style={{ animation: 'staffBob 2s ease-in-out infinite' }}>
            {/* Bàn làm việc & Laptop */}
            <path d="M95 156 C95 110, 175 110, 175 156 Z" fill="#38bdf8" />
            <rect x="122" y="112" width="26" height="32" rx="4" fill="#e0f2fe" opacity="0.3" />
            {/* Cổ & Đầu nhân viên */}
            <rect x="129" y="96" width="12" height="16" rx="4" fill="#fde68a" />
            <circle cx="135" cy="78" r="24" fill="#fde68a" />
            {/* Tóc & Tai nghe CSKH */}
            <path d="M111 72 C111 46, 159 46, 159 72 Z" fill="#0f172a" />
            <path d="M110 76 C110 50, 160 50, 160 76" stroke="#fbbf24" strokeWidth="3.5" fill="none" />
            <circle cx="111" cy="78" r="5" fill="#fbbf24" />
            <path d="M111 82 Q120 92 132 90" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Mắt & Nụ cười */}
            <circle cx="128" cy="78" r="2.2" fill="#0f172a" />
            <circle cx="143" cy="78" r="2.2" fill="#0f172a" />
            <path d="M129 86 Q135 91 142 86" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Tay nhân viên đưa lên bảng */}
            <path d="M168 128 Q205 118 228 96" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round" fill="none" />
            <circle cx="230" cy="94" r="7" fill="#fde68a" />
          </g>

          {/* Bảng cuốn sổ Checklist lớn ở trung tâm */}
          <g style={{ animation: 'boardFloatWide 2.4s ease-in-out infinite' }}>
            {/* Bóng đổ của bảng */}
            <rect x="242" y="22" width="146" height="134" rx="14" fill="rgba(15,23,42,0.28)" />
            {/* Thân bảng trắng */}
            <rect x="236" y="16" width="146" height="134" rx="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="3" />
            {/* Kẹp hồ sơ kim loại vàng */}
            <rect x="284" y="8" width="50" height="16" rx="6" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
            <circle cx="309" cy="16" r="3" fill="#ffffff" />

            {/* Dòng tiêu đề trên sổ */}
            <rect x="256" y="34" width="68" height="7" rx="3.5" fill="#cbd5e1" />
            <rect x="332" y="34" width="30" height="7" rx="3.5" fill="#93c5fd" />

            {/* Task 1: Kiểm tra đơn hàng */}
            <g>
              <rect x="252" y="50" width="114" height="24" rx="7" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              <circle cx="268" cy="62" r="8" fill="#10b981" style={{ animation: 'checkPopW1 2.4s infinite', transformOrigin: '268px 62px' }} />
              <path d="M264 62 L267 65.5 L273 58.5" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <rect x="284" y="57" width="66" height="5" rx="2.5" fill="#334155" />
              <rect x="284" y="65" width="44" height="4" rx="2" fill="#94a3b8" />
            </g>

            {/* Task 2: Kiểm tra tồn kho */}
            <g>
              <rect x="252" y="80" width="114" height="24" rx="7" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              <circle cx="268" cy="92" r="8" fill="#10b981" style={{ animation: 'checkPopW2 2.4s infinite', transformOrigin: '268px 92px' }} />
              <path d="M264 92 L267 95.5 L273 88.5" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <rect x="284" y="87" width="58" height="5" rx="2.5" fill="#334155" />
              <rect x="284" y="95" width="38" height="4" rx="2" fill="#94a3b8" />
            </g>

            {/* Task 3: Xác nhận & chuyển kho */}
            <g>
              <rect x="252" y="110" width="114" height="24" rx="7" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              <circle
                cx="268"
                cy="122"
                r="8"
                fill={status === 'confirmed' ? '#10b981' : '#f59e0b'}
                style={{ animation: 'checkPopW3 2.4s infinite', transformOrigin: '268px 122px' }}
              />
              <path d="M264 122 L267 125.5 L273 118.5" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <rect x="284" y="117" width="70" height="5" rx="2.5" fill="#334155" />
              <rect x="284" y="125" width="48" height="4" rx="2" fill="#94a3b8" />
            </g>

            {/* Bút máy cam đang tích & ký duyệt */}
            <g style={{ animation: 'penWriteWide 2.4s ease-in-out infinite', transformOrigin: '365px 65px' }}>
              <rect x="358" y="34" width="13" height="52" rx="4.5" transform="rotate(35 358 34)" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
              <rect x="350" y="46" width="13" height="6" transform="rotate(35 350 46)" fill="#fde047" />
              <polygon points="329,74 337,65 342,71" fill="#0f172a" />
            </g>
          </g>
        </svg>
      );
    }

    // 2. Đóng gói kho: Băng chuyền + Thùng hàng + Tia Laser đỏ quét Barcode (Widescreen 520x190)
    if (status === 'ready_to_pack' || status === 'packed') {
      return (
        <svg viewBox="0 0 520 190" className="w-full h-44 sm:h-48 overflow-visible">
          <style>{`
            @keyframes laserScanWide {
              0%, 100% { transform: translateY(0px); opacity: 0.95; }
              50% { transform: translateY(58px); opacity: 0.7; }
            }
            @keyframes boxBounceWide {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-4px); }
            }
            @keyframes beltDash {
              from { stroke-dashoffset: 0; }
              to { stroke-dashoffset: -36; }
            }
          `}</style>

          {/* Kệ kho mờ phía sau */}
          <g opacity="0.18">
            <rect x="48" y="28" width="70" height="110" rx="4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
            <line x1="48" y1="64" x2="118" y2="64" stroke="#ffffff" strokeWidth="2.5" />
            <line x1="48" y1="100" x2="118" y2="100" stroke="#ffffff" strokeWidth="2.5" />
            <rect x="58" y="42" width="22" height="20" rx="2" fill="#ffffff" />
            <rect x="86" y="46" width="20" height="16" rx="2" fill="#ffffff" />
            <rect x="62" y="76" width="28" height="22" rx="2" fill="#ffffff" />

            <rect x="402" y="28" width="70" height="110" rx="4" stroke="#ffffff" strokeWidth="2.5" fill="none" />
            <line x1="402" y1="64" x2="472" y2="64" stroke="#ffffff" strokeWidth="2.5" />
            <line x1="402" y1="100" x2="472" y2="100" stroke="#ffffff" strokeWidth="2.5" />
            <rect x="414" y="44" width="24" height="18" rx="2" fill="#ffffff" />
            <rect x="418" y="78" width="32" height="20" rx="2" fill="#ffffff" />
          </g>

          {/* Cổng máy quét Barcode tự động phía trên */}
          <path d="M230 14 L290 14 L280 28 L240 28 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="2" />
          <circle cx="260" cy="21" r="4" fill="#ef4444" />

          {/* Băng chuyền kho dài */}
          <rect x="70" y="142" width="380" height="22" rx="11" fill="#1e293b" stroke="#475569" strokeWidth="2.5" />
          <line
            x1="90"
            y1="142"
            x2="430"
            y2="142"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeDasharray="18 18"
            style={{ animation: 'beltDash 0.8s linear infinite' }}
          />
          {[100, 145, 190, 235, 280, 325, 370, 415].map((cx) => (
            <circle key={cx} cx={cx} cy="153" r="6" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.5" />
          ))}

          {/* Thùng hàng Carton lớn ở giữa */}
          <g style={{ animation: 'boxBounceWide 1.4s ease-in-out infinite' }}>
            {/* Thân thùng */}
            <rect x="194" y="48" width="132" height="92" rx="10" fill="#fbbf24" stroke="#d97706" strokeWidth="3" />
            {/* Nắp & băng keo */}
            <line x1="194" y1="74" x2="326" y2="74" stroke="#d97706" strokeWidth="2.5" />
            <rect x="246" y="48" width="28" height="44" fill="#fef3c7" opacity="0.9" />
            {/* Tem Barcode lớn trên thùng */}
            <rect x="218" y="96" width="84" height="32" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            {[226, 232, 236, 243, 248, 255, 260, 267, 273, 279, 285, 292].map((bx, i) => (
              <rect key={bx} x={bx} y="102" width={i % 2 === 0 ? '3.2' : '1.8'} height="20" fill="#0f172a" />
            ))}

            {/* Chùm sáng & Tia Laser đỏ quét lên xuống */}
            <g style={{ animation: 'laserScanWide 1.5s ease-in-out infinite' }}>
              <polygon points="260,24 176,62 344,62" fill="rgba(239,68,68,0.15)" />
              <line x1="176" y1="62" x2="344" y2="62" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
              <line x1="184" y1="62" x2="336" y2="62" stroke="#fecaca" strokeWidth="1.5" />
            </g>
          </g>
        </svg>
      );
    }

    // 3. Shipper chạy xe giao hàng trên đường phố (Widescreen 520x190)
    if (status === 'handover' || status === 'shipping') {
      return (
        <svg viewBox="0 0 520 190" className="w-full h-44 sm:h-48 overflow-visible">
          <style>{`
            @keyframes roadMoveWide {
              from { stroke-dashoffset: 0; }
              to { stroke-dashoffset: -64; }
            }
            @keyframes bikeRideWide {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-5px) rotate(-1deg); }
            }
            @keyframes smokePuffWide {
              0% { transform: translate(0, 0) scale(0.5); opacity: 0.85; }
              100% { transform: translate(-48px, -14px) scale(1.8); opacity: 0; }
            }
            @keyframes windSlideWide {
              0% { transform: translateX(50px); opacity: 0; }
              50% { opacity: 0.75; }
              100% { transform: translateX(-90px); opacity: 0; }
            }
          `}</style>

          {/* Mây & Nhà cửa lướt phía xa */}
          <g opacity="0.16" style={{ animation: 'windSlideWide 3.2s linear infinite' }}>
            <rect x="90" y="66" width="38" height="90" rx="4" fill="#ffffff" />
            <rect x="136" y="84" width="30" height="72" rx="4" fill="#ffffff" />
            <rect x="360" y="58" width="44" height="98" rx="4" fill="#ffffff" />
            <rect x="412" y="78" width="32" height="78" rx="4" fill="#ffffff" />
          </g>

          {/* Mặt đường nhựa & vạch phân làn chạy liên tục */}
          <rect x="20" y="148" width="480" height="22" rx="11" fill="rgba(15,23,42,0.35)" />
          <line
            x1="36"
            y1="159"
            x2="484"
            y2="159"
            stroke="#ffffff"
            strokeWidth="4"
            strokeDasharray="32 32"
            strokeLinecap="round"
            style={{ animation: 'roadMoveWide 0.42s linear infinite' }}
          />

          {/* Vệt gió tốc độ cao */}
          <line x1="340" y1="44" x2="410" y2="44" stroke="rgba(255,255,255,0.65)" strokeWidth="3" strokeLinecap="round" style={{ animation: 'windSlideWide 0.85s linear infinite' }} />
          <line x1="370" y1="74" x2="435" y2="74" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'windSlideWide 1.05s linear infinite' }} />
          <line x1="110" y1="54" x2="165" y2="54" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'windSlideWide 0.95s linear infinite' }} />

          {/* Khói pô xe nở tròn */}
          <circle cx="158" cy="132" r="8" fill="rgba(255,255,255,0.65)" style={{ animation: 'smokePuffWide 0.75s ease-out infinite' }} />
          <circle cx="144" cy="126" r="11" fill="rgba(255,255,255,0.45)" style={{ animation: 'smokePuffWide 0.75s ease-out 0.28s infinite' }} />
          <circle cx="132" cy="120" r="14" fill="rgba(255,255,255,0.3)" style={{ animation: 'smokePuffWide 0.75s ease-out 0.52s infinite' }} />

          {/* Xe máy & Shipper lớn ở trung tâm */}
          <g style={{ animation: 'bikeRideWide 0.52s ease-in-out infinite' }}>
            {/* Thùng hàng Karat sau yên xe */}
            <rect x="166" y="60" width="54" height="46" rx="8" fill="#fbbf24" stroke="#ffffff" strokeWidth="3" />
            <path d="M182 83 L191 92 L206 75" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" />

            {/* Người Shipper đội mũ bảo hiểm xanh */}
            <circle cx="256" cy="46" r="16" fill="#fde68a" />
            <path d="M238 43 C238 25, 274 25, 274 43 Z" fill="#10b981" />
            <rect x="262" y="38" width="12" height="7" rx="3" fill="#e0f2fe" />
            {/* Áo khoác giao hàng */}
            <path d="M232 106 C232 70, 272 70, 276 102 L230 108 Z" fill="#38bdf8" />
            {/* Cánh tay cầm ghi-đông */}
            <line x1="264" y1="74" x2="298" y2="78" stroke="#fde68a" strokeWidth="8" strokeLinecap="round" />

            {/* Thân xe tay ga Scooter */}
            <path d="M178 106 L266 106 L290 78 L310 78 L324 124 L184 124 Z" fill="#ffffff" />
            <path d="M190 106 L260 106 L270 124 L184 124 Z" fill="#38bdf8" />

            {/* Đèn pha vàng rực rỡ phía trước */}
            <circle cx="315" cy="86" r="6" fill="#fde047" />
            <polygon points="321,80 395,62 395,112 321,92" fill="rgba(253,224,71,0.32)" />

            {/* Bánh sau & Bánh trước */}
            <circle cx="202" cy="132" r="20" fill="#0f172a" stroke="#ffffff" strokeWidth="4.5" />
            <circle cx="202" cy="132" r="7" fill="#38bdf8" />
            <circle cx="306" cy="132" r="20" fill="#0f172a" stroke="#ffffff" strokeWidth="4.5" />
            <circle cx="306" cy="132" r="7" fill="#38bdf8" />
          </g>
        </svg>
      );
    }

    // 4. Đã nhận hàng: Hộp quà hoàn tất + Ngôi sao & Pháo giấy lấp lánh (Widescreen 520x190)
    return (
      <svg viewBox="0 0 520 190" className="w-full h-44 sm:h-48 overflow-visible">
        <style>{`
          @keyframes giftPopWide {
            0%, 100% { transform: scale(1) translateY(0px); }
            50% { transform: scale(1.06) translateY(-6px); }
          }
          @keyframes starTwinkleWide {
            0%, 100% { transform: scale(0.75); opacity: 0.45; }
            50% { transform: scale(1.25); opacity: 1; }
          }
        `}</style>
        <circle cx="140" cy="46" r="6" fill="#fde047" style={{ animation: 'starTwinkleWide 1.2s infinite' }} />
        <circle cx="380" cy="40" r="7" fill="#fde047" style={{ animation: 'starTwinkleWide 1.5s 0.3s infinite' }} />
        <circle cx="400" cy="118" r="5.5" fill="#a7f3d0" style={{ animation: 'starTwinkleWide 1.1s 0.6s infinite' }} />
        <circle cx="120" cy="122" r="6" fill="#a7f3d0" style={{ animation: 'starTwinkleWide 1.4s 0.2s infinite' }} />
        <g style={{ animation: 'giftPopWide 1.8s ease-in-out infinite', transformOrigin: '260px 95px' }}>
          <rect x="206" y="60" width="108" height="86" rx="12" fill="#ffffff" />
          <rect x="198" y="42" width="124" height="24" rx="8" fill="#fde047" />
          <rect x="250" y="42" width="20" height="104" fill="#fbbf24" />
          <circle cx="304" cy="128" r="24" fill="#10b981" stroke="#ffffff" strokeWidth="4" />
          <path d="M293 128 L301 136 L316 120" stroke="#ffffff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Thanh Tiến trình (Stepper Bar) đặt lên đầu gọn gàng */}
      <div className="relative pt-2 pb-1 overflow-x-auto">
        <div className="relative min-w-[600px]">
          {/* Background Connecting Track */}
          <div className="absolute top-4 left-8 right-8 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            {/* Animated Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-blue-600 transition-all duration-700 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-7 gap-1 relative z-10">
            {ORDER_TIMELINE_STEPS.map((step, idx) => {
              const Icon = stepIcons[step.key] || CheckCircle2;
              const isCompleted = !isCancelled && !isReturned && idx < currentStepIdx;
              const isCurrent = !isCancelled && !isReturned && idx === currentStepIdx;

              return (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div className="relative flex items-center justify-center">
                    {isCurrent && (
                      <span className="absolute inline-flex w-10 h-10 rounded-full bg-blue-400/40 animate-ping" />
                    )}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 shadow-xs relative z-10 ${
                        isCurrent
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border-2 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-2 leading-tight ${
                      isCurrent
                        ? 'text-blue-700 font-bold'
                        : isCompleted
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Khung Video Hoạt Cảnh Lớn (Thay thế cho phần Lịch sử chuyển đổi trạng thái) */}
      {!isCancelled && !isReturned && currentStepIdx >= 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-5 text-white shadow-md">
          {/* Header trạng thái nổi bên trên khung video */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/15">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 border border-white/25 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-xl bg-white/30 animate-ping opacity-40" />
                <ActiveBannerIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-wide">
                    {ORDER_STATUS_META[currentStatus]?.label || currentStatus}
                  </span>
                </div>
                <p className="text-xs text-blue-100">
                  {stepDescriptions[currentStatus] || 'Đang xử lý đơn hàng của bạn'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white border border-white/20">
              Tiến độ: Bước {currentStepIdx + 1}/{ORDER_TIMELINE_STEPS.length} ({progressPercent}%)
            </span>
          </div>

          {/* Sân khấu Video Animation cỡ lớn */}
          <div className="mt-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs px-4 py-2 flex items-center justify-center">
            {renderAnimatedScene(currentStatus)}
          </div>
        </div>
      )}

      {/* Exception Alert for Cancelled or Returned */}
      {(isCancelled || isReturned) && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
            isCancelled
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-orange-50 border-orange-200 text-orange-700'
          }`}
        >
          {isCancelled ? (
            <XCircle className="w-4 h-4 shrink-0 text-red-600" />
          ) : (
            <RotateCcw className="w-4 h-4 shrink-0 text-orange-600" />
          )}
          <div>
            <span>Đơn hàng kết thúc ở trạng thái: </span>
            <strong className="uppercase font-semibold">
              {ORDER_STATUS_META[currentStatus]?.label || currentStatus}
            </strong>
            <p className="text-[11px] font-normal opacity-90 mt-0.5">
              {isCancelled
                ? 'Đơn đã hủy và toàn bộ tồn kho đang giữ đã được hoàn trả.'
                : 'Đơn hàng được ghi nhận hoàn trả về kho và tạo chứng từ hoàn hàng.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
