import api from './axios';

export const getAnalyticsSummary = async () => {
  const res = await api.get('/analytics/summary');
  return res.data.data; // { totalJobs, avgScore, verdictCounts }
};

export const getJobsOverTime = async () => {
  const res = await api.get('/analytics/jobs-over-time');
  return res.data.data; // [{ date, count }]
};

export const getTopCategories = async (limit = 10) => {
  const res = await api.get('/analytics/top-categories', { params: { limit } });
  return res.data.data; // [{ _id, count }]
};

export const getScoreDistribution = async () => {
  const res = await api.get('/analytics/score-distribution');
  return res.data.data; // [{ range, count }]
};
