import api from './axios';

export const getJobs = async (params = {}) => {
  const res = await api.get('/jobs', { params });
  return res.data.data; // { jobs, total, totalAll }
};

export const getJob = async (id) => {
  const res = await api.get(`/jobs/${id}`);
  return res.data.data;
};

export const generateProposal = async (jobId, type = 'medium') => {
  const res = await api.post(`/jobs/generate-proposal/${jobId}`, { type });
  return res.data.data; // { proposal }
};
