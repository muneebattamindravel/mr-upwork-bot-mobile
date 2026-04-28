import api from './axios';

export const listBots = async () => {
  const res = await api.get('/bots/list');
  return res.data.data; // array of bot objects
};

export const getBotStatus = async (botId) => {
  const res = await api.get(`/bots/status/${botId}`);
  return res.data.data; // { agentStatus, scraperStatus, agentSeenMs, scraperSeenMs }
};

export const startBot = async (botId) => {
  const res = await api.post(`/bots/start/${botId}`);
  return res.data;
};

export const stopBot = async (botId) => {
  const res = await api.post(`/bots/stop/${botId}`);
  return res.data;
};
