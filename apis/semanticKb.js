// Projects (Semantic Knowledge Base) API
// Brain expects body field `projectId` (NOT `id`), and there's no
// /projects/profiles endpoint — profiles come from /kb/list.
import api from './axios';

// Returns profiles array directly: [{ _id, profileName, ... }]
export const getProfiles = async () => {
  const res = await api.get('/kb/list');
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.profiles)) return data.profiles;
  return [];
};

// Returns the projects list payload — brain currently sends an array under data
// (or an object with .projects). Normalize to array.
export const listProjects = async (profileId) => {
  const res = await api.get('/projects/list', profileId ? { params: { profileId } } : undefined);
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.projects)) return data.projects;
  return [];
};

export const createProject = async (payload) => {
  const res = await api.post('/projects/create', payload);
  return res.data?.data;
};

export const updateProject = async (id, payload) => {
  const res = await api.patch('/projects/update', { projectId: id, ...payload });
  return res.data?.data;
};

export const deleteProject = async (id) => {
  const res = await api.delete('/projects/delete', { data: { projectId: id } });
  return res.data;
};

export const rewriteProject = async (id) => {
  const res = await api.post('/projects/rewrite', { projectId: id });
  return res.data?.data;
};

export const approveProject = async (id) => {
  const res = await api.post('/projects/approve', { projectId: id });
  return res.data?.data;
};

export const embedAll = async () => {
  const res = await api.post('/projects/embed-all');
  return res.data;
};

export const embedAllStatus = async () => {
  const res = await api.get('/projects/embed-all-status');
  return res.data?.data; // { running, done, embedded, total, errors }
};
