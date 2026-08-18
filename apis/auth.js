import api from './axios';

export const login = async (username, password, deviceLabel) => {
  const res = await api.post('/auth/login', { username, password, deviceLabel });
  return res.data.data; // { accessToken, refreshToken, userId }
};

export const refreshAccessToken = async (refreshToken, userId) => {
  const res = await api.post('/auth/refresh', { refreshToken, userId });
  return res.data.data; // { accessToken, refreshToken, userId }
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data.data; // { _id, email, role }
};

export const logout = async (refreshToken, { allDevices = false } = {}) => {
  try {
    await api.post('/auth/logout', { refreshToken, allDevices });
  } catch (_) {
    // Ignore logout errors — always clear local state
  }
};

// List active sessions for the current user
export const listSessions = async () => {
  const res = await api.get('/auth/sessions');
  return res.data.data;
};

// Revoke a specific session by id
export const revokeSession = async (sessionId) => {
  const res = await api.delete(`/auth/sessions/${sessionId}`);
  return res.data;
};

// ── Push notifications ──────────────────────────────────────────────────
// Called after the user grants notification permission. Idempotent — brain
// upserts on token, so multiple calls with the same token are safe.
export const registerPushToken = async ({ token, platform, deviceLabel }) => {
  const res = await api.post('/auth/push-tokens', { token, platform, deviceLabel });
  return res.data;
};

export const unregisterPushToken = async (token) => {
  const res = await api.delete('/auth/push-tokens', { data: { token } });
  return res.data;
};

export const updateNotificationPreferences = async (prefs) => {
  const res = await api.patch('/auth/notification-preferences', { notificationPrefs: prefs });
  return res.data;
};
