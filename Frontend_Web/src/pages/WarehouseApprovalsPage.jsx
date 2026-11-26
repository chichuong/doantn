import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { inventoryApi } from '../api/inventoryApi';
import { IotCameraScannerModal } from '../components/inventory/IotCameraScannerModal';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  QrCode,
  Camera,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  X,
} from 'lucide-react';

export const WarehouseApprovalsPage = () => {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('warehouse.documents.approve');

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected document for details modal
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Rejection modal
  const [rejectingDocId, setRejectingDocId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // QR Modal
  const [qrModalDoc, setQrModalDoc] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // IoT Live Camera Scanner Modal
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  useEffect(() => {
    if (!qrModalDoc) {
      setQrDataUrl('');
      return;
    }
    const token = qrModalDoc.qr_code || qrModalDoc.document_number;
    QRCode.toDataURL(token, { width: 240, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [qrModalDoc]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await inventoryApi.getDocuments(params);
      setDocuments(res?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Không thể tải danh sách phiếu kho');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openDetail = async (docId) => {
    try {
      const res = await inventoryApi.getDocumentDetail(docId);
      setSelectedDoc(res?.data || null);
    } catch {
      setError('Không thể tải chi tiết chứng từ');
    }
  };

  const handleApprove = async (docId) => {
    if (!window.confirm('Xác nhận phê duyệt yêu cầu này? Mã phiếu và mã QR sẽ được tạo tự động.')) {
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      const res = await inventoryApi.approveDocument(docId);
      setSuccessMessage(`Đã phê duyệt thành công phiếu ${res?.data?.document_number || ''}`);
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc(res?.data);
      }
      fetchDocuments();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Phê duyệt thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối yêu cầu.');
      return;
    }
    try {
      setActionLoading(true);
      setRejectError('');
      setError('');
      const res = await inventoryApi.rejectDocument(rejectingDocId, rejectReason.trim());
      setSuccessMessage(`Đã từ chối phiếu ${res?.data?.document_number || ''}`);
      setRejectingDocId(null);
      setRejectReason('');
      if (selectedDoc && selectedDoc.id === rejectingDocId) {
        setSelectedDoc(res?.data);
      }
      fetchDocuments();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Từ chối thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Chờ duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3 h-3" /> Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3" /> Từ chối
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Hoàn tất
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Bản nháp
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Unified Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Phê duyệt Chứng từ Nhập / Xuất kho</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quy trình xét duyệt phiếu nhập hàng, xuất kho nội bộ và sinh mã QR xác thực đối soát IoT ESP32-CAM
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsCameraScannerOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-slate-600" />
            <span>Mở Camera Quét QR (IoT / Web)</span>
          </button>

          <button
            type="button"
            onClick={fetchDocuments}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Alerts */}
        {error && (
          <div role="alert" className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div role="status" className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
            {[
              { key: 'pending', label: 'Chờ duyệt' },
              { key: 'approved', label: 'Đã duyệt' },
              { key: 'completed', label: 'Đã hoàn tất' },
              { key: 'rejected', label: 'Bị từ chối' },
              { key: '', label: 'Tất cả trạng thái' },
            ].map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${active
                      ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Type filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Loại phiếu:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Lọc theo loại phiếu kho"
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="">Tất cả loại phiếu</option>
                <option value="receipt">Phiếu nhập kho</option>
                <option value="issue">Phiếu xuất kho</option>
              </select>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã phiếu, ghi chú..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Documents List: Mobile Cards + Desktop Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          {/* Mobile Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải danh sách yêu cầu kho...
              </div>
            ) : documents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Không có chứng từ nào phù hợp với bộ lọc.
              </div>
            ) : (
              documents.map((doc) => {
                const isReceipt = doc.type === 'receipt';
                return (
                  <div key={doc.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-slate-900">
                        {isReceipt ? (
                          <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <span>{doc.document_number}</span>
                      </div>
                      {statusBadge(doc.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          isReceipt
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {isReceipt ? 'Phiếu nhập kho' : 'Phiếu xuất kho'}
                      </span>
                      <span className="text-slate-600 font-medium">
                        {doc.item_lines} mặt hàng • Tổng SL: <strong>{formatNumber(doc.total_quantity)}</strong>
                      </span>
                    </div>
                    {doc.note && (
                      <div className="text-[11px] text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg">
                        {doc.note}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        {doc.creator_name || 'Nhân viên kho'} • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(doc.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                        {doc.qr_code && (
                          <button
                            type="button"
                            onClick={() => setQrModalDoc(doc)}
                            className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700"
                            aria-label="Xem mã QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canApprove && doc.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(doc.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingDocId(doc.id);
                                setRejectReason('');
                                setRejectError('');
                              }}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold text-xs"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Mã chứng từ</th>
                  <th className="py-3 px-4">Loại phiếu</th>
                  <th className="py-3 px-4">Kho hàng</th>
                  <th className="py-3 px-4">Người tạo & Thời gian</th>
                  <th className="py-3 px-4 text-center">Số dòng SP</th>
                  <th className="py-3 px-4 text-center">Tổng SL</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                      Đang tải danh sách yêu cầu kho...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      Không có chứng từ nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => {
                    const isReceipt = doc.type === 'receipt';
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                        {/* Document Number */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            {isReceipt ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-blue-600 shrink-0" />
                            )}
                            <span>{doc.document_number}</span>
                          </div>
                          {doc.note && (
                            <div className="text-[11px] text-slate-500 font-sans truncate max-w-[200px] mt-0.5">
                              {doc.note}
                            </div>
                          )}
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${isReceipt
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                          >
                            {isReceipt ? 'Nhập kho' : 'Xuất kho'}
                          </span>
                        </td>

                        {/* Warehouse */}
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {doc.warehouse_name || doc.warehouse_code}
                        </td>

                        {/* Requester & Time */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-semibold text-slate-900">
                            {doc.creator_name || 'Nhân viên kho'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(doc.created_at).toLocaleString('vi-VN')}
                          </div>
                        </td>

                        {/* Item Lines */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                          {doc.item_lines}
                        </td>

                        {/* Total Qty */}
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {formatNumber(doc.total_quantity)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            {statusBadge(doc.status)}
                            {doc.qr_scanned_at && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`Đã quét xác thực QR lúc ${new Date(doc.qr_scanned_at).toLocaleString('vi-VN')}`}
                              >
                                <QrCode className="w-2.5 h-2.5" />
                                <span>Đã quét QR IoT</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetail(doc.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs transition"
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết chứng từ"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {doc.qr_code && (
                              <button
                                type="button"
                                onClick={() => setQrModalDoc(doc)}
                                className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs transition"
                                title="Xem mã QR"
                                aria-label="Xem mã QR phiếu kho"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canApprove && doc.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(doc.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-2xs flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingDocId(doc.id);
                                    setRejectReason('');
                                    setRejectError('');
                                  }}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition shadow-2xs flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Từ chối</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs"
          onMouseDown={() => setSelectedDoc(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <span>Phiếu {selectedDoc.type === 'receipt' ? 'Nhập kho' : 'Xuất kho'}:</span>
                  <span className="font-mono text-blue-600">{selectedDoc.document_number}</span>
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Kho: <span className="font-semibold text-slate-700">{selectedDoc.warehouse_name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                aria-label="Đóng chi tiết phiếu"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Audit Status Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[11px]">Trạng thái:</span>
                <div className="mt-0.5">{statusBadge(selectedDoc.status)}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Người tạo:</span>
                <span className="font-semibold text-slate-800">{selectedDoc.creator_name || 'Nhân viên'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Ngày tạo:</span>
                <span className="text-slate-700 tabular-nums">{new Date(selectedDoc.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Mã QR phiếu:</span>
                {selectedDoc.qr_code ? (
                  <button
                    type="button"
                    onClick={() => setQrModalDoc(selectedDoc)}
                    className="text-blue-600 font-semibold underline text-xs"
                  >
                    Xem mã QR
                  </button>
                ) : (
                  <span className="text-slate-400">Chưa sinh</span>
                )}
              </div>
            </div>

            {selectedDoc.rejection_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-1">
                <span className="font-bold">Lý do từ chối:</span>
                <p>{selectedDoc.rejection_reason}</p>
                <div className="text-[11px] text-red-500">
                  Từ chối bởi {selectedDoc.rejecter_name} lúc {new Date(selectedDoc.rejected_at).toLocaleString('vi-VN')}
                </div>
              </div>
            )}

            {selectedDoc.note && (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                <span className="font-semibold text-slate-700">Ghi chú:</span> {selectedDoc.note}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Danh sách mặt hàng ({selectedDoc.items?.length || 0})
              </h4>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Sản phẩm</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3 text-right">SL yêu cầu</th>
                      <th className="py-2.5 px-3 text-right">SL thực tế</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {selectedDoc.items?.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">{it.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{it.sku}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">{it.quantity}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">
                          {it.actual_quantity !== null && it.actual_quantity !== undefined
                            ? it.actual_quantity
                            : '---'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              {canApprove && selectedDoc.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingDocId(selectedDoc.id);
                      setRejectReason('');
                      setRejectError('');
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                  >
                    Từ chối yêu cầu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedDoc.id)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    Duyệt yêu cầu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingDocId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs"
          onMouseDown={() => setRejectingDocId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Từ chối yêu cầu kho</span>
            </h3>
            <p className="text-xs text-slate-600">
              Vui lòng nhập lý do từ chối để nhân viên kho nắm được thông tin.
            </p>
            {rejectError && (
              <div role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {rejectError}
              </div>
            )}
            <div>
              <textarea
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError('');
                }}
                placeholder="Nhập lý do từ chối cụ thể..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingDocId(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading}
                className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs"
          onMouseDown={() => setQrModalDoc(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-slate-900">Mã QR Phiếu Kho</h3>
            <p className="text-xs text-slate-500 font-mono">{qrModalDoc.document_number}</p>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 inline-block mx-auto">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Mã QR cho phiếu ${qrModalDoc.document_number}`}
                  className="w-48 h-48 mx-auto"
                />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    qrModalDoc.qr_code || qrModalDoc.document_number
                  )}`}
                  alt={`Mã QR cho phiếu ${qrModalDoc.document_number}`}
                  className="w-48 h-48 mx-auto"
                />
              )}
            </div>
            <div className="text-xs text-slate-600 font-mono bg-slate-100 py-1.5 px-3 rounded-lg">
              Mã định danh phiếu: {qrModalDoc.qr_code || qrModalDoc.document_number}
            </div>
            <p className="text-[11px] text-slate-400">
              Nhân viên kho dùng camera app hoặc thiết bị ESP32-CAM quét mã này để xác định phiếu và đối soát hàng.
            </p>
            <button
              type="button"
              onClick={() => setQrModalDoc(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* IOT & WEB LIVE CAMERA QR SCANNER MODAL */}
      <IotCameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanVerified={(verifiedDoc) => {
          if (verifiedDoc?.document_number) {
            setSuccessMessage(
              `Camera đã nhận diện & đối soát thành công phiếu ${verifiedDoc.document_number} (${verifiedDoc.status})`
            );
          }
          fetchDocuments();
        }}
      />
    </div>
  );
};
