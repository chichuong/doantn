import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Tách tên mạng 2.4GHz tương ứng nếu máy tính đang bắt băng tần 5GHz của cùng Router
// VD: "Hue 5G" -> "Hue", "Hue L1_5G" -> "Hue L1", "Chon Rieng Cafe 1_5G" -> "Chon Rieng Cafe 1"
export const derive24GhzSsid = (ssid = '') => {
  const clean = String(ssid || '').trim();
  if (!clean) return '';
  return clean
    .replace(/[\s_-]+5g(hz)?$/i, '')
    .replace(/5g(hz)?$/i, '')
    .trim();
};

// Lấy đúng địa chỉ IPv4 của card Wi-Fi trên máy tính (loại bỏ VMware, VirtualBox, VPN ảo)
export const getPcWifiIpv4 = () => {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const [ifName, addresses] of Object.entries(nets)) {
    const lower = ifName.toLowerCase();
    // Bỏ qua các card mạng ảo
    if (
      lower.includes('vmware') ||
      lower.includes('vmnet') ||
      lower.includes('virtualbox') ||
      lower.includes('vethernet') ||
      lower.includes('wsl') ||
      lower.includes('vpn') ||
      lower.includes('bluetooth') ||
      lower.includes('loopback')
    ) {
      continue;
    }

    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        const isWifiName =
          lower.includes('wi-fi') ||
          lower.includes('wifi') ||
          lower.includes('wlan') ||
          lower.includes('wireless');
        candidates.push({
          ifName,
          address: addr.address,
          priority: isWifiName ? 1 : 2,
        });
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates.length > 0 ? candidates[0].address : '192.168.1.3';
};

// Đọc thông tin Wi-Fi hiện tại đang kết nối trên máy tính Windows (SSID + Mật khẩu + IP LAN)
export const detectCurrentPcWifi = async () => {
  const pcIp = getPcWifiIpv4();
  if (process.platform !== 'win32') {
    return { ssid: '', ssid24: '', password: '', pcIp, band: '' };
  }

  try {
    const { stdout: ifOut } = await execFileAsync('netsh', ['wlan', 'show', 'interfaces'], {
      timeout: 3500,
      windowsHide: true,
    });

    let currentSsid = '';
    let profileName = '';
    let band = '';

    for (const rawLine of ifOut.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (/^SSID\s*:/i.test(line) && !/^BSSID/i.test(line)) {
        currentSsid = line.replace(/^SSID\s*:\s*/i, '').trim();
      } else if (/^Profile\s*:/i.test(line)) {
        profileName = line.replace(/^Profile\s*:\s*/i, '').trim();
      } else if (/^Band\s*:/i.test(line)) {
        band = line.replace(/^Band\s*:\s*/i, '').trim();
      }
    }

    const targetProfile = profileName || currentSsid;
    let password = '';

    if (targetProfile) {
      try {
        const { stdout: profOut } = await execFileAsync(
          'netsh',
          ['wlan', 'show', 'profile', `name=${targetProfile}`, 'key=clear'],
          { timeout: 3500, windowsHide: true }
        );
        for (const rawLine of profOut.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (/^(Key Content|Nội dung khóa)\s*:/i.test(line)) {
            password = line.replace(/^(Key Content|Nội dung khóa)\s*:\s*/i, '').trim();
            break;
          }
        }
      } catch {
        // Ignore if profile has no password or requires elevation
      }
    }

    const ssid24 = derive24GhzSsid(currentSsid) || currentSsid;

    return {
      ssid: currentSsid,
      ssid24,
      password,
      pcIp,
      band,
    };
  } catch {
    return { ssid: '', ssid24: '', password: '', pcIp, band: '' };
  }
};

// Tự động đẩy cấu hình Wi-Fi của máy tính xuống mạch ESP32-S3 qua cáp USB Serial (COM port)
export const pushPcWifiOverUsbSerial = async (wifiInfo) => {
  if (process.platform !== 'win32' || !wifiInfo?.ssid) {
    return { pushed: false, ports: [], reason: 'No active PC Wi-Fi detected' };
  }

  // Cú pháp đồng bộ tự động qua USB Serial:
  // KARAT_WIFI:<SSID_2.4G>|<PASSWORD>|<PC_LAN_IP>|<SSID_ORIGINAL>
  const commandLine = `KARAT_WIFI:${wifiInfo.ssid24 || wifiInfo.ssid}|${wifiInfo.password || ''}|${wifiInfo.pcIp || ''}|${wifiInfo.ssid}`;

  const psScript = `
    $ports = [System.IO.Ports.SerialPort]::getportnames()
    $sentPorts = @()
    foreach ($p in $ports) {
      try {
        $sp = New-Object System.IO.Ports.SerialPort $p, 115200, 'None', 8, 'One'
        $sp.DtrEnable = $false
        $sp.RtsEnable = $false
        $sp.WriteTimeout = 800
        $sp.ReadTimeout = 800
        $sp.Open()
        $sp.WriteLine('${commandLine.replace(/'/g, "''")}')
        Start-Sleep -Milliseconds 120
        $sp.Close()
        $sentPorts += $p
      } catch {
        # Port might be busy in Arduino Serial Monitor
      }
    }
    Write-Output ($sentPorts -join ',')
  `;

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 4500, windowsHide: true }
    );
    const ports = stdout
      .trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      pushed: ports.length > 0,
      ports,
      commandSent: commandLine,
    };
  } catch {
    return { pushed: false, ports: [] };
  }
};
