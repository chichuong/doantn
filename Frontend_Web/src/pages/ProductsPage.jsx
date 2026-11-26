import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Tags,
  Plus,
  Search,
  Edit3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { managerApi } from '../api/managerApi';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export const ProductsPage = () => {
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('manager.products.manage');
  const canManageCategories = hasPermission('manager.categories.manage');

  const [activeTab, setActiveTab] = useState('products');

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    costPrice: '0',
    salePrice: '0',
    reorderLevel: '5',
    isActive: true,
  });
  const [savingProduct, setSavingProduct] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await managerApi.getCategories({ limit: 100 });
      setCategories(res?.data || []);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadProducts = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError('');
      try {
        const params = { page, limit: 20 };
        if (search.trim()) params.search = search.trim();
        if (categoryFilter) params.categoryId = categoryFilter;
        if (statusFilter !== '') params.isActive = statusFilter;
        const res = await managerApi.getProducts(params);
        setProducts(res?.data || []);
        setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách sản phẩm.');
      } finally {
        setLoading(false);
      }
    },
    [search, categoryFilter, statusFilter]
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts(1);
  }, [loadProducts]);

  const openAddProduct = () => {
    setEditingProduct(null);
    const randCode = Math.floor(100000 + Math.random() * 900000);
    setProductForm({
      sku: `SP-${randCode}`,
      name: '',
      description: '',
      imageUrl: '',
      categoryId: categories.find((c) => c.is_active)?.id || '',
      costPrice: '0',
      salePrice: '0',
      reorderLevel: '5',
      isActive: true,
    });
    setIsProductModalOpen(true);
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({
      sku: p.sku || '',
      name: p.name || '',
      description: p.description || '',
      imageUrl: p.image_url || p.imageUrl || '',
      categoryId: p.category_id || '',
      costPrice: String(p.cost_price ?? 0),
      salePrice: String(p.sale_price ?? 0),
      reorderLevel: String(p.reorder_level ?? 0),
      isActive: Boolean(p.is_active),
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    setError('');
    try {
      const payload = {
        sku: productForm.sku.trim(),
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        imageUrl: productForm.imageUrl.trim() || null,
        categoryId: productForm.categoryId || undefined,
        costPrice: Number(productForm.costPrice || 0),
        salePrice: Number(productForm.salePrice || 0),
        reorderLevel: Number(productForm.reorderLevel || 0),
        isActive: productForm.isActive,
      };
      if (editingProduct) {
        await managerApi.updateProduct(editingProduct.id, payload);
        setSuccess(`Đã cập nhật sản phẩm "${payload.name}"`);
      } else {
        await managerApi.createProduct(payload);
        setSuccess(`Đã thêm sản phẩm "${payload.name}"`);
      }
      setIsProductModalOpen(false);
      loadProducts(pagination.page);
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Lưu sản phẩm thất bại.');
    } finally {
      setSavingProduct(false);
    }
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '', isActive: true });
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name || '',
      description: cat.description || '',
      isActive: Boolean(cat.is_active),
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setSavingCategory(true);
    setError('');
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || null,
        isActive: categoryForm.isActive,
      };
      if (editingCategory) {
        await managerApi.updateCategory(editingCategory.id, payload);
        setSuccess(`Đã cập nhật danh mục "${payload.name}"`);
      } else {
        await managerApi.createCategory(payload);
        setSuccess(`Đã thêm danh mục "${payload.name}"`);
      }
      setIsCategoryModalOpen(false);
      loadCategories();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Lưu danh mục thất bại.');
    } finally {
      setSavingCategory(false);
    }
  };

  const activeOnPage = products.filter((p) => p.is_active).length;
  const inactiveOnPage = products.filter((p) => !p.is_active).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1680px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trang chủ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Kho & Hàng hóa</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Sản phẩm & Danh mục</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
              <Package className="w-6 h-6 text-[#b8860b] shrink-0" />
              <span>Quản trị Sản phẩm & Danh mục</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý danh mục, mã SKU, giá vốn, giá bán lẻ và định mức cảnh báo tồn kho tối thiểu
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl text-xs font-medium shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'products'
                    ? 'bg-[#fdf8e6] text-[#926a09] border border-[#f7e08f] font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span>Sản phẩm ({pagination.total})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'categories'
                    ? 'bg-[#fdf8e6] text-[#926a09] border border-[#f7e08f] font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tags className="w-3.5 h-3.5 shrink-0" />
                <span>Danh mục ({categories.length})</span>
              </button>
            </div>

            {activeTab === 'products' && canManageProducts && (
              <button type="button" onClick={openAddProduct} className="wm-btn wm-btn-primary">
                <Plus className="w-4 h-4" />
                <span>Thêm sản phẩm</span>
              </button>
            )}

            {activeTab === 'categories' && canManageCategories && (
              <button type="button" onClick={openAddCategory} className="wm-btn wm-btn-primary">
                <Plus className="w-4 h-4" />
                <span>Thêm danh mục</span>
              </button>
            )}
          </div>
        </header>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            {success}
          </div>
        )}

        {activeTab === 'products' ? (
          <>
            {/* 4-cell KPI Strip (modeled on products.html .kh-strip) */}
            <div className="wm-card grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setStatusFilter('')}
                className={`p-4 flex items-center justify-between gap-3 text-left transition ${
                  statusFilter === '' ? 'bg-[#fffdf7] shadow-[inset_0_-3px_0_#d4af37]' : 'hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Tổng danh mục SP</span>
                  <b className="text-2xl font-extrabold text-slate-900 mt-0.5 block tabular-nums">
                    {formatNumber(pagination.total)}
                  </b>
                  <span className="text-[11px] text-slate-400">toàn bộ mã SKU</span>
                </div>
                <span className="w-10 h-10 rounded-xl bg-[#fdf8e6] border border-[#f7e08f] text-[#b8860b] flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('true')}
                className={`p-4 flex items-center justify-between gap-3 text-left transition ${
                  statusFilter === 'true' ? 'bg-emerald-50/50 shadow-[inset_0_-3px_0_#10b981]' : 'hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Đang mở bán</span>
                  <b className="text-2xl font-extrabold text-emerald-700 mt-0.5 block tabular-nums">
                    {formatNumber(activeOnPage)}
                  </b>
                  <span className="text-[11px] text-slate-400">trên trang hiện tại</span>
                </div>
                <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('false')}
                className={`p-4 flex items-center justify-between gap-3 text-left transition ${
                  statusFilter === 'false' ? 'bg-amber-50/50 shadow-[inset_0_-3px_0_#f59e0b]' : 'hover:bg-slate-50/70'
                }`}
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Ngừng bán</span>
                  <b className="text-2xl font-extrabold text-slate-700 mt-0.5 block tabular-nums">
                    {formatNumber(inactiveOnPage)}
                  </b>
                  <span className="text-[11px] text-slate-400">đã tạm khóa</span>
                </div>
                <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
              </button>

              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Nhóm phân loại</span>
                  <b className="text-2xl font-extrabold text-slate-900 mt-0.5 block tabular-nums">
                    {formatNumber(categories.length)}
                  </b>
                  <span className="text-[11px] text-slate-400">danh mục hàng hóa</span>
                </div>
                <span className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <Tags className="w-5 h-5" />
                </span>
              </div>
            </div>

            {/* Products Table Card */}
            <section className="wm-card overflow-hidden">
              {/* Filter Bar */}
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
                    className="wm-field w-full pl-9"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="wm-field min-w-40"
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="wm-field min-w-36"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">Đang kinh doanh</option>
                  <option value="false">Ngừng kinh doanh</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('');
                    setStatusFilter('');
                  }}
                  className="wm-btn wm-btn-ghost"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Đặt lại</span>
                </button>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {loading ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    Đang tải danh sách sản phẩm...
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    Không tìm thấy sản phẩm phù hợp.
                  </div>
                ) : (
                  products.map((p) => {
                    const imgUrl = p.image_url || p.imageUrl;
                    return (
                      <div key={p.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="w-13 h-13 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold text-[#926a09]">{p.sku}</span>
                              {p.is_active ? (
                                <span className="wm-badge wm-badge-success">Đang bán</span>
                              ) : (
                                <span className="wm-badge wm-badge-neutral">Ngừng bán</span>
                              )}
                            </div>
                            <div className="font-bold text-xs text-slate-900 mt-0.5 line-clamp-2">{p.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {p.category_name || 'Chưa phân loại'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <div className="space-x-3 tabular-nums">
                            <span className="text-slate-500">
                              Vốn: <strong>{formatCurrency(p.cost_price)}</strong>
                            </span>
                            <span className="text-[#926a09]">
                              Bán: <strong>{formatCurrency(p.sale_price)}</strong>
                            </span>
                          </div>
                          {canManageProducts && (
                            <button
                              type="button"
                              onClick={() => openEditProduct(p)}
                              className="wm-btn wm-btn-ghost !h-7 !px-2.5 text-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="wm-table min-w-[920px]">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Mã SKU</th>
                      <th>Danh mục</th>
                      <th className="text-right">Giá vốn</th>
                      <th className="text-right">Giá bán lẻ</th>
                      <th className="text-center">Ngưỡng tồn</th>
                      <th className="text-center">Trạng thái</th>
                      {canManageProducts && <th className="text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Đang tải danh sách sản phẩm...
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Không tìm thấy sản phẩm phù hợp.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => {
                        const imgUrl = p.image_url || p.imageUrl;
                        return (
                          <tr key={p.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={p.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Package className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate max-w-[260px]">
                                    {p.name}
                                  </div>
                                  {p.description && (
                                    <div className="text-[11px] text-slate-500 line-clamp-1">
                                      {p.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-xs font-semibold text-[#926a09] bg-[#fdf8e6] px-2 py-0.5 rounded border border-[#f7e08f]">
                                {p.sku}
                              </span>
                            </td>
                            <td className="text-slate-600">
                              {p.category_name || <span className="text-slate-400">Chưa phân loại</span>}
                            </td>
                            <td className="text-right text-slate-600">{formatCurrency(p.cost_price)}</td>
                            <td className="text-right font-extrabold text-slate-900">
                              {formatCurrency(p.sale_price)}
                            </td>
                            <td className="text-center font-semibold text-slate-700">
                              {formatNumber(p.reorder_level)}
                            </td>
                            <td className="text-center">
                              {p.is_active ? (
                                <span className="wm-badge wm-badge-success">
                                  <CheckCircle2 className="w-3 h-3" /> Đang bán
                                </span>
                              ) : (
                                <span className="wm-badge wm-badge-neutral">
                                  <XCircle className="w-3 h-3" /> Ngừng bán
                                </span>
                              )}
                            </td>
                            {canManageProducts && (
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => openEditProduct(p)}
                                  className="wm-btn wm-btn-ghost !h-8 !px-2.5 text-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Sửa</span>
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
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Trang {pagination.page} / {pagination.totalPages} ({pagination.total} sản phẩm)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => loadProducts(pagination.page - 1)}
                      className="wm-btn wm-btn-ghost !h-8 !px-3"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadProducts(pagination.page + 1)}
                      className="wm-btn wm-btn-ghost !h-8 !px-3"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="wm-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="wm-table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Mô tả</th>
                    <th className="text-center">Trạng thái</th>
                    {canManageCategories && <th className="text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {loadingCategories ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Đang tải danh mục...
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Chưa có danh mục nào.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.id}>
                        <td className="font-bold text-slate-900">{cat.name}</td>
                        <td className="text-slate-600">{cat.description || '—'}</td>
                        <td className="text-center">
                          {cat.is_active ? (
                            <span className="wm-badge wm-badge-success">Hoạt động</span>
                          ) : (
                            <span className="wm-badge wm-badge-neutral">Đã ẩn</span>
                          )}
                        </td>
                        {canManageCategories && (
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => openEditCategory(cat)}
                              className="wm-btn wm-btn-ghost !h-8 !px-2.5 text-xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Chỉnh sửa sản phẩm: ${editingProduct.sku}` : 'Thêm sản phẩm mới'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mã SKU *</label>
              <input
                type="text"
                disabled={Boolean(editingProduct)}
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="wm-field w-full disabled:bg-slate-100 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên sản phẩm *</label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="wm-field w-full"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Danh mục</label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="wm-field w-full"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ngưỡng tồn tối thiểu</label>
              <input
                type="number"
                min="0"
                value={productForm.reorderLevel}
                onChange={(e) => setProductForm({ ...productForm, reorderLevel: e.target.value })}
                className="wm-field w-full tabular-nums"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Giá vốn (VNĐ) *</label>
              <input
                type="number"
                min="0"
                value={productForm.costPrice}
                onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                className="wm-field w-full tabular-nums"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Giá bán lẻ (VNĐ) *</label>
              <input
                type="number"
                min="0"
                value={productForm.salePrice}
                onChange={(e) => setProductForm({ ...productForm, salePrice: e.target.value })}
                className="wm-field w-full tabular-nums"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hình ảnh sản phẩm (URL)</label>
            <div className="flex items-center gap-3">
              {productForm.imageUrl && (
                <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
                  <img
                    src={productForm.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <input
                type="url"
                value={productForm.imageUrl}
                onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                placeholder="https://..."
                className="wm-field flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô tả sản phẩm</label>
            <textarea
              rows={2}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>

          {editingProduct && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                className="rounded border-slate-300 text-[#b8860b]"
              />
              <span className="font-medium text-slate-700">
                Đang kinh doanh (hiển thị trên POS & Kênh Online)
              </span>
            </label>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" onClick={() => setIsProductModalOpen(false)} className="wm-btn wm-btn-ghost">
              Hủy
            </button>
            <button type="submit" disabled={savingProduct} className="wm-btn wm-btn-primary">
              {savingProduct ? 'Đang lưu...' : 'Lưu sản phẩm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục sản phẩm'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên danh mục *</label>
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="wm-field w-full"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô tả</label>
            <textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={categoryForm.isActive}
              onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
              className="rounded border-slate-300 text-[#b8860b]"
            />
            <span className="font-medium text-slate-700">Kích hoạt danh mục</span>
          </label>
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="wm-btn wm-btn-ghost">
              Hủy
            </button>
            <button type="submit" disabled={savingCategory} className="wm-btn wm-btn-primary">
              {savingCategory ? 'Đang lưu...' : 'Lưu danh mục'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
