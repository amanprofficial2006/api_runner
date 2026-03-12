import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreUser = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('User not authenticated');
        }

        const userData = await response.json();
        if (!cancelled) {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem('user');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('user');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: 'include',
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }
    } catch {
      // Frontend session is already cleared; fall back to local navigation.
    } finally {
      window.location.href = '/';
    }
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

