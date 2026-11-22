import * as warehouseService from '../services/warehouse.service.js';
import {
  detectCurrentPcWifi,
  getPcWifiIpv4,
  pushPcWifiOverUsbSerial,
} from '../services/iot-wifi-sync.service.js';

// Lưu trạng thái thiết bị IoT ESP32-S3 tự động báo danh trong mạng LAN
let latestIotDeviceState = {
  ip: null,
  hostname: 'karat-cam.local',
  ssid: null,
  rssi: null,
  scanFps: 0,
  streamPort: 81,
  lastSeenAt: null,
};

let lastAutoUsbSyncAt = 0;

export const recordIotHeartbeat = async (request, response) => {
  const rawIp =
    request.body?.ip ||
    request.query?.ip ||
    (request.ip ? String(request.ip).replace(/^::ffff:/, '') : null);

  if (rawIp && rawIp !== '127.0.0.1' && rawIp !== '::1') {
    latestIotDeviceState = {
      ip: String(rawIp).trim(),
      hostname: request.body?.hostname || 'karat-cam.local',
      ssid: request.body?.ssid || latestIotDeviceState.ssid,
      rssi: request.body?.rssi ?? latestIotDeviceState.rssi,
      scanFps: Number(request.body?.scanFps ?? latestIotDeviceState.scanFps ?? 0),
      streamPort: Number(request.body?.streamPort || 81),
      lastSeenAt: new Date().toISOString(),
    };
  }
  return response.json({
    data: {
      registered: true,
      device: latestIotDeviceState,
      serverLanIps: [getPcWifiIpv4()],
    },
  });
};

export const getIotStatus = async (_request, response) => {
  const now = Date.now();
  const lastSeenMs = latestIotDeviceState.lastSeenAt
    ? new Date(latestIotDeviceState.lastSeenAt).getTime()
    : 0;
  const online = Boolean(latestIotDeviceState.ip && now - lastSeenMs < 45000);
  const pcWifi = await detectCurrentPcWifi();

  // Nếu ESP32 chưa báo danh hoặc mất kết nối, tự động đẩy Wi-Fi hiện tại của máy tính xuống cổng USB COM
  let autoUsbPush = null;
  if (!online && pcWifi.ssid && now - lastAutoUsbSyncAt > 15000) {
    lastAutoUsbSyncAt = now;
    autoUsbPush = await pushPcWifiOverUsbSerial(pcWifi);
  }

  return response.json({
    data: {
      online,
      device: latestIotDeviceState,
      serverLanIps: [pcWifi.pcIp],
      pcWifi: {
        ssid: pcWifi.ssid,
        ssid24: pcWifi.ssid24,
        password: pcWifi.password,
        pcIp: pcWifi.pcIp,
        band: pcWifi.band,
      },
      autoUsbPush,
    },
  });
};

export const syncPcWifiToIot = async (_request, response) => {
  const pcWifi = await detectCurrentPcWifi();
  const usbResult = await pushPcWifiOverUsbSerial(pcWifi);
  return response.json({
    data: {
      pcWifi,
      usbSync: usbResult,
      device: latestIotDeviceState,
    },
  });
};

export const scan = async (request, response) => response.json({ data: await warehouseService.scan(request.query.identifier, request.query.warehouseId) });
export const listInventory = async (request, response) => response.json(await warehouseService.inventory(request.query, request.user.warehouse_ids));
export const listDocuments = async (request, response) => response.json(await warehouseService.documents(request.query));
export const getDocument = async (request, response) => response.json({ data: await warehouseService.documentDetail(request.params.documentId) });
export const createDocument = async (request, response) => response.status(201).json({ data: await warehouseService.createWarehouseDocument(request.body, request.user.id, request.user.warehouse_ids) });
export const approveDocument = async (request, response) => response.json({ data: await warehouseService.approve(request.params.documentId, request.user.id, request.user.role_code) });
export const rejectDocument = async (request, response) => response.json({ data: await warehouseService.reject(request.params.documentId, request.user.id, request.body.reason) });
export const lookupByQr = async (request, response) => {
  const identifier = request.params.identifier || request.query.identifier;
  if (request.isIotDevice) {
    const devIp =
      request.query.deviceIp ||
      request.headers['x-device-ip'] ||
      (request.ip ? String(request.ip).replace(/^::ffff:/, '') : null);
    if (devIp && devIp !== '127.0.0.1' && devIp !== '::1') {
      latestIotDeviceState = {
        ...latestIotDeviceState,
        ip: String(devIp).trim(),
        lastSeenAt: new Date().toISOString(),
      };
    }
  }
  let doc = await warehouseService.lookupByQr(identifier);
  const requestedSource = request.query.source ? String(request.query.source).trim() : '';
  const source = request.isIotDevice
    ? 'esp32_s3_camera'
    : (requestedSource || 'mobile_app');

  // Chỉ ghi nhận trạng thái xác thực QR khi phiếu đang ở trạng thái 'approved'
  if (doc && doc.status === 'approved') {
    doc = await warehouseService.recordQrScan(doc.id, request.user?.id, source);
  }

  try {
    const { writeAuditLog } = await import('../models/auth.model.js');
    await writeAuditLog({
      actorUserId: request.user?.id,
      action: 'warehouse.document.qr_lookup',
      entityType: 'warehouse_document',
      entityId: doc.id,
      metadata: {
        identifier,
        document_number: doc.document_number,
        status: doc.status,
        source,
        qr_verified: doc.status === 'approved'
      },
      ipAddress: request.ip
    });
  } catch (_) {
    // Non-blocking audit log
  }
  return response.json({ data: doc });
};
export const completeDocument = async (request, response) => response.json({ data: await warehouseService.complete(request.params.documentId, request.user.id, request.body) });
export const listOrders = async (request, response) => response.json(await warehouseService.orders(request.query));
export const packOrder = async (request, response) => response.json({ data: await warehouseService.pack(request.params.orderId, request.body.warehouseId, request.user.id, request.user.role_code) });

