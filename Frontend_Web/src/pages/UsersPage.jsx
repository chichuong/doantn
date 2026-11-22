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
  active: { label: 'Hoạt động', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Ngừng hoạt động', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  locked: { label: 'Đã khóa', cls: 'bg-red-50 text-red-700 border-red-200' },
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
      setSuccess('Đã cập nhật phân quyền cho vai trò thành công.');
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
        setSuccess(`Đã cập nhật tài khoản ${editingUser.email}`);
      } else {
        await authApi.createUser({
          email: userForm.email.trim(),
          password: userForm.password,
          fullName: userForm.fullName.trim(),
          phone: userForm.phone.trim() || undefined,
          roleId: userForm.roleId,
        });
        setSuccess(`Đã tạo tài khoản ${userForm.email}`);
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Quản trị Người dùng & Phân quyền (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tài khoản nhân sự, khách hàng, vai trò và ma trận quyền hạn trong hệ thống
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
              <span>Tài khoản ({pagination.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                activeTab === 'roles' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vai trò & Quyền ({roles.length})</span>
            </button>
          </div>

          {activeTab === 'users' && canCreateUser && (
            <button
              type="button"
              onClick={openCreateUser}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo tài khoản</span>
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
                  placeholder="Tìm kiếm theo họ tên hoặc email..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>

              <button
                type="button"
                onClick={() => loadUsers(pagination.page)}
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600"
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
                      <th className="py-3 px-4">Họ tên / Email</th>
                      <th className="py-3 px-4">Số điện thoại</th>
                      <th className="py-3 px-4">Vai trò</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      <th className="py-3 px-4">Đăng nhập gần nhất</th>
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
                          Không tìm thấy người dùng phù hợp.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const st = STATUS_BADGES[u.status] || STATUS_BADGES.inactive;
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
                            <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.phone || '—'}</td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {u.role_name} ({u.role_code})
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.cls}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 tabular-nums">
                              {u.last_login_at ? formatDate(u.last_login_at) : 'Chưa đăng nhập'}
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
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadUsers(pagination.page + 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Roles & Permissions Matrix */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Roles list */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 h-fit">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mb-2">
                Danh sách Vai trò
              </h2>
              {roles.map((r) => {
                const active = r.id === selectedRoleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRole(r)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      active
                        ? 'border-blue-600 bg-blue-50/60'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{r.name}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {r.code}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-[11px] text-slate-500 mt-1">{r.description}</p>
                    )}
                    <div className="mt-2 text-[11px] font-medium text-blue-600">
                      {(r.permission_ids || []).length || r.permission_count || 0} quyền được cấp
                    </div>
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
                        Phân quyền cho vai trò: <span className="text-blue-600">{selectedRole.name}</span> ({selectedRole.code})
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Đã chọn {selectedPermissionIds.size} / {permissions.length} quyền hệ thống
                      </p>
                    </div>
                    {canUpdateRoles && (
                      <button
                        type="button"
                        onClick={handleSaveRolePermissions}
                        disabled={savingPermissions}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingPermissions ? 'Đang lưu...' : 'Lưu phân quyền'}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
                    {Object.entries(groupedPermissions).map(([mod, perms]) => {
                      const allChecked = perms.length > 0 && perms.every((p) => selectedPermissionIds.has(p.id));
                      return (
                        <div key={mod} className="border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase text-slate-700">
                              Phân hệ: {mod}
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
                                className="text-[11px] font-medium text-blue-600 hover:underline"
                              >
                                {allChecked ? 'Bỏ chọn phân hệ' : 'Chọn tất cả'}
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {perms.map((perm) => {
                              const checked = selectedPermissionIds.has(perm.id);
                              return (
                                <label
                                  key={perm.id}
                                  className={`flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition ${
                                    checked
                                      ? 'bg-blue-50/50 border-blue-200 text-slate-900'
                                      : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!canUpdateRoles}
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600"
                                  />
                                  <div>
                                    <div className="font-mono font-semibold text-[11px] text-slate-800">
                                      {perm.code}
                                    </div>
                                    <div className="text-[11px] text-slate-500">{perm.name}</div>
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
                  Chọn một vai trò bên trái để xem và chỉnh sửa quyền.
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
        title={editingUser ? `Cập nhật tài khoản: ${editingUser.email}` : 'Tạo tài khoản mới'}
      >
        <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
          {!editingUser && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email đăng nhập *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo (tối thiểu 8 ký tự) *</label>
                <input
                  type="password"
                  minLength={8}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
              <input
                type="text"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vai trò *</label>
              <select
                value={userForm.roleId}
                onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editingUser && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Trạng thái tài khoản</label>
              <select
                value={userForm.status}
                disabled={editingUser.id === currentUser?.id}
                onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white disabled:bg-slate-100"
              >
                <option value="active">Hoạt động (Active)</option>
                <option value="inactive">Ngừng hoạt động (Inactive)</option>
                <option value="locked">Khóa tài khoản (Locked)</option>
              </select>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {savingUser ? 'Đang lưu...' : 'Lưu tài khoản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
