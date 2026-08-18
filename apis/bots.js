import api from './axios';

export const listBots = async () => {
  const res = await api.get('/bots/list');
  return res.data.data;
};

export const getBots = listBots;

export const getBotStatus = async (botId) => {
  const res = await api.get(`/bots/status/${botId}`);
  return res.data.data; // { agentStatus, scraperStatus, agentSeenMs, scraperSeenMs }
};

export const checkBotStatus = getBotStatus;

export const startBot = async (botId) => {
  const res = await api.post(`/bots/start/${botId}`);
  return res.data;
};

export const startBotRemote = startBot;

export const stopBot = async (botId) => {
  const res = await api.post(`/bots/stop/${botId}`);
  return res.data;
};

export const stopBotRemote = stopBot;

export const updateBot = async (payload) => {
  const res = await api.patch('/bots/update', payload);
  return res.data.data;
};

export const getBotSettings = async (botId) => {
  const res = await api.get(`/bots/settings/${botId}`);
  return res.data.data;
};

export const updateBotSettings = async (botId, settings) => {
  const res = await api.patch(`/bots/settings/${botId}`, settings);
  return res.data.data;
};

export const resetBotStats = async (botId) => {
  const res = await api.patch(`/bots/reset-stats/${botId}`);
  return res.data.data;
};

export const testBotAlert = async () => {
  const res = await api.get('/bots/test-alert');
  return res.data.data;
};
