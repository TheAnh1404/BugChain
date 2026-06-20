/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { clearStoredToken, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const token = getStoredToken();
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const currentUser = await authService.me();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (error) {
        clearStoredToken();
        if (isMounted) {
          setUser(null);
          setAuthError(error.message);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const register = async (payload) => {
    const result = await authService.register(payload);
    setStoredToken(result.accessToken);
    setUser(result.user);
    setAuthError('');
    return result.user;
  };

  const login = async (payload) => {
    const result = await authService.login(payload);
    setStoredToken(result.accessToken);
    setUser(result.user);
    setAuthError('');
    return result.user;
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const refreshMe = async () => {
    const currentUser = await authService.me();
    setUser(currentUser);
    return currentUser;
  };

  const updateProfile = async (payload) => {
    const updated = await userService.updateMe(payload);
    setUser(updated);
    return updated;
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      authError,
      register,
      login,
      logout,
      refreshMe,
      updateProfile,
    }),
    [user, isBootstrapping, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
