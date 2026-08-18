import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import useAuthStore from '../store/authStore';
import { login as apiLogin, logout as apiLogout, getMe, refreshAccessToken } from '../apis/auth';
import { registerForPushNotifications, configureNotificationHandler } from '../utils/pushRegistration';

// Build a stable device label like "Mobile · iOS · iPhone15,2"
const buildDeviceLabel = () => {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  const model =
    Constants.deviceName ||
    Constants.expoConfig?.ios?.bundleIdentifier ||
    Constants.expoConfig?.android?.package ||
    'Device';
  return `Mobile · ${os} · ${model}`;
};

const useAuth = () => {
  const { accessToken, user, isLoaded, setTokens, setUser, clearTokens, setLoaded } =
    useAuthStore();

  // On app start: try to restore session from SecureStore
  useEffect(() => {
    configureNotificationHandler(); // safe no-op if expo-notifications isn't bundled

    const restore = async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        const userId = await SecureStore.getItemAsync('userId');
        if (!refreshToken || !userId) {
          setLoaded();
          return;
        }
        const result = await refreshAccessToken(refreshToken, userId);
        // Save rotated refresh token
        await SecureStore.setItemAsync('refreshToken', result.refreshToken);
        await SecureStore.setItemAsync('userId', result.userId || userId);
        setTokens(result.accessToken);
        const me = await getMe();
        setUser(me);
        // Re-register push token on session restore so an OS-rotated token
        // stays fresh in brain. Fire-and-forget — never block boot.
        registerForPushNotifications().catch(() => {});
      } catch (err) {
        // Refresh failed — clear stale tokens
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('userId');
        clearTokens();
      } finally {
        setLoaded();
      }
    };
    restore();
  }, []);

  const login = useCallback(async (username, password) => {
    const deviceLabel = buildDeviceLabel();
    const result = await apiLogin(username, password, deviceLabel);
    await SecureStore.setItemAsync('refreshToken', result.refreshToken);
    await SecureStore.setItemAsync('userId', result.userId);
    setTokens(result.accessToken);
    const me = await getMe();
    setUser(me);
    // Register for push notifications after a successful login. The OS
    // prompt is shown on first grant; subsequent calls are silent.
    registerForPushNotifications().catch(() => {});
  }, []);

  // logout(): clears only this device's session (multi-device safe)
  // logout({ allDevices: true }): revokes every active session for the user
  const logout = useCallback(async ({ allDevices = false } = {}) => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        await apiLogout(refreshToken, { allDevices });
      }
    } catch (_) {
      // Ignore
    } finally {
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('userId');
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
