// SRAA (AI/RAG) settings — models, top-K, temperatures, prompts
import api from './axios';

export const getSraaSettings = async () => {
  const res = await api.get('/sraa-settings');
  return res.data.data;
};

export const updateSraaSettings = async (payload) => {
  const res = await api.put('/sraa-settings', payload);
  return res.data.data;
};
