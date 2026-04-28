import { useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../store/authStore';
import { login as apiLogin, logout as apiLogout, getMe, refreshAccessToken } from '../apis/auth';

const useAuth = () => {
  const { accessToken, user, isLoaded, setTokens, setUser, clearTokens, setLoaded } =
    useAuthStore();

  // On app start: try to restore session from SecureStore
  useEffect(() => {
    const restore = async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          setLoaded();
          return;
        }
        const { accessToken: newToken } = await refreshAccessToken(refreshToken);
        setTokens(newToken);
        const me = await getMe();
        setUser(me);
      } catch (err) {
        // Refresh failed — clear stale tokens
        await SecureStore.deleteItemAsync('refreshToken');
        clearTokens();
      } finally {
        setLoaded();
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const { accessToken, refreshToken } = await apiLogin(email, password);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    setTokens(accessToken);
    const me = await getMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    } catch (_) {
      // Ignore
    } finally {
      await SecureStore.deleteItemAsync('refreshToken');
      clearTokens();
    }
  }, []);

  return {
    isAuthenticated: !!accessToken,
    isLoaded,
    user,
    login,
    logout,
  };
};

export default useAuth;
