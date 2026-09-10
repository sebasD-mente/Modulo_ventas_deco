import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('deko_auth_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const logout = useCallback(() => {
    localStorage.removeItem('deko_auth_token');
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = {
        ...(options.headers || {}),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (res.status === 401) {
        logout();
      }

      return res;
    },
    [token, logout]
  );

  const checkSession = useCallback(async () => {
    const currentToken = localStorage.getItem('deko_auth_token') || token;
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('deko_auth_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn('[Auth Warning] Error verificando sesión:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Fallo en autenticación con Google');
      }

      localStorage.setItem('deko_auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const userRoles = useMemo(() => {
    return Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles
      : (user?.role ? [user.role] : []);
  }, [user]);

  const isSuperAdmin = useMemo(() => userRoles.includes('SUPER_ADMIN'), [userRoles]);
  const isVendedor = useMemo(() => userRoles.includes('VENDEDOR'), [userRoles]);
  const isOperario1 = useMemo(() => userRoles.includes('OPERARIO_1'), [userRoles]);
  const isOperario2 = useMemo(() => userRoles.includes('OPERARIO_2'), [userRoles]);
  const isProduccion = useMemo(() => isOperario1 || isOperario2 || isSuperAdmin, [isOperario1, isOperario2, isSuperAdmin]);

  const hasRole = useCallback((roleToCheck) => {
    if (isSuperAdmin) return true;
    return userRoles.includes(roleToCheck);
  }, [isSuperAdmin, userRoles]);

  const value = useMemo(() => ({
    user,
    token,
    isLoading,
    error,
    loginWithGoogle,
    logout,
    authFetch,
    roles: userRoles,
    hasRole,
    isSuperAdmin,
    isVendedor,
    isOperario1,
    isOperario2,
    isProduccion,
    checkSession,
  }), [
    user,
    token,
    isLoading,
    error,
    loginWithGoogle,
    logout,
    authFetch,
    userRoles,
    hasRole,
    isSuperAdmin,
    isVendedor,
    isOperario1,
    isOperario2,
    isProduccion,
    checkSession,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
