import api from './axios';

// Param name passthrough — mirrors the dashboard's /jobs query contract.
// Multi-value filters are sent as repeating params (axios does this when given arrays).
export const getJobs = async (params = {}) => {
  const res = await api.get('/jobs', { params });
  return res.data.data; // { jobs, total, totalAll }
};

// Alias kept for older imports
export const getFilteredJobs = getJobs;

export const getJob = async (id) => {
  const res = await api.get(`/jobs/${id}`);
  return res.data.data;
};

export const getJobById = getJob;

export const generateProposal = async (jobId, type = 'medium') => {
  const res = await api.post(`/jobs/generate-proposal/${jobId}`, { type });
  return res.data.data; // { proposal }
};

export const reprocessSingleJob = async (jobId) => {
  const res = await api.post(`/jobs/reprocess/${jobId}`);
  return res.data.data;
};

export const reprocessJobsStaticOnly = async (filters = {}) => {
  const res = await api.post('/jobs/reprocess-all-static-only', filters);
  return res.data.data;
};

export const deleteAllJobs = async () => {
  const res = await api.delete('/jobs');
  return res.data;
};
