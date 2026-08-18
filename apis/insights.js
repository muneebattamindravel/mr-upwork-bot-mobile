// Market Intelligence (per-category AI reports)
//
// Brain shapes (data field after respond()):
//   GET  /insights/categories  → ARRAY [{ category, jobCount, status, progress, generatedAt, jobsAnalyzed, error }]
//   POST /insights/generate/:c → no payload (202)
//   GET  /insights/status/:c   → { category, running, status, progress, generatedAt, jobsAnalyzed, error }
//   GET  /insights/report/:c   → full CategoryReport doc:
//       { category, status, progress, jobsAnalyzed, generatedAt,
//         stats: { ..., budgetBuckets: [{ range, count }] },
//         report: { executiveSummary, topSkills, tools, deliverables, clientIndustries,
//                   clientProfile, budgetInsights, portfolioRecommendations,
//                   strategicRecommendations, trends } }
import api from './axios';

// Returns array directly: [{ category, jobCount, status, ... }]
export const getInsightCategories = async () => {
  const res = await api.get('/insights/categories');
  const data = res.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.categories)) return data.categories;
  return [];
};

export const generateInsightReport = async (category, sampleSize = 500) => {
  const res = await api.post(`/insights/generate/${encodeURIComponent(category)}`, { sampleSize });
  return res.data;
};

export const getInsightStatus = async (category) => {
  const res = await api.get(`/insights/status/${encodeURIComponent(category)}`);
  return res.data?.data;
};

// Returns the full report doc { stats, report, ... }
export const getInsightReport = async (category) => {
  const res = await api.get(`/insights/report/${encodeURIComponent(category)}`);
  return res.data?.data;
};
