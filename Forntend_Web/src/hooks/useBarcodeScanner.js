import { useEffect, useRef } from 'react';

/**
 * Hook lắng nghe tín hiệu từ máy quét mã vạch / đầu đọc Barcode (USB hoặc Bluetooth)
 * Máy quét mã vạch hoạt động như bàn phím ảo: gõ các ký tự với tốc độ cực nhanh (< 40ms/ký tự)
 * và kết thúc bằng phím 'Enter'.
 *
 * @param {Function} onScan - Callback được gọi khi quét mã thành công
 * @param {boolean} enabled - Bật/tắt lắng nghe
 */
export const useBarcodeScanner = (onScan, enabled = true) => {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      // Bỏ qua nếu người dùng đang nhập trong textarea hoặc input thường (trừ khi có thuộc tính data-barcode-target)
      const targetTag = event.target?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';
      const isBarcodeInput = event.target?.dataset?.barcodeInput === 'true';

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Nếu người dùng nhấn Enter
      if (event.key === 'Enter') {
        const code = bufferRef.current.trim();
        if (code.length >= 3) {
          event.preventDefault();
          onScan(code);
          bufferRef.current = '';
          return;
        }
        bufferRef.current = '';
        return;
      }

      // Nếu khoảng cách giữa 2 phím quá lâu (> 100ms) thì reset buffer (là người gõ tay chậm)
      if (diff > 100) {
        bufferRef.current = '';
      }

      // Chỉ gom các ký tự hợp lệ (chữ và số, dấu gạch nối)
      if (event.key.length === 1 && (!isInput || isBarcodeInput)) {
        bufferRef.current += event.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, enabled]);
};
