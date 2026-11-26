import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { inventoryApi } from '../../api/inventoryApi';
import { formatNumber } from '../../utils/formatters';
import {
  Camera,
  Wifi,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Sliders,
  RefreshCw,
  ExternalLink,
  Volume2,
  VolumeX,
  Crosshair,
  Sparkles,
  Laptop,
  Cpu,
  Radio,
  Lock,
  X,
} from 'lucide-react';

// Phát âm báo "Bíp" ngắn bằng Web Audio API khi quét thành công
const playScanBeep = (success = true) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(success ? 1046.5 : 320, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.16 : 0.28));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.17 : 0.3));
  } catch {
    // Ignore audio context restriction
  }
};

export const IotCameraScannerModal = ({ isOpen, onClose, onScanVerified }) => {
  // 'esp32' = Luồng Camera IoT ESP32-S3 | 'webcam' = Camera trực tiếp trên trình duyệt
  const [cameraMode, setCameraMode] = useState('esp32');
  const [espIp, setEspIp] = useState(() => localStorage.getItem('karat_esp32_ip') || 'karat-cam.local');
  const [activeEspIp, setActiveEspIp] = useState(() => localStorage.getItem('karat_esp32_ip') || 'karat-cam.local');
  const [autoDetectedInfo, setAutoDetectedInfo] = useState(null);
  const [useFallbackStreamPort, setUseFallbackStreamPort] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showWifiProvisionModal, setShowWifiProvisionModal] = useState(false);

  // Cấu hình tạo mã QR kết nối Wi-Fi & Quét sóng Wi-Fi từ xa cho ESP32
  const [pcWifiInfo, setPcWifiInfo] = useState(null);
  const [wifiSsid, setWifiSsid] = useState(() => localStorage.getItem('karat_wifi_ssid') || 'Hue');
  const [wifiPass, setWifiPass] = useState('');
  const [backendLanIp, setBackendLanIp] = useState('192.168.1.3');
  const [wifiQrDataUrl, setWifiQrDataUrl] = useState('');
  const [scannedNetworks, setScannedNetworks] = useState([]);
  const [scanningWifi, setScanningWifi] = useState(false);
  const [syncingPcWifi, setSyncingPcWifi] = useState(false);
  const [wifiConnectStatus, setWifiConnectStatus] = useState('');

  // Thông số điều khiển cảm biến OV5640 từ xa
  const [sensorConfig, setSensorConfig] = useState({
    contrast: 2,
    brightness: 0,
    sharpness: 2,
    vflip: 1,
  });

  // Trạng thái telemetry từ ESP32 (/status)
  const [espStatus, setEspStatus] = useState({
    online: false,
    ssid: '',
    rssi: 0,
    scanFps: 0,
    totalDetections: 0,
    qrVisible: false,
    corners: null,
    frameWidth: 320,
    frameHeight: 240,
    lastCode: '',
    lastMessage: '',
  });

  // Kết quả đối soát chứng từ từ Backend
  const [scannedDoc, setScannedDoc] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [manualQrInput, setManualQrInput] = useState('');

  // Refs cho vẽ khung ngắm & Webcam
  const overlayCanvasRef = useRef(null);
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const lastProcessedCodeRef = useRef('');
  const lastProcessedTimeRef = useRef(0);

  // Tự động nhận diện Wi-Fi đang kết nối trên Máy tính Windows & IP của ESP32-S3
  const autoDetectEspDevice = useCallback(async () => {
    try {
      const res = await inventoryApi.getIotStatus();
      const info = res?.data || res;
      if (Array.isArray(info?.serverLanIps) && info.serverLanIps.length > 0) {
        setBackendLanIp(info.serverLanIps[0]);
      }
      if (info?.pcWifi?.ssid) {
        setPcWifiInfo(info.pcWifi);
        setWifiSsid((prev) => prev || info.pcWifi.ssid24 || info.pcWifi.ssid);
        if (info.pcWifi.password) {
          setWifiPass((prev) => prev || info.pcWifi.password);
        }
        if (info.pcWifi.pcIp) {
          setBackendLanIp(info.pcWifi.pcIp);
        }
      }
      if (info?.device?.ip) {
        setAutoDetectedInfo(info.device);
        setEspIp(info.device.ip);
        setActiveEspIp(info.device.ip);
        setUseFallbackStreamPort(false);
        setStreamError(false);
        localStorage.setItem('karat_esp32_ip', info.device.ip);
      }
    } catch {
      // Ignore if backend iot status endpoint not reachable
    }
  }, []);

  // Đồng bộ 1 chạm: Lấy thẳng Wi-Fi đang kết nối trên Máy tính đẩy xuống ESP32 qua cáp USB + LAN
  const handleOneClickSyncPcWifi = async () => {
    try {
      setSyncingPcWifi(true);
      setWifiConnectStatus('Đang đọc Wi-Fi trên máy tính của bạn và đẩy xuống mạch ESP32-S3...');
      const res = await inventoryApi.syncPcWifiToIot();
      const data = res?.data || res;
      const pc = data?.pcWifi;
      if (pc?.ssid) {
        const target24 = pc.ssid24 || pc.ssid;
        setPcWifiInfo(pc);
        setWifiSsid(target24);
        if (pc.password) setWifiPass(pc.password);
        if (pc.pcIp) setBackendLanIp(pc.pcIp);

        // Nếu ESP32 đang online trong LAN, đẩy đồng thời qua HTTP
        if (activeEspIp) {
          fetch(
            `http://${activeEspIp}/wifi/connect?ssid=${encodeURIComponent(target24)}&pass=${encodeURIComponent(
              pc.password || ''
            )}&host=${encodeURIComponent(pc.pcIp || '')}`,
            { mode: 'cors' }
          ).catch(() => {});
        }

        const ports = data?.usbSync?.ports || [];
        setWifiConnectStatus(
          ports.length > 0
            ? `✓ Đã tự động lấy Wi-Fi máy tính "${pc.ssid}" (băng tần 2.4GHz: "${target24}") và đẩy thẳng xuống mạch ESP32 qua cổng USB (${ports.join(', ')})!`
            : `✓ Đã nhận diện Wi-Fi máy tính "${pc.ssid}" -> "${target24}" (IP máy: ${pc.pcIp}). Đã cập nhật mã QR & gửi lệnh đồng bộ!`
        );
        setTimeout(autoDetectEspDevice, 3500);
      }
    } catch {
      setWifiConnectStatus('Không thể đọc thông tin Wi-Fi từ máy tính.');
    } finally {
      setSyncingPcWifi(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    autoDetectEspDevice();
    const timer = setInterval(autoDetectEspDevice, 6000);
    return () => clearInterval(timer);
  }, [isOpen, autoDetectEspDevice]);

  // Sinh mã QR cấu hình Wi-Fi & IP Backend tự động cho ESP32-S3
  useEffect(() => {
    if (!showWifiProvisionModal) return;
    const cleanSsid = wifiSsid.trim();
    const cleanHost = backendLanIp.trim();
    if (!cleanSsid) {
      setWifiQrDataUrl('');
      return;
    }
    localStorage.setItem('karat_wifi_ssid', cleanSsid);
    // Định dạng KARAT_WIFI:<SSID>|<PASS>|<BACKEND_IP> được ESP32-S3 v2.5 nhận diện tức thì
    const qrPayload = `KARAT_WIFI:${cleanSsid}|${wifiPass}|${cleanHost}`;
    QRCode.toDataURL(qrPayload, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setWifiQrDataUrl(url))
      .catch(() => setWifiQrDataUrl(''));
  }, [showWifiProvisionModal, wifiSsid, wifiPass, backendLanIp]);

  // Quét danh sách sóng Wi-Fi 2.4GHz xung quanh mạch ESP32-S3
  const handleScanEspWifiNetworks = async () => {
    if (!activeEspIp) return;
    try {
      setScanningWifi(true);
      setWifiConnectStatus('Đang yêu cầu ESP32-S3 dò các mạng Wi-Fi 2.4GHz xung quanh...');
      const res = await fetch(`http://${activeEspIp}/wifi/scan`, { mode: 'cors' });
      const list = await res.json();
      setScannedNetworks(Array.isArray(list) ? list : []);
      setWifiConnectStatus(
        Array.isArray(list) && list.length > 0
          ? `Tìm thấy ${list.length} mạng Wi-Fi 2.4GHz xung quanh mạch ESP32-S3.`
          : 'Không tìm thấy mạng Wi-Fi 2.4GHz nào.'
      );
    } catch {
      setWifiConnectStatus(
        'Mạch ESP32 chưa kết nối cùng mạng. Hãy giơ Mã QR bên trái vào trước Camera ESP32 để mạch tự động nhận diện và kết nối Wi-Fi!'
      );
    } finally {
      setScanningWifi(false);
    }
  };

  // Gửi lệnh đổi Wi-Fi & IP Backend trực tiếp tới ESP32-S3 qua HTTP
  const handleDirectWifiConnect = async (e) => {
    e.preventDefault();
    if (!activeEspIp || !wifiSsid.trim()) return;
    try {
      setWifiConnectStatus(`Đang gửi cấu hình Wi-Fi "${wifiSsid.trim()}" xuống ESP32-S3...`);
      await fetch(
        `http://${activeEspIp}/wifi/connect?ssid=${encodeURIComponent(
          wifiSsid.trim()
        )}&pass=${encodeURIComponent(wifiPass)}&host=${encodeURIComponent(backendLanIp.trim())}`,
        { mode: 'cors' }
      );
      setWifiConnectStatus(
        `Đã gửi thành công! ESP32-S3 đang tự kết nối tới "${wifiSsid.trim()}" và sẽ tự báo danh IP mới sau vài giây.`
      );
      setTimeout(autoDetectEspDevice, 4500);
    } catch {
      setWifiConnectStatus(
        'Không thể gửi qua mạng. Hãy đưa Mã QR bên trái vào trước ống kính Camera ESP32-S3 để kết nối!'
      );
    }
  };

  // Tra cứu mã QR lên Backend Karat Retail
  const handleVerifyQrCode = useCallback(
    async (rawCode, source = 'esp32_s3_camera') => {
      const code = String(rawCode || '').trim();
      if (!code || code.startsWith('WIFI:') || code.startsWith('KARAT_WIFI:')) return;

      const now = Date.now();
      if (
        code === lastProcessedCodeRef.current &&
        now - lastProcessedTimeRef.current < 3000
      ) {
        return;
      }
      lastProcessedCodeRef.current = code;
      lastProcessedTimeRef.current = now;

      try {
        setLookupLoading(true);
        setLookupError('');
        const res = await inventoryApi.lookupDocumentByQr(code, source);
        const doc = res?.data || res;
        setScannedDoc(doc);
        if (soundEnabled) playScanBeep(doc?.status === 'approved');
        if (onScanVerified) onScanVerified(doc);
      } catch (err) {
        if (soundEnabled) playScanBeep(false);
        setScannedDoc(null);
        setLookupError(
          err?.response?.data?.message ||
            err.message ||
            `Không tìm thấy chứng từ khớp với mã "${code}"`
        );
      } finally {
        setLookupLoading(false);
      }
    },
    [soundEnabled, onScanVerified]
  );

  // Lưu địa chỉ IP ESP32 và kết nối
  const handleConnectEsp = (e) => {
    if (e) e.preventDefault();
    const cleanIp = espIp.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    setEspIp(cleanIp);
    setActiveEspIp(cleanIp);
    setUseFallbackStreamPort(false);
    setStreamError(false);
    setStreamConnected(false);
    localStorage.setItem('karat_esp32_ip', cleanIp);
  };

  // Gửi lệnh chỉnh thông số hình ảnh tới ESP32-S3 (/control?var=...&val=...)
  const handleSensorControl = async (variable, value) => {
    setSensorConfig((prev) => ({ ...prev, [variable]: value }));
    if (!activeEspIp) return;
    try {
      await fetch(`http://${activeEspIp}/control?var=${variable}&val=${value}`, {
        mode: 'cors',
      });
    } catch {
      // Bỏ qua nếu ESP32 đang bận
    }
  };

  // Poll trạng thái thời gian thực từ ESP32-S3 (/status) để vẽ khung xanh quanh mã QR & tự động nhận mã
  useEffect(() => {
    if (!isOpen || cameraMode !== 'esp32' || !activeEspIp) return;

    let cancelled = false;
    const pollInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const res = await fetch(`http://${activeEspIp}/status`, {
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setEspStatus({
          online: true,
          ssid: data.ssid || '',
          rssi: Number(data.rssi || 0),
          scanFps: Number(data.scanFps || 0),
          totalDetections: Number(data.totalDetections || 0),
          qrVisible: Boolean(data.qrVisible),
          corners: data.corners || null,
          frameWidth: Number(data.frameWidth || 320),
          frameHeight: Number(data.frameHeight || 240),
          lastCode: data.lastCode || '',
          lastMessage: data.lastMessage || '',
        });
        setStreamError(false);

        // Vẽ đa giác (Bounding Box) màu xanh lá quanh mã QR trên Canvas overlay
        const canvas = overlayCanvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (data.qrVisible && Array.isArray(data.corners) && data.corners.length === 4) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3.5;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.20)';
            ctx.beginPath();
            ctx.moveTo(data.corners[0].x, data.corners[0].y);
            for (let i = 1; i < 4; i++) {
              ctx.lineTo(data.corners[i].x, data.corners[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        // Nếu ESP32 vừa phát hiện mã QR mới trong vòng 2.5 giây qua, tự động đồng bộ lên giao diện Web
        if (data.lastCode && Number(data.lastScanAgeMs || 99999) < 2800) {
          handleVerifyQrCode(data.lastCode, 'esp32_s3_camera');
        }
      } catch {
        if (!cancelled) {
          setEspStatus((prev) => ({ ...prev, online: false, qrVisible: false }));
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [isOpen, cameraMode, activeEspIp, handleVerifyQrCode]);

  // Chế độ 2: Mở Webcam trực tiếp trên trình duyệt + Quét QR tự động bằng BarcodeDetector
  useEffect(() => {
    if (!isOpen || cameraMode !== 'webcam') {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      return;
    }

    let active = true;
    let scanTimer = null;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          scanTimer = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              const canvas = overlayCanvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (barcodes.length > 0) {
                  const b = barcodes[0];
                  if (b.cornerPoints && b.cornerPoints.length === 4) {
                    const scaleX = canvas.width / (videoRef.current.videoWidth || 640);
                    const scaleY = canvas.height / (videoRef.current.videoHeight || 480);
                    ctx.strokeStyle = '#10b981';
                    ctx.lineWidth = 3.5;
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
                    ctx.beginPath();
                    ctx.moveTo(b.cornerPoints[0].x * scaleX, b.cornerPoints[0].y * scaleY);
                    for (let i = 1; i < 4; i++) {
                      ctx.lineTo(b.cornerPoints[i].x * scaleX, b.cornerPoints[i].y * scaleY);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                  }
                  if (b.rawValue) {
                    setEspStatus((prev) => ({
                      ...prev,
                      qrVisible: true,
                      lastCode: b.rawValue,
                    }));
                    handleVerifyQrCode(b.rawValue, 'web_camera_scanner');
                  }
                } else {
                  setEspStatus((prev) => ({ ...prev, qrVisible: false }));
                }
              }
            } catch {
              // Ignore single frame detection error
            }
          }, 80);
        }
      } catch {
        setLookupError('Không thể truy cập Webcam trình duyệt. Vui lòng cấp quyền Camera hoặc chuyển sang tab Camera IoT ESP32-S3.');
      }
    };

    startWebcam();

    return () => {
      active = false;
      if (scanTimer) clearInterval(scanTimer);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, cameraMode, handleVerifyQrCode]);

  if (!isOpen) return null;

  const streamUrl = activeEspIp
    ? useFallbackStreamPort
      ? `http://${activeEspIp}/stream`
      : `http://${activeEspIp}:81/stream`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trạm Camera Quét QR Đối soát Kho"
        className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b border-slate-200 text-slate-900 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2 text-slate-900">
                <span>Trạm Camera &amp; Quét QR Đối Soát Kho</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Auto-WiFi v2.5
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Tự động nhận diện IP Camera ESP32-S3, hiển thị khung ngắm QR &amp; hỗ trợ đổi Wi-Fi bằng mã QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setCameraMode('esp32')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  cameraMode === 'esp32'
                    ? 'bg-white text-slate-900 border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Camera IoT ESP32-S3</span>
              </button>
              <button
                type="button"
                onClick={() => setCameraMode('webcam')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                  cameraMode === 'webcam'
                    ? 'bg-white text-slate-900 border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Webcam Máy tính</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition"
              title={soundEnabled ? 'Tắt âm báo Bíp' : 'Bật âm báo Bíp'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 transition"
              aria-label="Đóng cửa sổ camera"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body 2 Cột */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50">
          {/* CỘT TRÁI (7/12): KHUNG NHÌN CAMERA TRỰC TIẾP & KHUNG NGẮM QR */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {cameraMode === 'esp32' && (
              <form
                onSubmit={handleConnectEsp}
                className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Wifi
                    className={`w-4 h-4 shrink-0 ${
                      espStatus.online || streamConnected ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    IP Camera:
                  </span>
                  <input
                    type="text"
                    value={espIp}
                    onChange={(e) => setEspIp(e.target.value)}
                    placeholder="Tự nhận diện hoặc nhập IP..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  {autoDetectedInfo?.ip && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Tự nhận diện
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kết nối</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOneClickSyncPcWifi}
                    disabled={syncingPcWifi}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                    title="Tự động lấy Wi-Fi hiện tại của máy tính và kết nối ESP32 chung Wi-Fi với máy tính"
                  >
                    <Radio className={`w-3.5 h-3.5 ${syncingPcWifi ? 'animate-spin' : ''}`} />
                    <span>
                      {pcWifiInfo?.ssid
                        ? `Đồng bộ Wi-Fi Máy (${pcWifiInfo.ssid24 || pcWifiInfo.ssid})`
                        : 'Đồng bộ Wi-Fi Máy tính'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowWifiProvisionModal(!showWifiProvisionModal)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                      showWifiProvisionModal
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Xem chi tiết cấu hình Wi-Fi & Mã QR"
                  >
                    <span>QR Wi-Fi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowControls(!showControls)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                      showControls
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Chỉnh nét</span>
                  </button>

                  {activeEspIp && (
                    <a
                      href={`http://${activeEspIp}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 transition"
                      title="Mở trang Camera gốc của ESP32 trong tab mới"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </form>
            )}

            {/* KHUNG CÀI ĐẶT & TỰ ĐỘNG KẾT NỐI WI-FI CHO ESP32 BẰNG MÃ QR / QUÉT SÓNG */}
            {cameraMode === 'esp32' && showWifiProvisionModal && (
              <div className="p-4 rounded-xl bg-white border-2 border-emerald-200 space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Tự động nhận diện & kết nối Wi-Fi cho Camera ESP32-S3
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWifiProvisionModal(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Thu gọn
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Mã QR cấu hình Wi-Fi tự động */}
                  <div className="sm:col-span-5 flex flex-col items-center text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                    {wifiQrDataUrl ? (
                      <img
                        src={wifiQrDataUrl}
                        alt="Mã QR cấu hình Wi-Fi tự động cho ESP32-S3"
                        className="w-36 h-36 rounded-lg border border-slate-200 bg-white p-1"
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">
                        Nhập tên Wi-Fi
                      </div>
                    )}
                    <span className="mt-2 text-[11px] font-bold text-emerald-700">
                      Cách 1: Giơ mã QR này trước Camera ESP32
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Camera đọc mã này sẽ tự lưu Wi-Fi + IP máy tính và tự động kết nối ngay!
                    </p>
                  </div>

                  {/* Form nhập & quét sóng Wi-Fi xung quanh ESP32 */}
                  <form onSubmit={handleDirectWifiConnect} className="sm:col-span-7 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700">Tên Wi-Fi (2.4GHz):</label>
                      <button
                        type="button"
                        onClick={handleScanEspWifiNetworks}
                        disabled={scanningWifi}
                        className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${scanningWifi ? 'animate-spin' : ''}`} />
                        <span>Dò sóng quanh ESP32</span>
                      </button>
                    </div>

                    {scannedNetworks.length > 0 && (
                      <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-slate-50">
                        {scannedNetworks.map((net, i) => (
                          <button
                            key={`${net.ssid}-${i}`}
                            type="button"
                            onClick={() => setWifiSsid(net.ssid)}
                            className="w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between hover:bg-blue-50 transition"
                          >
                            <span className="font-semibold text-slate-800 truncate">{net.ssid}</span>
                            <span className="text-[11px] text-blue-600 font-mono shrink-0 flex items-center gap-1">
                              <span>{net.rssi} dBm</span>
                              {!net.open && <Lock className="w-3 h-3 text-slate-400" />}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="Nhập hoặc chọn tên Wi-Fi 2.4GHz..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                    />

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Mật khẩu Wi-Fi:</label>
                      <input
                        type="password"
                        value={wifiPass}
                        onChange={(e) => setWifiPass(e.target.value)}
                        placeholder="Nhập mật khẩu Wi-Fi..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        IP LAN máy tính chạy Backend (tự nhận diện):
                      </label>
                      <input
                        type="text"
                        value={backendLanIp}
                        onChange={(e) => setBackendLanIp(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                    >
                      Cách 2: Gửi lệnh đổi Wi-Fi trực tiếp xuống ESP32
                    </button>

                    {wifiConnectStatus && (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        {wifiConnectStatus}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* KHUNG NHÌN CAMERA TRỰC TIẾP (LIVE VIEWFINDER + AIMING RETICLE) */}
            <div
              className={`relative w-full aspect-4/3 rounded-xl overflow-hidden bg-neutral-900 border-2 transition-all duration-200 flex items-center justify-center ${
                espStatus.qrVisible
                  ? 'border-emerald-500'
                  : 'border-neutral-300'
              }`}
            >
              {cameraMode === 'esp32' ? (
                <>
                  {streamUrl && !streamError ? (
                    <img
                      key={streamUrl}
                      src={streamUrl}
                      alt="Luồng trực tiếp Camera ESP32-S3 OV5640"
                      className="w-full h-full object-contain select-none"
                      onLoad={() => {
                        setStreamConnected(true);
                        setStreamError(false);
                      }}
                      onError={() => {
                        if (!useFallbackStreamPort) {
                          setUseFallbackStreamPort(true);
                        } else {
                          setStreamConnected(false);
                          setStreamError(true);
                        }
                      }}
                    />
                  ) : (
                    <div className="p-6 text-center max-w-md space-y-3 text-neutral-300">
                      <Camera className="w-10 h-10 text-neutral-400 mx-auto" />
                      <div className="text-sm font-bold text-white">
                        Đang dò tìm tín hiệu Camera IoT ESP32-S3 ({activeEspIp})
                      </div>
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        • Khi mạch ESP32-S3 cấp nguồn và kết nối Wi-Fi, hệ thống sẽ <strong>tự động nhận diện IP</strong> và hiển thị hình ảnh tại đây.<br />
                        • Nếu bạn mới đổi mạng Wi-Fi, hãy bấm nút <strong>"Cài Wi-Fi tự động"</strong> phía trên để tạo mã QR Wi-Fi cho Camera đọc!
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Lớp phủ Canvas vẽ khung xanh lá quanh mã QR theo thời gian thực */}
              <canvas
                ref={overlayCanvasRef}
                width={espStatus.frameWidth || 320}
                height={espStatus.frameHeight || 240}
                className="absolute inset-0 w-full h-full pointer-events-none object-contain"
              />

              {/* KHUNG NGẮM TÂM QUÉT QR (AIMING RETICLE OVERLAY) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`relative w-[64%] h-[68%] rounded-xl border-2 border-dashed transition-all duration-200 flex items-center justify-center ${
                    espStatus.qrVisible
                      ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
                      : 'border-white/60 bg-black/10'
                  }`}
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  <span
                    className={`absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${
                      espStatus.qrVisible ? 'border-emerald-400' : 'border-white'
                    }`}
                  />
                  <span
                    className={`absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${
                      espStatus.qrVisible ? 'border-emerald-400' : 'border-white'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${
                      espStatus.qrVisible ? 'border-emerald-400' : 'border-white'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${
                      espStatus.qrVisible ? 'border-emerald-400' : 'border-white'
                    }`}
                  />

                  <Crosshair
                    className={`w-6 h-6 transition-opacity ${
                      espStatus.qrVisible ? 'text-emerald-400 opacity-90' : 'text-white/50'
                    }`}
                  />

                  <div
                    className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide whitespace-nowrap border ${
                      espStatus.qrVisible
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-neutral-900/90 text-white border-white/25'
                    }`}
                  >
                    {espStatus.qrVisible
                      ? '✓ ĐÃ BẮT ĐƯỢC MÃ QR TRONG VÙNG NGẮM!'
                      : 'ĐẶT MÃ QR VÀO KHUNG NGẮM NÀY (CÁCH 15 - 25 CM)'}
                  </div>
                </div>
              </div>

              {/* Thanh trạng thái FPS & Wi-Fi góc trên bên trái */}
              <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    cameraMode === 'webcam' || espStatus.online || streamConnected
                      ? 'bg-emerald-950/85 text-emerald-200 border-emerald-500/40'
                      : 'bg-neutral-900/85 text-neutral-300 border-white/15'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cameraMode === 'webcam' || espStatus.online || streamConnected
                        ? 'bg-emerald-400'
                        : 'bg-neutral-400'
                    }`}
                  />
                  {cameraMode === 'esp32'
                    ? espStatus.online
                      ? `ESP32-S3 (${espStatus.scanFps.toFixed(1)} FPS)`
                      : streamConnected
                      ? 'ESP32-S3 Video Stream'
                      : 'Đang tự dò ESP32-S3...'
                    : 'Webcam Trực tiếp (Auto-QR)'}
                </span>

                {cameraMode === 'esp32' && espStatus.ssid && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-900/85 text-white border border-white/20">
                    Wi-Fi: {espStatus.ssid} ({espStatus.rssi} dBm)
                  </span>
                )}
              </div>
            </div>

            {/* Thanh trượt tinh chỉnh ống kính OV5640 */}
            {cameraMode === 'esp32' && showControls && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shadow-2xs">
                <div>
                  <label className="font-semibold text-slate-700 flex justify-between mb-1">
                    <span>Tương phản:</span>
                    <span className="text-blue-600 font-mono">{sensorConfig.contrast}</span>
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    value={sensorConfig.contrast}
                    onChange={(e) => handleSensorControl('contrast', e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 flex justify-between mb-1">
                    <span>Độ sáng:</span>
                    <span className="text-blue-600 font-mono">{sensorConfig.brightness}</span>
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    value={sensorConfig.brightness}
                    onChange={(e) => handleSensorControl('brightness', e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 flex justify-between mb-1">
                    <span>Độ sắc nét:</span>
                    <span className="text-blue-600 font-mono">{sensorConfig.sharpness}</span>
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    value={sensorConfig.sharpness}
                    onChange={(e) => handleSensorControl('sharpness', e.target.value)}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lật dọc ảnh:</label>
                  <select
                    value={sensorConfig.vflip}
                    onChange={(e) => handleSensorControl('vflip', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs"
                  >
                    <option value={1}>Thuận chiều (1)</option>
                    <option value={0}>Đảo chiều (0)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI (5/12): KẾT QUẢ NHẬN DIỆN QR & ĐỐI SOÁT PHIẾU KHO */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualQrInput.trim()) {
                    handleVerifyQrCode(manualQrInput.trim(), 'esp32_s3_camera');
                    setManualQrInput('');
                  }
                }}
                className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 shadow-2xs"
              >
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span>Mã QR vừa nhận diện / Nhập mã kiểm tra nhanh:</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualQrInput}
                    onChange={(e) => setManualQrInput(e.target.value)}
                    placeholder={
                      espStatus.lastCode
                        ? `Vừa quét: ${espStatus.lastCode}`
                        : 'VD: DOC:NK-... hoặc đưa mã vào khung ngắm'
                    }
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={lookupLoading}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shrink-0 disabled:opacity-50"
                  >
                    Đối soát
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Đối soát thất bại</div>
                    <div className="mt-0.5">{lookupError}</div>
                  </div>
                </div>
              )}

              {scannedDoc ? (
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Chứng từ đối soát
                      </span>
                      <h3 className="text-base font-bold font-mono text-blue-700">
                        {scannedDoc.document_number}
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                        scannedDoc.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : scannedDoc.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : scannedDoc.status === 'rejected'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {scannedDoc.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {scannedDoc.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                      {scannedDoc.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                      <span>
                        {scannedDoc.status === 'approved'
                          ? 'HỢP LỆ - ĐÃ DUYỆT'
                          : scannedDoc.status === 'pending'
                          ? 'CHỜ PHÊ DUYỆT'
                          : scannedDoc.status === 'rejected'
                          ? 'BỊ TỪ CHỐI'
                          : scannedDoc.status === 'completed'
                          ? 'ĐÃ HOÀN TẤT'
                          : scannedDoc.status}
                      </span>
                    </span>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg text-xs font-semibold ${
                      scannedDoc.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : scannedDoc.status === 'pending'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {scannedDoc.status === 'approved'
                      ? '✓ Đã ghi nhận xác thực QR IoT! Thủ kho có thể tiến hành kiểm đếm và hoàn tất nhập/xuất kho.'
                      : scannedDoc.status === 'pending'
                      ? '⚠ Phiếu này chưa được Quản lý phê duyệt. Không được phép xuất/nhập hàng!'
                      : scannedDoc.status === 'completed'
                      ? 'ℹ Phiếu kho này đã được thực hiện hoàn tất trước đó.'
                      : '⚠ Phiếu không đủ điều kiện thực hiện.'}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Loại phiếu:</span>
                      <span className="font-bold text-slate-800">
                        {scannedDoc.type === 'receipt' ? 'Nhập kho (Receipt)' : 'Xuất kho (Issue)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Kho hàng:</span>
                      <span className="font-bold text-slate-800">{scannedDoc.warehouse_name}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase text-slate-500">
                      Mặt hàng cần kiểm đếm ({scannedDoc.items?.length || 0})
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {scannedDoc.items?.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 text-xs flex items-center justify-between gap-2 bg-white"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                            <div className="text-[11px] font-mono text-slate-500">SKU: {item.sku}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold tabular-nums shrink-0">
                            x {formatNumber(item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-xl bg-white border border-slate-200 text-center space-y-2 shadow-2xs">
                  <QrCode className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    Sẵn sàng nhận diện mã QR Phiếu Kho & QR Wi-Fi
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    • Đưa <strong>mã QR Phiếu kho</strong> vào khung ngắm nét đứt ở giữa để đối soát tức thì.<br />
                    • Hoặc đưa <strong>mã QR Chia sẻ Wi-Fi</strong> trên điện thoại vào khung ngắm để ESP32-S3 tự động đổi mạng Wi-Fi!
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-blue-800">Cơ chế Tự nhận diện & Kết nối Wi-Fi (v2.5):</div>
              <div>1. Tự động dò sóng 2.4GHz mạnh nhất đã lưu trong bộ nhớ Flash (NVS).</div>
              <div>2. Quét trực tiếp mã QR Chia sẻ Wi-Fi từ điện thoại hoặc nút <strong>Cài Wi-Fi tự động</strong>.</div>
              <div>3. Tự động báo danh IP Camera về Backend để Web tự hiển thị hình mà không cần nhập IP.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
