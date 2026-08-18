// BD Playground — multi-turn RAG chat
// Brain shape:
//   POST /playground/query  body { query, conversationHistory } → { answer, contextProjects }
// Brain searches across ALL profiles automatically — no profileId is needed.
import api from './axios';

// Backwards-compat shim: returns an empty array. The brain has no
// /playground/profiles endpoint anymore — it searches all profiles. The mobile
// UI keeps the function so existing imports don't crash.
export const getPlaygroundProfiles = async () => {
  return [];
};

export const playgroundQuery = async ({ message, history = [] } = {}) => {
  // Translate mobile-facing names → brain-facing names.
  const conversationHistory = (history || []).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const res = await api.post('/playground/query', {
    query: message,
    conversationHistory,
  });
  const data = res.data?.data || {};
  // Re-shape into { reply, context } so existing playground UI keeps working.
  const context = (data.contextProjects || []).map((p) => ({
    title: p.title || p.projectTitle || '',
    score: typeof p.similarity === 'number' ? p.similarity / 100 : 0,
    text: p.snippet || p.text || '',
  }));
  return {
    reply: data.answer || '',
    context,
  };
};
