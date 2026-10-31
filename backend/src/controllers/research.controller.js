import { config } from '../config/index.js';
import { newId, newSessionId, isSessionId } from '../utils/ids.js';
import { badRequest, conflict, notFound, HttpError } from '../utils/httpError.js';
import { getSession, saveSession, deleteSession } from '../services/store.service.js';
import { retrieveUrlSource, buildTextSource, publicSource } from '../services/source.service.js';
import { analyzeSession } from '../services/analysis/index.js';
import { buildDemoSources, DEMO_QUESTION } from '../services/demo.service.js';
import { domainOf } from '../utils/url.js';
import { stableKey } from '../utils/ids.js';
import {
  validateCreateSession,
  validateUpdateSession,
  validateAddSource,
  validateChecklistPatch,
  validateChecklistCreate,
} from '../validators/research.validators.js';

const busy = new Set();

function loadSession(id) {
  if (!isSessionId(id)) throw notFound('Research session not found.');
  const session = getSession(id);
  if (!session) throw notFound('Research session not found. It may have been deleted or expired.');
  return session;
}

function withLock(id) {
  if (busy.has(id)) throw conflict('This session is busy with another operation. Wait for it to finish and try again.');
  busy.add(id);
  return () => busy.delete(id);
}

export function publicSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    question: session.question,
    profile: session.profile,
    demo: Boolean(session.demo),
    sources: session.sources.map((s) => publicSource(s)),
    analysis: session.analysis,
    analysisStale: Boolean(session.analysisStale),
    checklist: session.checklist,
    limits: { maxSources: config.limits.maxSourcesPerSession },
  };
}

function newSession({ question, profile, demo = false }) {
  const now = new Date().toISOString();
  return { id: newSessionId(), createdAt: now, updatedAt: now, question, profile, demo, sources: [], analysis: null, analysisStale: false, checklist: [] };
}

export async function createSession(req, res) {
  const { question, profile, isBot } = validateCreateSession(req.body);
  if (isBot) throw badRequest('The session could not be created.');
  const session = await saveSession(newSession({ question, profile }));
  res.status(201).json({ session: publicSession(session) });
}

export async function createDemoSession(req, res) {
  const session = newSession({ question: DEMO_QUESTION, profile: 'scholarship', demo: true });
  session.sources = buildDemoSources().map((sample) => {
    const source = { id: newId('src'), kind: 'sample', url: null, sampleLabel: sample.label, addedAt: new Date().toISOString() };
    buildTextSource(source, { title: sample.title, text: sample.text });
    source.published = sample.published;
    source.modified = sample.modified;
    source.domain = 'Simulated sample';
    return source;
  });
  await saveSession(session);
  res.status(201).json({ session: publicSession(session) });
}

export async function getSessionHandler(req, res) {
  res.json({ session: publicSession(loadSession(req.params.id)) });
}

export async function updateSession(req, res) {
  const session = loadSession(req.params.id);
  const updates = validateUpdateSession(req.body);
  if (session.demo && updates.question) throw badRequest('The question of a sample session cannot be changed. Start a new session instead.');
  Object.assign(session, updates);
  if (session.analysis) session.analysisStale = true;
  await saveSession(session);
  res.json({ session: publicSession(session) });
}

export async function deleteSessionHandler(req, res) {
  loadSession(req.params.id);
  await deleteSession(req.params.id);
  res.status(204).end();
}

export async function addSource(req, res) {
  const session = loadSession(req.params.id);
  if (session.demo) throw badRequest('Sources cannot be added to the sample session. Start your own session to analyse real pages.');
  const input = validateAddSource(req.body);
  if (session.sources.length >= config.limits.maxSourcesPerSession) {
    throw badRequest(`A session can hold up to ${config.limits.maxSourcesPerSession} sources. Remove one to add another.`);
  }
  if (input.type === 'url' && session.sources.some((s) => s.url === input.url || s.finalUrl === input.url)) {
    throw new HttpError(409, 'This URL is already in the session.', { code: 'duplicate_source', fields: { url: 'Already added.' } });
  }

  const release = withLock(session.id);
  try {
    const source = { id: newId('src'), kind: input.type, addedAt: new Date().toISOString() };
    if (input.type === 'url') {
      source.url = input.url;
      source.domain = domainOf(input.url);
      await retrieveUrlSource(source);
      if (source.finalUrl && source.finalUrl !== source.url && session.sources.some((s) => s.finalUrl === source.finalUrl)) {
        throw new HttpError(409, 'This URL redirects to a page that is already in the session.', { code: 'duplicate_source', fields: { url: 'Already added.' } });
      }
    } else {
      source.url = input.originUrl;
      buildTextSource(source, input);
      if (input.originUrl) source.domain = domainOf(input.originUrl);
    }
    session.sources.push(source);
    if (session.analysis) session.analysisStale = true;
    await saveSession(session);
    res.status(201).json({ source: publicSource(source), session: publicSession(session) });
  } finally {
    release();
  }
}

export async function retrySource(req, res) {
  const session = loadSession(req.params.id);
  const source = session.sources.find((s) => s.id === req.params.sourceId);
  if (!source) throw notFound('Source not found.');
  if (source.kind !== 'url') throw badRequest('Only web page sources can be retried.');
  const release = withLock(session.id);
  try {
    await retrieveUrlSource(source);
    if (session.analysis) session.analysisStale = true;
    await saveSession(session);
    res.json({ source: publicSource(source), session: publicSession(session) });
  } finally {
    release();
  }
}

export async function getSource(req, res) {
  const session = loadSession(req.params.id);
  const source = session.sources.find((s) => s.id === req.params.sourceId);
  if (!source) throw notFound('Source not found.');
  res.json({ source: publicSource(source, { includeText: true }) });
}

export async function removeSource(req, res) {
  const session = loadSession(req.params.id);
  if (session.demo) throw badRequest('Sample sources cannot be removed. Start your own session instead.');
  const before = session.sources.length;
  session.sources = session.sources.filter((s) => s.id !== req.params.sourceId);
  if (session.sources.length === before) throw notFound('Source not found.');
  if (session.analysis) session.analysisStale = true;
  await saveSession(session);
  res.json({ session: publicSession(session) });
}

export async function analyze(req, res) {
  const session = loadSession(req.params.id);
  const retrieved = session.sources.filter((s) => s.status === 'retrieved');
  if (!retrieved.length) {
    throw badRequest('Add at least one source that was retrieved successfully before running the analysis.');
  }
  const release = withLock(session.id);
  try {
    const { analysis, checklist, sourceDates } = await analyzeSession(session);
    session.analysis = analysis;
    session.checklist = checklist;
    session.analysisStale = false;
    for (const source of session.sources) {
      source.dateInfo = sourceDates[source.id] || null;
      if (source.status === 'retrieved') source.analyzedAt = analysis.runAt;
    }
    await saveSession(session);
    res.json({ session: publicSession(session) });
  } finally {
    release();
  }
}

export async function getFindings(req, res) {
  const session = loadSession(req.params.id);
  if (!session.analysis) throw notFound('This session has not been analysed yet.');
  res.json({ analysis: session.analysis, stale: Boolean(session.analysisStale) });
}

export async function getChecklist(req, res) {
  res.json({ checklist: loadSession(req.params.id).checklist });
}

export async function patchChecklistItem(req, res) {
  const session = loadSession(req.params.id);
  const { done } = validateChecklistPatch(req.body);
  const item = session.checklist.find((i) => i.id === req.params.itemId);
  if (!item) throw notFound('Checklist item not found.');
  item.done = done;
  item.doneAt = done ? new Date().toISOString() : null;
  await saveSession(session);
  res.json({ item, checklist: session.checklist });
}

export async function addChecklistItem(req, res) {
  const session = loadSession(req.params.id);
  const { text, priority } = validateChecklistCreate(req.body);
  if (session.checklist.filter((i) => i.origin === 'user').length >= 50) throw badRequest('You can add up to 50 of your own checklist items.');
  const key = stableKey('user', Date.now(), text);
  const item = {
    id: `chk_${key}`, key, origin: 'user', text, priority, rationale: 'Added by you.',
    relatedType: null, relatedId: null, sourceIds: [], done: false, doneAt: null,
  };
  session.checklist.push(item);
  await saveSession(session);
  res.status(201).json({ item, checklist: session.checklist });
}

export async function deleteChecklistItem(req, res) {
  const session = loadSession(req.params.id);
  const item = session.checklist.find((i) => i.id === req.params.itemId);
  if (!item) throw notFound('Checklist item not found.');
  if (item.origin !== 'user') throw badRequest('Only items you added can be deleted. Mark analysis items as done instead.');
  session.checklist = session.checklist.filter((i) => i.id !== item.id);
  await saveSession(session);
  res.json({ checklist: session.checklist });
}
