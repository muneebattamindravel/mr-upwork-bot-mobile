import api from './axios';

const get = (path, params) => api.get(path, params ? { params } : undefined).then(r => r.data.data);

export const getAnalyticsSummary       = ()        => get('/analytics/summary');
export const getJobsOverTime           = (range)   => get('/analytics/jobs-over-time', range ? { range } : undefined);
export const getScoreDistribution      = ()        => get('/analytics/score-distribution');
export const getTopCountries           = (limit=10)=> get('/analytics/top-countries', { limit });
export const getTopCategories          = (limit=10)=> get('/analytics/top-categories', { limit });
export const getProfileBreakdown       = ()        => get('/analytics/profile-breakdown');
export const getMainCategoryBreakdown  = ()        => get('/analytics/main-category-breakdown');
export const getPricingSplit           = ()        => get('/analytics/pricing-split');
export const getEmergingKeywords       = (limit=20)=> get('/analytics/emerging-keywords', { limit });
export const getPostingHeatmap         = (params)  => get('/analytics/posting-heatmap', params);
export const getHourlyDistribution     = ()        => get('/analytics/hourly-distribution');
export const getSemanticVerdictBreakdown=()        => get('/analytics/semantic-verdict');
export const getBudgetDistribution     = ()        => get('/analytics/budget-distribution');
export const getExperienceBreakdown    = ()        => get('/analytics/experience-breakdown');
export const getCategoriesByCountry    = (limit=8) => get('/analytics/categories-by-country', { limit });
export const getKeywordsByCategory     = (limit=20)=> get('/analytics/keywords-by-category', { limit });
export const getAnalyticsCacheStatus   = ()        => get('/analytics/cache-status');

export const flushAnalyticsCache = async () => {
  const res = await api.post('/analytics/flush-cache');
  return res.data;
};
