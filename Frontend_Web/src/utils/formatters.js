/**
 * Định dạng tiền tệ VND
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Định dạng số lượng
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

/**
 * Định dạng ngày giờ chuẩn Việt Nam
 */
export const formatDateTime = (dateStr) => {
  if (!dateStr) return '---';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDate = formatDateTime;

/**
 * Bản dịch và màu sắc trạng thái Đơn hàng (Chuẩn WareHouse POS)
 */
export const ORDER_STATUS_META = {
  pending: {
    label: 'Chờ xác nhận',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    stepIndex: 0,
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: 'bg-[#fdf8e6] text-[#926a09] border-[#f7e08f]',
    stepIndex: 1,
  },
  ready_to_pack: {
    label: 'Chờ đóng gói',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    stepIndex: 2,
  },
  packed: {
    label: 'Đã đóng gói',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    stepIndex: 3,
  },
  handover: {
    label: 'Đã bàn giao vận chuyển',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    stepIndex: 4,
  },
  shipping: {
    label: 'Đang vận chuyển',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    stepIndex: 5,
  },
  delivered: {
    label: 'Hoàn tất / Đã nhận',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stepIndex: 6,
  },
  cancelled: {
    label: 'Đã hủy đơn',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    stepIndex: -1,
  },
  returned: {
    label: 'Đã trả hàng / Hoàn tiền',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    stepIndex: -2,
  },
};

/**
 * Bản dịch kênh bán hàng
 */
export const CHANNEL_META = {
  pos: { label: 'Quầy POS', badge: 'bg-[#fdf8e6] text-[#926a09] border-[#f7e08f]' },
  web: { label: 'Website Online', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mobile: { label: 'App Di động', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
};
