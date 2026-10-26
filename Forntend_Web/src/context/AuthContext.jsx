import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

const normalizeUser = (rawUser) => {
  if (!rawUser) return null;
  const role = rawUser.role_code || rawUser.role || null;
  return {
    ...rawUser,
    role,
    role_code: role,
    fullName: rawUser.full_name || rawUser.fullName || rawUser.email,
    permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      setLoading(true);
      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      try {
        const res = await authApi.getMe();
        const normalized = normalizeUser(res?.data);
        if (!normalized) throw new Error('Invalid user response');
        if (active) {
          setUser(normalized);
          localStorage.setItem('user', JSON.stringify(normalized));
        }
      } catch {
        console.warn('Phiên đăng nhập cũ không hợp lệ hoặc đã hết hạn');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    initAuth();
    return () => {
      active = false;
    };
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const accessToken = res?.data?.accessToken || res?.accessToken;
      if (!accessToken) throw new Error('Không nhận được token xác thực từ server');

      localStorage.setItem('token', accessToken);
      const meResponse = await authApi.getMe();
      const normalized = normalizeUser(meResponse?.data);
      if (!normalized) throw new Error('Không nhận được thông tin người dùng từ server');

      localStorage.setItem('user', JSON.stringify(normalized));
      setToken(accessToken);
      setUser(normalized);
      setLoading(false);
      return normalized;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles) => Boolean(user?.role && roles.includes(user.role));
  const hasPermission = (permission) => Boolean(permission && user?.permissions?.includes(permission));
  const hasAnyPermission = (...permissions) => permissions.some(hasPermission);
  const hasAllPermissions = (...permissions) => permissions.every(hasPermission);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
