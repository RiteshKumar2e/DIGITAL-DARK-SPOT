import { request } from './apiClient.js';

const enc = encodeURIComponent;

export const researchApi = {
  health: () => request('/health'),

  createSession: ({ question, profile, website }) =>
    request('/research', { method: 'POST', body: { question, profile, website } }),
  createDemoSession: () => request('/research/demo', { method: 'POST', body: {} }),
  getSession: (id, signal) => request(`/research/${enc(id)}`, { signal }),
  updateSession: (id, changes) => request(`/research/${enc(id)}`, { method: 'PATCH', body: changes }),
  deleteSession: (id) => request(`/research/${enc(id)}`, { method: 'DELETE' }),

  addUrlSource: (id, url) => request(`/research/${enc(id)}/sources`, { method: 'POST', body: { type: 'url', url } }),
  addTextSource: (id, { title, text, originUrl }) =>
    request(`/research/${enc(id)}/sources`, { method: 'POST', body: { type: 'text', title, text, originUrl } }),
  getSource: (id, sourceId, signal) => request(`/research/${enc(id)}/sources/${enc(sourceId)}`, { signal }),
  retrySource: (id, sourceId) => request(`/research/${enc(id)}/sources/${enc(sourceId)}/retry`, { method: 'POST', body: {} }),
  removeSource: (id, sourceId) => request(`/research/${enc(id)}/sources/${enc(sourceId)}`, { method: 'DELETE' }),

  analyze: (id) => request(`/research/${enc(id)}/analyze`, { method: 'POST', body: {} }),

  setChecklistDone: (id, itemId, done) =>
    request(`/research/${enc(id)}/checklist/${enc(itemId)}`, { method: 'PATCH', body: { done } }),
  addChecklistItem: (id, { text, priority }) =>
    request(`/research/${enc(id)}/checklist`, { method: 'POST', body: { text, priority } }),
  deleteChecklistItem: (id, itemId) => request(`/research/${enc(id)}/checklist/${enc(itemId)}`, { method: 'DELETE' }),
};
