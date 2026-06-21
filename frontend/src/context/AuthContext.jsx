/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import {
  clearStoredToken,
  getStoredToken,
  getStoredRefreshToken,
  setStoredTokens,
} from '../services/api';

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

  // Listen to session expiry/logout events from API client
  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth-logout', handleAuthLogout);
    return () => window.removeEventListener('auth-logout', handleAuthLogout);
  }, []);

  const register = async (payload) => {
    const result = await authService.register(payload);
    setAuthError('');
    return result; // Success message, no token/login
  };

  const login = async (payload) => {
    const result = await authService.login(payload);
    setStoredTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    setAuthError('');
    return result.user;
  };

  const logout = async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (error) {
      console.error('Failed to logout on backend', error);
    } finally {
      clearStoredToken();
      setUser(null);
    }
  };

  const verifyEmail = async (token) => {
    return await authService.verifyEmail(token);
  };

  const forgotPassword = async (email) => {
    return await authService.forgotPassword(email);
  };

  const resetPassword = async (payload) => {
    return await authService.resetPassword(payload);
  };

  const changePassword = async (payload) => {
    return await authService.changePassword(payload);
  };

  const getSessions = async () => {
    return await authService.getSessions();
  };

  const revokeSession = async (sessionId) => {
    return await authService.revokeSession(sessionId);
  };

  const revokeOtherSessions = async () => {
    return await authService.revokeOtherSessions();
  };

  const revokeAllSessions = async () => {
    return await authService.revokeAllSessions();
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
      verifyEmail,
      forgotPassword,
      resetPassword,
      changePassword,
      getSessions,
      revokeSession,
      revokeOtherSessions,
      revokeAllSessions,
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
