import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PosProvider, usePos } from './context/PosContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { WarehouseApprovalsPage } from './pages/WarehouseApprovalsPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { DataExchangePage } from './pages/DataExchangePage';
import { UsersPage } from './pages/UsersPage';
import { ShopPage } from './pages/ShopPage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { OpenShiftModal } from './components/pos/OpenShiftModal';
import { CloseShiftModal } from './components/pos/CloseShiftModal';

const getHomePath = (hasPermission, hasAnyPermission, hasAllPermissions) => {
  if (hasAnyPermission('manager.dashboard.read', 'manager.reports.read')) return '/dashboard';
  if (hasAllPermissions('pos.sessions.manage', 'pos.products.read')) return '/pos';
  if (hasAnyPermission('manager.orders.read', 'pos.sales.read')) return '/orders';
  if (hasAnyPermission('manager.products.read', 'manager.categories.read')) return '/products';
  if (hasAnyPermission('warehouse.documents.approve', 'manager.documents.read')) return '/warehouse-approvals';
  if (hasPermission('manager.inventory.read')) return '/inventory';
  if (hasPermission('forecasting.read')) return '/forecasting';
  if (hasAnyPermission('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read')) {
    return '/data-exchange';
  }
  if (hasAnyPermission('auth.users.read', 'auth.roles.read')) return '/users';
  if (hasAnyPermission('customer.catalog.read', 'customer.orders.read')) return '/shop';
  return '/403';
};

const PermissionRoute = ({ children, all = [], any = [] }) => {
  const { hasAllPermissions, hasAnyPermission } = useAuth();
  const allowed =
    (!all.length || hasAllPermissions(...all)) &&
    (!any.length || hasAnyPermission(...any));
  return allowed ? children : <Navigate to="/403" replace />;
};

const ProtectedContent = () => {
  const { user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const { currentSession, refreshSession } = usePos();
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const canManageSession = hasPermission('pos.sessions.manage');
  const homePath = getHomePath(hasPermission, hasAnyPermission, hasAllPermissions);
  const isCustomerOnly =
    user?.role === 'customer' ||
    (homePath === '/shop' &&
      !hasAnyPermission(
        'manager.dashboard.read',
        'manager.reports.read',
        'pos.sessions.manage',
        'pos.products.read',
        'manager.orders.read',
        'pos.sales.read',
        'manager.products.read',
        'manager.categories.read',
        'warehouse.documents.approve',
        'manager.documents.read',
        'manager.inventory.read',
        'forecasting.read',
        'data_exchange.import',
        'data_exchange.export',
        'data_exchange.jobs.read',
        'auth.users.read',
        'auth.roles.read'
      ));

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#0f172a] flex flex-col font-sans text-slate-900">
      <Navbar
        isCustomerOnly={isCustomerOnly}
        onOpenShiftClick={canManageSession ? () => setIsOpenShiftModalOpen(true) : undefined}
        onCloseShiftClick={canManageSession ? () => setIsCloseShiftModalOpen(true) : undefined}
        onMenuClick={isCustomerOnly ? undefined : () => setIsSidebarOpen(true)}
      />

      {!isCustomerOnly && (
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden bg-[#f8fafc] lg:rounded-t-[22px] shadow-[0_-8px_28px_rgba(0,0,0,0.22)] relative z-10">
        <main className="min-w-0 flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <Routes>
            <Route
              path="/dashboard"
              element={
                <PermissionRoute any={['manager.dashboard.read', 'manager.reports.read']}>
                  <DashboardPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/pos"
              element={
                <PermissionRoute all={['pos.sessions.manage', 'pos.products.read']}>
                  <PosPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PermissionRoute any={['manager.orders.read', 'pos.sales.read']}>
                  <OrdersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/products"
              element={
                <PermissionRoute any={['manager.products.read', 'manager.categories.read']}>
                  <ProductsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/warehouse-approvals"
              element={
                <PermissionRoute any={['warehouse.documents.approve', 'manager.documents.read']}>
                  <WarehouseApprovalsPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <PermissionRoute all={['manager.inventory.read']}>
                  <InventoryPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/forecasting"
              element={
                <PermissionRoute all={['forecasting.read']}>
                  <ForecastingPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/data-exchange"
              element={
                <PermissionRoute any={['data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read']}>
                  <DataExchangePage />
                </PermissionRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PermissionRoute any={['auth.users.read', 'auth.roles.read']}>
                  <UsersPage />
                </PermissionRoute>
              }
            />
            <Route
              path="/shop"
              element={
                <PermissionRoute any={['customer.catalog.read', 'customer.orders.read']}>
                  <ShopPage />
                </PermissionRoute>
              }
            />
            <Route path="/403" element={<ForbiddenPage homePath={homePath} />} />
            <Route path="/" element={<Navigate to={homePath} replace />} />
            <Route path="*" element={<Navigate to={homePath} replace />} />
          </Routes>
        </main>
      </div>

      {canManageSession && (
        <>
          <OpenShiftModal
            isOpen={isOpenShiftModalOpen}
            onClose={() => setIsOpenShiftModalOpen(false)}
            onSuccess={refreshSession}
          />
          <CloseShiftModal
            isOpen={isCloseShiftModalOpen}
            onClose={() => setIsCloseShiftModalOpen(false)}
            session={currentSession}
            onSuccess={refreshSession}
          />
        </>
      )}
    </div>
  );
};

const ProtectedLayout = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-3 text-slate-300 text-sm"
        role="status"
      >
        <div className="w-11 h-11 rounded-2xl bg-[#d4af37]/15 border border-[#d4af37]/40 flex items-center justify-center text-[#f7d268] font-extrabold animate-pulse">
          KW
        </div>
        <div className="text-center">
          <p className="font-bold text-white">Đang tải hệ thống kho & bán lẻ...</p>
          <p className="text-xs text-slate-400 mt-0.5">Kiểm tra phân quyền và đồng bộ dữ liệu trực tuyến</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <PosProvider>
      <ProtectedContent />
    </PosProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
