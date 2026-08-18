// Global settings (notifications, scraper categories, alert thresholds)
// Brain routes:
//   GET  /settings        → settings doc as data
//   POST /settings/update → upsert; returns updated doc
import api from './axios';

export const getSettings = async () => {
  const res = await api.get('/settings');
  return res.data?.data;
};

export const updateSettings = async (payload) => {
  const res = await api.post('/settings/update', payload);
  return res.data?.data;
};
