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
} from 'lucide-react';
import { managerApi } from '../api/managerApi';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export const ProductsPage = () => {
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('manager.products.manage');
  const canManageCategories = hasPermission('manager.categories.manage');

  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'categories'

  // Products state
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Product Modal
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

  // Category Modal
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

  const loadProducts = useCallback(async (page = 1) => {
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
  }, [search, categoryFilter, statusFilter]);

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Quản trị Sản phẩm & Danh mục</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh mục, mã SKU, giá vốn, giá bán và định mức cảnh báo tồn kho
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                activeTab === 'products' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Sản phẩm ({pagination.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition ${
                activeTab === 'categories' ? 'bg-white text-blue-700 shadow-2xs font-semibold' : 'text-slate-600'
              }`}
            >
              <Tags className="w-3.5 h-3.5" />
              <span>Danh mục ({categories.length})</span>
            </button>
          </div>

          {activeTab === 'products' && canManageProducts && (
            <button
              type="button"
              onClick={openAddProduct}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm sản phẩm</span>
            </button>
          )}

          {activeTab === 'categories' && canManageCategories && (
            <button
              type="button"
              onClick={openAddCategory}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm danh mục</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
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

        {activeTab === 'products' ? (
          <>
            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm theo tên sản phẩm hoặc mã SKU..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
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
                className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-700"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="true">Đang kinh doanh</option>
                <option value="false">Ngừng kinh doanh</option>
              </select>

              <button
                type="button"
                onClick={() => loadProducts(pagination.page)}
                className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-3 px-4">Mã SKU</th>
                      <th className="py-3 px-4">Tên sản phẩm</th>
                      <th className="py-3 px-4">Danh mục</th>
                      <th className="py-3 px-4 text-right">Giá vốn</th>
                      <th className="py-3 px-4 text-right">Giá bán</th>
                      <th className="py-3 px-4 text-center">Ngưỡng tồn</th>
                      <th className="py-3 px-4 text-center">Trạng thái</th>
                      {canManageProducts && <th className="py-3 px-4 text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          Đang tải danh sách sản phẩm...
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          Không tìm thấy sản phẩm phù hợp.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => {
                        const imgUrl = p.image_url || p.imageUrl;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-mono font-semibold text-blue-700">{p.sku}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
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
                                  <div className="font-semibold text-slate-900">{p.name}</div>
                                  {p.description && (
                                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                      {p.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.category_name || <span className="text-slate-400">Chưa phân loại</span>}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 tabular-nums">
                            {formatCurrency(p.cost_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(p.sale_price)}
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-slate-700 tabular-nums">
                            {formatNumber(p.reorder_level)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {p.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Đang bán
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                <XCircle className="w-3 h-3" /> Ngừng bán
                              </span>
                            )}
                          </td>
                            {canManageProducts && (
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => openEditProduct(p)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition"
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

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Trang {pagination.page} / {pagination.totalPages} ({pagination.total} sản phẩm)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => loadProducts(pagination.page - 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadProducts(pagination.page + 1)}
                      className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Categories Table */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Tên danh mục</th>
                    <th className="py-3 px-4">Mô tả</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    {canManageCategories && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingCategories ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400">
                        Đang tải danh mục...
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400">
                        Chưa có danh mục nào.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{cat.name}</td>
                        <td className="py-3 px-4 text-slate-600">{cat.description || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          {cat.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Đã ẩn
                            </span>
                          )}
                        </td>
                        {canManageCategories && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => openEditCategory(cat)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition"
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
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa Sản phẩm */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? `Chỉnh sửa sản phẩm: ${editingProduct.sku}` : 'Thêm sản phẩm mới'}
      >
        <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mã SKU *</label>
              <input
                type="text"
                disabled={Boolean(editingProduct)}
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:bg-slate-100 font-mono"
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
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Danh mục</label>
              <select
                value={productForm.categoryId}
                onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
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
              <label className="block font-semibold text-slate-700 mb-1">Mức tồn kho tối thiểu (Cảnh báo sắp hết hàng)</label>
              <input
                type="number"
                min="0"
                value={productForm.reorderLevel}
                onChange={(e) => setProductForm({ ...productForm, reorderLevel: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hình ảnh sản phẩm (URL)</label>
            <div className="flex items-center gap-3">
              {productForm.imageUrl && (
                <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0">
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
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô tả sản phẩm</label>
            <textarea
              rows={2}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          {editingProduct && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="font-medium text-slate-700">Đang kinh doanh (hiển thị trên POS & Kênh Online)</span>
            </label>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingProduct}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {savingProduct ? 'Đang lưu...' : 'Lưu sản phẩm'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Thêm / Sửa Danh mục */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục sản phẩm'}
      >
        <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên danh mục *</label>
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mô tả</label>
            <textarea
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={categoryForm.isActive}
              onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
              className="rounded border-slate-300 text-blue-600"
            />
            <span className="font-medium text-slate-700">Kích hoạt danh mục</span>
          </label>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingCategory}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {savingCategory ? 'Đang lưu...' : 'Lưu danh mục'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

