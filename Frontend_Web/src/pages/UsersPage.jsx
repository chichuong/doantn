import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  Edit3,
  RefreshCw,
  Save,
} from 'lucide-react';
import { authApi } from '../api/authApi';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';

const STATUS_BADGES = {
  active: { label: 'Đang hoạt động', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Ngừng hoạt động', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  locked: { label: 'Đã khóa', cls: 'bg-red-50 text-red-700 border-red-200' },
};

const ROLE_VIETNAMESE = {
  customer: {
    name: 'Khách hàng',
    description: 'Mua sắm trực tuyến, quản lý giỏ hàng và theo dõi đơn hàng cá nhân',
  },
  sales: {
    name: 'Nhân viên thu ngân',
    description: 'Bán hàng trực tiếp tại quầy và quản lý ca thu ngân',
  },
  shipper: {
    name: 'Nhân viên giao hàng',
    description: 'Nhận kiện hàng từ kho và cập nhật trạng thái giao hàng',
  },
  warehouse: {
    name: 'Nhân viên kho',
    description: 'Kiểm kê, lập phiếu nhập/xuất kho và đóng gói hàng hóa',
  },
  order_processor: {
    name: 'Nhân viên xử lý đơn',
    description: 'Tiếp nhận đơn đặt hàng, lấy hàng và chuẩn bị đóng gói',
  },
  manager: {
    name: 'Quản lý cửa hàng',
    description: 'Điều hành kinh doanh, phê duyệt phiếu kho, quản lý sản phẩm và xem báo cáo',
  },
  admin: {
    name: 'Quản trị viên hệ thống',
    description: 'Toàn quyền quản lý tài khoản nhân sự, vai trò và cấu hình hệ thống',
  },
};

const MODULE_LABELS = {
  auth: 'Quản lý Tài khoản & Phân quyền',
  customer: 'Mua sắm & Tiện ích Khách hàng',
  pos: 'Bán hàng tại quầy',
  order_processing: 'Tiếp nhận & Xử lý Đơn hàng',
  warehouse: 'Nghiệp vụ Kho hàng',
  shipping: 'Vận chuyển & Giao nhận',
  payments: 'Thanh toán & Đối soát',
  manager: 'Quản lý Cửa hàng & Báo cáo',
  forecasting: 'Dự báo Nhu cầu Bán hàng (AI)',
  data_exchange: 'Nhập / Xuất Dữ liệu Excel',
  other: 'Chức năng hệ thống khác',
};

const PERMISSION_VIETNAMESE = {
  'auth.permissions.read': {
    name: 'Xem danh sách quyền hạn',
    desc: 'Cho phép xem các chức năng phân quyền trong hệ thống',
  },
  'auth.roles.create': {
    name: 'Tạo vai trò mới',
    desc: 'Cho phép thêm nhóm chức danh / vai trò mới',
  },
  'auth.roles.read': {
    name: 'Xem danh sách vai trò',
    desc: 'Cho phép xem các nhóm chức danh và quyền đi kèm',
  },
  'auth.roles.update': {
    name: 'Thiết lập quyền cho vai trò',
    desc: 'Cho phép bật/tắt các quyền hạn của từng nhóm vai trò',
  },
  'auth.users.create': {
    name: 'Tạo tài khoản mới',
    desc: 'Cho phép tạo tài khoản cho nhân viên hoặc người dùng mới',
  },
  'auth.users.read': {
    name: 'Xem danh sách tài khoản',
    desc: 'Cho phép tra cứu thông tin tài khoản nhân sự và khách hàng',
  },
  'auth.users.update': {
    name: 'Cập nhật & khóa tài khoản',
    desc: 'Cho phép sửa thông tin, đổi vai trò hoặc khóa tài khoản',
  },
  'customer.addresses.manage': {
    name: 'Quản lý sổ địa chỉ nhận hàng',
    desc: 'Thêm, sửa, xóa địa chỉ giao hàng cá nhân',
  },
  'customer.cart.manage': {
    name: 'Sử dụng giỏ hàng trực tuyến',
    desc: 'Thêm, bớt sản phẩm trong giỏ mua sắm',
  },
  'customer.catalog.read': {
    name: 'Xem & tìm kiếm sản phẩm',
    desc: 'Xem danh sách mặt hàng đang bán trên cửa hàng trực tuyến',
  },
  'customer.orders.cancel': {
    name: 'Hủy đơn đặt hàng cá nhân',
    desc: 'Hủy đơn hàng khi đơn chưa chuyển sang bước xuất kho',
  },
  'customer.orders.create': {
    name: 'Đặt mua hàng trực tuyến',
    desc: 'Thực hiện thanh toán và gửi đơn đặt hàng mới',
  },
  'customer.orders.read': {
    name: 'Theo dõi đơn hàng cá nhân',
    desc: 'Xem lịch sử mua hàng và tiến trình giao hàng',
  },
  'data_exchange.export': {
    name: 'Xuất dữ liệu ra file Excel / CSV',
    desc: 'Tải danh sách sản phẩm, tồn kho, đơn hàng và doanh thu về máy',
  },
  'data_exchange.import': {
    name: 'Nhập dữ liệu từ file Excel / CSV',
    desc: 'Tải lên file bảng tính để thêm nhanh danh mục, sản phẩm và tồn kho',
  },
  'data_exchange.jobs.read': {
    name: 'Xem lịch sử nhập / xuất file',
    desc: 'Theo dõi kết quả các lần tải file dữ liệu lên hệ thống',
  },
  'forecasting.alerts.read': {
    name: 'Xem cảnh báo nguy cơ thiếu hàng',
    desc: 'Xem danh sách mặt hàng sắp hết tồn kho theo dự báo',
  },
  'forecasting.read': {
    name: 'Xem kết quả dự báo nhu cầu bán hàng',
    desc: 'Xem số lượng dự kiến bán ra trong các ngày tới',
  },
  'forecasting.run': {
    name: 'Chạy phân tích dự báo nhu cầu mới',
    desc: 'Khởi chạy công cụ AI phân tích xu hướng tiêu thụ sản phẩm',
  },
  'manager.categories.manage': {
    name: 'Thêm / sửa danh mục sản phẩm',
    desc: 'Tạo mới, đổi tên hoặc ẩn/hiện nhóm sản phẩm',
  },
  'manager.categories.read': {
    name: 'Xem danh mục sản phẩm',
    desc: 'Xem danh sách các nhóm phân loại hàng hóa',
  },
  'manager.dashboard.read': {
    name: 'Xem bảng tổng quan kinh doanh',
    desc: 'Xem các chỉ số doanh thu, tổng đơn hàng và cảnh báo tồn kho',
  },
  'manager.documents.read': {
    name: 'Xem danh sách phiếu kho chờ duyệt',
    desc: 'Theo dõi các phiếu yêu cầu nhập/xuất kho từ nhân viên',
  },
  'manager.inventory.adjust': {
    name: 'Điều chỉnh & cân bằng tồn kho',
    desc: 'Trực tiếp lập phiếu tăng/giảm số lượng tồn kho khi kiểm kê',
  },
  'manager.inventory.read': {
    name: 'Xem số lượng tồn kho toàn hệ thống',
    desc: 'Tra cứu tồn thực tế, số lượng đang giữ cho đơn và tồn khả dụng',
  },
  'manager.orders.cancel': {
    name: 'Hủy đơn hàng của khách',
    desc: 'Hủy đơn hàng trên hệ thống và hoàn lại số lượng giữ chỗ về kho',
  },
  'manager.orders.read': {
    name: 'Quản lý toàn bộ đơn hàng đa kênh',
    desc: 'Xem và xử lý tất cả đơn hàng từ quầy, website và ứng dụng di động',
  },
  'manager.products.manage': {
    name: 'Thêm / sửa thông tin & giá sản phẩm',
    desc: 'Cập nhật tên, hình ảnh, giá vốn, giá bán và mức cảnh báo tồn',
  },
  'manager.products.read': {
    name: 'Xem danh sách sản phẩm',
    desc: 'Tra cứu thông tin chi tiết và giá bán các mặt hàng',
  },
  'manager.reports.read': {
    name: 'Xem báo cáo doanh thu chi tiết',
    desc: 'Xem biểu đồ doanh thu theo ngày và tỷ trọng từng kênh bán',
  },
  'manager.warehouses.manage': {
    name: 'Thiết lập thông tin kho hàng',
    desc: 'Tạo mới hoặc cập nhật thông tin địa điểm kho lưu trữ',
  },
  'manager.warehouses.read': {
    name: 'Xem thông tin kho hàng',
    desc: 'Xem danh sách các kho lưu trữ trong hệ thống',
  },
  'order_processing.orders.assign': {
    name: 'Phân công nhân viên xử lý đơn',
    desc: 'Giao đơn hàng mới cho nhân viên phụ trách lấy hàng',
  },
  'order_processing.orders.confirm': {
    name: 'Xác nhận tiếp nhận đơn hàng',
    desc: 'Duyệt đơn hàng khách vừa đặt để chuyển sang bộ phận kho',
  },
  'order_processing.orders.read': {
    name: 'Xem danh sách đơn hàng cần xử lý',
    desc: 'Xem chi tiết các đơn đặt hàng trực tuyến đang chờ chuẩn bị hàng',
  },
  'order_processing.tasks.update': {
    name: 'Cập nhật trạng thái lấy hàng',
    desc: 'Xác nhận đã lấy đủ hàng trên kệ và sẵn sàng đóng gói',
  },
  'payments.customer.manage': {
    name: 'Xem mã QR & xác nhận chuyển khoản',
    desc: 'Hiển thị mã QR ngân hàng và gửi thông tin thanh toán đơn hàng',
  },
  'payments.refunds.confirm': {
    name: 'Xác nhận hoàn tiền cho khách',
    desc: 'Ghi nhận đã hoàn trả tiền cho các đơn hủy hoặc trả hàng',
  },
  'payments.transfers.read': {
    name: 'Xem danh sách giao dịch chuyển khoản',
    desc: 'Tra cứu các khoản thanh toán chuyển khoản cần kiểm tra',
  },
  'payments.transfers.review': {
    name: 'Xác nhận đã nhận tiền chuyển khoản',
    desc: 'Duyệt hoặc từ chối giao dịch sau khi kiểm tra sao kê ngân hàng',
  },
  'pos.products.read': {
    name: 'Tra cứu sản phẩm tại quầy thu ngân',
    desc: 'Tìm kiếm mặt hàng và xem giá bán trên màn hình thu ngân',
  },
  'pos.sales.create': {
    name: 'Tạo hóa đơn & thanh toán tại quầy',
    desc: 'Lập đơn bán lẻ, tính tiền và xuất hóa đơn cho khách tại cửa hàng',
  },
  'pos.sales.read': {
    name: 'Xem lịch sử hóa đơn tại quầy',
    desc: 'Tra cứu các đơn hàng đã bán trong ca thu ngân',
  },
  'pos.sales.void': {
    name: 'Hủy hóa đơn bán tại quầy',
    desc: 'Hủy giao dịch thu ngân bị nhầm lẫn và cộng lại hàng vào kho',
  },
  'pos.sessions.manage': {
    name: 'Mở ca & chốt ca thu ngân',
    desc: 'Khai báo tiền mặt đầu ca và kết thúc ca bán hàng tại quầy',
  },
  'shipping.shipments.assign': {
    name: 'Giao kiện hàng cho nhân viên vận chuyển',
    desc: 'Phân công người giao hàng phụ trách từng vận đơn',
  },
  'shipping.shipments.create': {
    name: 'Tạo phiếu vận đơn giao hàng',
    desc: 'Khởi tạo vận đơn sau khi kho đã đóng gói xong kiện hàng',
  },
  'shipping.shipments.read': {
    name: 'Xem danh sách vận đơn giao hàng',
    desc: 'Theo dõi các kiện hàng được phân công vận chuyển',
  },
  'shipping.shipments.update': {
    name: 'Cập nhật kết quả giao hàng',
    desc: 'Xác nhận đang giao hàng hoặc đã giao thành công cho khách',
  },
  'warehouse.documents.approve': {
    name: 'Phê duyệt phiếu nhập / xuất kho',
    desc: 'Chấp thuận hoặc từ chối các phiếu yêu cầu nhập/xuất hàng hóa',
  },
  'warehouse.documents.complete': {
    name: 'Xác nhận hoàn tất nhập / xuất kho',
    desc: 'Chốt phiếu kho sau khi kiểm đếm thực tế để cập nhật tồn kho',
  },
  'warehouse.documents.create': {
    name: 'Lập phiếu yêu cầu nhập / xuất kho',
    desc: 'Tạo phiếu đề nghị nhập thêm hàng hoặc xuất kho nội bộ',
  },
  'warehouse.documents.read': {
    name: 'Xem danh sách phiếu nhập / xuất kho',
    desc: 'Tra cứu chi tiết các phiếu chứng từ kho hàng',
  },
  'warehouse.inventory.read': {
    name: 'Tra cứu & kiểm tra tồn kho tại kệ',
    desc: 'Xem số lượng tồn của từng mặt hàng trong kho được phân công',
  },
  'warehouse.orders.pack': {
    name: 'Đóng gói kiện hàng & xuất kho',
    desc: 'Xác nhận đóng thùng hoàn tất và trừ số lượng tồn kho',
  },
  'warehouse.orders.read': {
    name: 'Xem đơn hàng chờ đóng gói tại kho',
    desc: 'Xem danh sách các đơn hàng đã duyệt cần soạn hàng và đóng gói',
  },
  'warehouse.orders.returns': {
    name: 'Tiếp nhận hàng khách trả về kho',
    desc: 'Kiểm tra hàng hoàn trả và nhập lại vào tồn kho',
  },
  'warehouse.orders.scan': {
    name: 'Quét mã kiểm tra hàng hóa',
    desc: 'Sử dụng máy quét/camera kiểm tra đúng mặt hàng và số lượng',
  },
};

const getRoleDisplay = (role) => {
  if (!role) return { name: 'Chưa xác định', description: '' };
  const code = role.code || role.role_code;
  const mapped = ROLE_VIETNAMESE[code];
  return {
    name: mapped?.name || role.name || role.role_name || code,
    description: mapped?.description || role.description || '',
  };
};

const getPermissionDisplay = (perm) => {
  if (!perm) return { name: '', desc: '' };
  const mapped = PERMISSION_VIETNAMESE[perm.code];
  return {
    name: mapped?.name || perm.name || 'Quyền thao tác hệ thống',
    desc: mapped?.desc || perm.description || 'Cho phép thực hiện chức năng này',
  };
};

export const UsersPage = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const canCreateUser = hasPermission('auth.users.create');
  const canUpdateUser = hasPermission('auth.users.update');
  const canReadRoles = hasPermission('auth.roles.read');
  const canUpdateRoles = hasPermission('auth.roles.update');
  const canReadPermissions = hasPermission('auth.permissions.read');

  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'roles'

  // Users state
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Roles & Permissions state
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(new Set());
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    roleId: '',
    status: 'active',
  });
  const [savingUser, setSavingUser] = useState(false);

  const loadRolesAndPermissions = useCallback(async () => {
    try {
      const [rolesRes, permsRes] = await Promise.allSettled([
        canReadRoles ? authApi.getRoles() : Promise.resolve(null),
        canReadPermissions ? authApi.getPermissions() : Promise.resolve(null),
      ]);
      if (rolesRes.status === 'fulfilled' && rolesRes.value) {
        const list = rolesRes.value?.data || rolesRes.value || [];
        setRoles(list);
        setSelectedRoleId((prev) => {
          const target = list.find((r) => r.id === prev) || list[0];
          if (target) {
            setSelectedPermissionIds(new Set(target.permission_ids || []));
            return target.id;
          }
          return '';
        });
      }
      if (permsRes.status === 'fulfilled' && permsRes.value) {
        setPermissions(permsRes.value?.data || permsRes.value || []);
      }
    } catch (err) {
      console.error('Lỗi tải vai trò/quyền:', err);
    }
  }, [canReadRoles, canReadPermissions]);

  const loadUsers = useCallback(async (page = 1) => {
    setLoadingUsers(true);
    setError('');
    try {
      const params = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await authApi.getUsers(params);
      setUsers(res?.data || []);
      setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setLoadingUsers(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    loadRolesAndPermissions();
  }, [loadRolesAndPermissions]);

  useEffect(() => {
    loadUsers(1);
  }, [loadUsers]);

  const handleSelectRole = (role) => {
    setSelectedRoleId(role.id);
    setSelectedPermissionIds(new Set(role.permission_ids || []));
  };

  const togglePermission = (permId) => {
    if (!canUpdateRoles) return;
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRoleId) return;
    setSavingPermissions(true);
    setError('');
    try {
      await authApi.replaceRolePermissions(selectedRoleId, Array.from(selectedPermissionIds));
      setSuccess('Đã lưu thiết lập quyền hạn cho vai trò thành công.');
      await loadRolesAndPermissions();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Cập nhật phân quyền thất bại.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      email: '',
      password: '',
      fullName: '',
      phone: '',
      roleId: roles[0]?.id || '',
      status: 'active',
    });
    setIsUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({
      email: u.email || '',
      password: '',
      fullName: u.full_name || '',
      phone: u.phone || '',
      roleId: u.role_id || '',
      status: u.status || 'active',
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    setError('');
    try {
      if (editingUser) {
        await authApi.updateUser(editingUser.id, {
          fullName: userForm.fullName.trim(),
          phone: userForm.phone.trim() || undefined,
          roleId: userForm.roleId,
          status: userForm.status,
        });
        setSuccess(`Đã cập nhật thông tin tài khoản ${editingUser.email}`);
      } else {
        await authApi.createUser({
          email: userForm.email.trim(),
          password: userForm.password,
          fullName: userForm.fullName.trim(),
          phone: userForm.phone.trim() || undefined,
          roleId: userForm.roleId,
        });
        setSuccess(`Đã tạo tài khoản mới cho ${userForm.email}`);
      }
      setIsUserModalOpen(false);
      loadUsers(pagination.page);
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Lưu tài khoản thất bại.');
    } finally {
      setSavingUser(false);
    }
  };

  const groupedPermissions = useMemo(() => {
    const groups = {};
    permissions.forEach((p) => {
      const mod = p.module || 'other';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(p);
    });
    return groups;
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedRoleDisplay = getRoleDisplay(selectedRole);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Quản lý Tài khoản & Phân quyền</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh sách nhân viên, khách hàng và thiết lập quyền sử dụng chức năng theo từng vị trí công việc
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                activeTab === 'users' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Danh sách Tài khoản ({pagination.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                activeTab === 'roles' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vai trò & Quyền hạn ({roles.length})</span>
            </button>
          </div>

          {activeTab === 'users' && canCreateUser && (
            <button
              type="button"
              onClick={openCreateUser}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tài khoản</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            {success}
          </div>
        )}

        {activeTab === 'users' ? (
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm theo họ tên hoặc địa chỉ email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>

              <button
                type="button"
                onClick={() => loadUsers(pagination.page)}
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-3 px-4">Người dùng / Email</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Vai trò công việc</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4">Lần đăng nhập gần nhất</th>
                      {canUpdateUser && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          Đang tải danh sách tài khoản...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          Không tìm thấy tài khoản nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const st = STATUS_BADGES[u.status] || STATUS_BADGES.inactive;
                        const roleInfo = getRoleDisplay({ code: u.role_code, name: u.role_name });
                        const initials = (u.full_name || u.email || 'U')
                          .split(' ')
                          .filter(Boolean)
                          .slice(-2)
                          .map((w) => w[0]?.toUpperCase())
                          .join('');
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">{u.full_name}</div>
                                  <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 text-[11px]">{u.phone || 'Chưa cập nhật'}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {roleInfo.name}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 tabular-nums">
                              {u.last_login_at ? formatDate(u.last_login_at) : 'Chưa từng đăng nhập'}
                            </td>
                            {canUpdateUser && (
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openEditUser(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Chỉnh sửa</span>
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Trang {pagination.page} / {pagination.totalPages} ({pagination.total} tài khoản)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => loadUsers(pagination.page - 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      Trang trước
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadUsers(pagination.page + 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Roles & Permissions Matrix (Non-code Business Friendly) */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles list */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 h-fit">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
                Chọn Vai trò / Nhóm người dùng
              </h2>
              {roles.map((r) => {
                const active = r.id === selectedRoleId;
                const roleInfo = getRoleDisplay(r);
                const permCount = (r.permission_ids || []).length || r.permission_count || 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left p-3.5 rounded-xl border transition ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{roleInfo.name}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          active
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {permCount} quyền
                      </span>
                    </div>
                    {roleInfo.description && (
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {roleInfo.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Permissions matrix */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              {selectedRole ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">
                        Thiết lập quyền sử dụng cho: <span className="text-blue-600">{selectedRoleDisplay.name}</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Đang bật <strong>{selectedPermissionIds.size}</strong> trên tổng số <strong>{permissions.length}</strong> chức năng của hệ thống
                      </p>
                    </div>
                    {canUpdateRoles && (
                      <button
                        type="button"
                        onClick={handleSaveRolePermissions}
                        disabled={savingPermissions}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingPermissions ? 'Đang lưu thay đổi...' : 'Lưu thiết lập quyền'}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                    {Object.entries(groupedPermissions).map(([mod, perms]) => {
                      const allChecked = perms.length > 0 && perms.every((p) => selectedPermissionIds.has(p.id));
                      const moduleTitle = MODULE_LABELS[mod] || `Nhóm chức năng: ${mod}`;
                      return (
                        <div key={mod} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40">
                          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70">
                            <span className="text-xs font-bold text-slate-800">
                              {moduleTitle}
                            </span>
                            {canUpdateRoles && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPermissionIds((prev) => {
                                    const next = new Set(prev);
                                    if (allChecked) {
                                      perms.forEach((p) => next.delete(p.id));
                                    } else {
                                      perms.forEach((p) => next.add(p.id));
                                    }
                                    return next;
                                  });
                                }}
                                className="text-[11px] font-semibold text-blue-600 hover:underline"
                              >
                                {allChecked ? 'Bỏ chọn nhóm này' : 'Bật tất cả nhóm này'}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {perms.map((perm) => {
                              const checked = selectedPermissionIds.has(perm.id);
                              const display = getPermissionDisplay(perm);
                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                    checked
                                      ? 'bg-blue-50/80 border-blue-300 text-slate-900 shadow-2xs'
                                      : 'bg-white border-slate-200/80 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!canUpdateRoles}
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                                  />
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-xs text-slate-900">
                                      {display.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 leading-snug">
                                      {display.desc}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chọn một vai trò ở danh sách bên trái để xem và thiết lập quyền sử dụng.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Tạo / Sửa Tài khoản */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? `Chỉnh sửa tài khoản: ${editingUser.full_name || editingUser.email}` : 'Thêm tài khoản người dùng mới'}
      >
        <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
          {!editingUser && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Địa chỉ Email đăng nhập *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="nhanvien@karats.studio"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mật khẩu ban đầu (tối thiểu 8 ký tự) *</label>
                <input
                  type="password"
                  minLength={8}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Nhập mật khẩu ít nhất 8 ký tự"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="Nguyễn Văn A"
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số điện thoại liên hệ</label>
              <input
                type="text"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="0901234567"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vai trò công việc *</label>
              <select
                value={userForm.roleId}
                onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                required
              >
                {roles.map((r) => {
                  const info = getRoleDisplay(r);
                  return (
                    <option key={r.id} value={r.id}>
                      {info.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {editingUser && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trạng thái hoạt động</label>
              <select
                value={userForm.status}
                disabled={editingUser.id === currentUser?.id}
                onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-100"
              >
                <option value="active">Đang hoạt động (Cho phép đăng nhập)</option>
                <option value="inactive">Tạm ngừng hoạt động</option>
                <option value="locked">Khóa tài khoản (Chặn đăng nhập)</option>
              </select>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
            >
              {savingUser ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
