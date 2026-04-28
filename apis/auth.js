import api from './axios';

export const login = async (email, password) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { accessToken, refreshToken }
};

export const refreshAccessToken = async (refreshToken) => {
  const res = await api.post('/auth/refresh', { refreshToken });
  return res.data.data; // { accessToken }
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data.data; // { _id, email, role }
};

export const logout = async (refreshToken) => {
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch (_) {
    // Ignore logout errors — always clear local state
  }
};
