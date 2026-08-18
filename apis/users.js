// User management (superAdmin only on most ops)
import api from './axios';

// Returns array directly: [{ _id, username, name, role, isActive, ... }]
export const listUsers = async () => {
  const res = await api.get('/auth/users');
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  return [];
};

export const registerUser = async ({ username, name, password, role }) => {
  const res = await api.post('/auth/register', { username, name, password, role });
  return res.data.data;
};

export const deleteUser = async (id) => {
  const res = await api.delete(`/auth/users/${id}`);
  return res.data;
};

export const updateUserRole = async (id, role) => {
  const res = await api.patch(`/auth/users/${id}/role`, { role });
  return res.data.data;
};

export const toggleUserActive = async (id) => {
  const res = await api.patch(`/auth/users/${id}/toggle-active`);
  return res.data.data;
};

export const updateUserPassword = async (id, password) => {
  const res = await api.patch(`/auth/users/${id}/password`, { password });
  return res.data;
};
