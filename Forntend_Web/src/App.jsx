import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PosProvider, usePos } from './context/PosContext';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { PosPage } from './pages/PosPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { ForecastingPage } from './pages/ForecastingPage';
import { DataExchangePage } from './pages/DataExchangePage';
import { ForbiddenPage } from './pages/ForbiddenPage';
import { OpenShiftModal } from './components/pos/OpenShiftModal';
import { CloseShiftModal } from './components/pos/CloseShiftModal';

const getHomePath = (hasPermission, hasAnyPermission, hasAllPermissions) => {
  if (hasAllPermissions('pos.sessions.manage', 'pos.products.read')) return '/pos';
  if (hasAnyPermission('manager.orders.read', 'pos.sales.read')) return '/orders';
  if (hasPermission('manager.inventory.read')) return '/inventory';
  if (hasPermission('forecasting.read')) return '/forecasting';
  if (hasAnyPermission('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read')) {
    return '/data-exchange';
  }
  return '/403';
};

const PermissionRoute = ({ children, all = [], any = [] }) => {
  const { hasAllPermissions, hasAnyPermission } = useAuth();
  const allowed = (!all.length || hasAllPermissions(...all)) &&
    (!any.length || hasAnyPermission(...any));
  return allowed ? children : <Navigate to="/403" replace />;
};

const ProtectedContent = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  const { currentSession, refreshSession } = usePos();
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const canManageSession = hasPermission('pos.sessions.manage');
  const homePath = getHomePath(hasPermission, hasAnyPermission, hasAllPermissions);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
      <Navbar
        onOpenShiftClick={canManageSession ? () => setIsOpenShiftModalOpen(true) : undefined}
        onCloseShiftClick={canManageSession ? () => setIsCloseShiftModalOpen(true) : undefined}
        onMenuClick={() => setIsSidebarOpen(true)}
      />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="min-w-0 flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
          <Routes>
            <Route path="/pos" element={
              <PermissionRoute all={['pos.sessions.manage', 'pos.products.read']}><PosPage /></PermissionRoute>
            } />
            <Route path="/orders" element={
              <PermissionRoute any={['manager.orders.read', 'pos.sales.read']}><OrdersPage /></PermissionRoute>
            } />
            <Route path="/inventory" element={
              <PermissionRoute all={['manager.inventory.read']}><InventoryPage /></PermissionRoute>
            } />
            <Route path="/forecasting" element={
              <PermissionRoute all={['forecasting.read']}><ForecastingPage /></PermissionRoute>
            } />
            <Route path="/data-exchange" element={
              <PermissionRoute any={['data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read']}>
                <DataExchangePage />
              </PermissionRoute>
            } />
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
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-500 text-sm" role="status">
        Đang xác minh quyền truy cập Karat Retail...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <PosProvider><ProtectedContent /></PosProvider>;
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
