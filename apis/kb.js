// Static Knowledge Base (Profiles) API
// Brain expects Mongo _id for all per-profile routes.
// To minimize churn, the helpers here accept EITHER an _id OR a profileName
// — if you pass a profileName, the wrapper resolves it via /kb/list internally.
import api from './axios';

// Mongo ObjectId is exactly 24 hex chars.
const looksLikeId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);

// Returns the profiles array directly: [{ _id, profileName, enabled, ... }]
export const getKBList = async () => {
  const res = await api.get('/kb/list');
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.profiles)) return data.profiles;
  return [];
};

// Resolve a profile reference (id or name) to its Mongo _id.
const resolveId = async (idOrName) => {
  if (looksLikeId(idOrName)) return idOrName;
  const list = await getKBList();
  const match = list.find((p) => p.profileName === idOrName);
  if (!match?._id) throw new Error(`Profile not found: ${idOrName}`);
  return match._id;
};

// Get full profile by id or name.
export const getProfile = async (idOrName) => {
  const id = await resolveId(idOrName);
  const res = await api.get(`/kb/${id}`);
  const data = res.data?.data;
  return data?.profile || data;
};

export const createProfile = async (profileName) => {
  // Brain route is POST /kb (not /kb/create)
  const res = await api.post('/kb', { profileName });
  return res.data?.data;
};

export const updateProfile = async (idOrName, payload) => {
  const id = await resolveId(idOrName);
  const res = await api.patch(`/kb/${id}`, payload);
  const data = res.data?.data;
  return data?.profile || data;
};

export const deleteProfile = async (idOrName) => {
  const id = await resolveId(idOrName);
  const res = await api.delete(`/kb/${id}`);
  return res.data;
};

export const toggleProfileEnabled = async (idOrName, enabled) => {
  const id = await resolveId(idOrName);
  // Brain route is POST /kb/:id/toggle-enabled (not PATCH)
  const res = await api.post(`/kb/${id}/toggle-enabled`, { enabled });
  return res.data?.data;
};
