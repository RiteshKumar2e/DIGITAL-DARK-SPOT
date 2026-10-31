import { config } from '../config/index.js';
import { newId, newSessionId, isSessionId } from '../utils/ids.js';
import { badRequest, conflict, notFound, HttpError } from '../utils/httpError.js';
import { getSession, saveSession, deleteSession } from '../services/store.service.js';
import { retrieveUrlSource, buildTextSource, buildPdfSource, publicSource, contentHash } from '../services/source.service.js';
import { PdfError } from '../services/pdf.service.js';
import { webSearch } from '../services/search.service.js';
import { buildReport } from '../services/report.service.js';
import { analyzeSession } from '../services/analysis/index.js';
import { buildDemoSources, DEMO_QUESTION, DEMO_CONTEXT } from '../services/demo.service.js';
import { domainOf } from '../utils/url.js';
import { stableKey } from '../utils/ids.js';
import {
  validateCreateSession,
  validateUpdateSession,
  validateAddSource,
  validateChecklistPatch,
  validateChecklistCreate,
  validatePdfUpload,
  validateSearch,
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
    context: session.context || {},
    demo: Boolean(session.demo),
    sources: session.sources.map((s) => publicSource(s)),
    analysis: session.analysis,
    analysisStale: Boolean(session.analysisStale),
    checklist: session.checklist,
    limits: { maxSources: config.limits.maxSourcesPerSession },
  };
}

/** Two sources with identical extracted text add nothing to a comparison. */
function rejectDuplicateContent(session, source) {
  if (source.status !== 'retrieved') return;
  source.contentHash = contentHash(source.text);
  const twin = session.sources.findIndex((s) => s.id !== source.id && s.contentHash && s.contentHash === source.contentHash);
  if (twin !== -1) {
    throw new HttpError(409, `This content is identical to source S${twin + 1}, which is already in the session.`, { code: 'duplicate_source' });
  }
}

function newSession({ question, profile, context = {}, demo = false }) {
  const now = new Date().toISOString();
  return { id: newSessionId(), createdAt: now, updatedAt: now, question, profile, context, demo, sources: [], analysis: null, analysisStale: false, checklist: [] };
}

export async function createSession(req, res) {
  const { question, profile, context, isBot } = validateCreateSession(req.body);
  if (isBot) throw badRequest('The session could not be created.');
  const session = await saveSession(newSession({ question, profile, context }));
  res.status(201).json({ session: publicSession(session) });
}

export async function createDemoSession(req, res) {
  const session = newSession({ question: DEMO_QUESTION, profile: 'scholarship', demo: true, context: DEMO_CONTEXT });
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
  if (busy.has(session.id)) throw conflict('This session is busy with another operation. Wait for it to finish and try again.');
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
    rejectDuplicateContent(session, source);
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
    const before = { ...source };
    await retrieveUrlSource(source);
    source.contentHash = null;
    try {
      // A retried page that now matches another source (or redirects to one) is not kept twice.
      if (source.finalUrl && session.sources.some((s) => s.id !== source.id && (s.finalUrl === source.finalUrl || s.url === source.finalUrl))) {
        throw new HttpError(409, 'This page now resolves to a source that is already in the session.', { code: 'duplicate_source' });
      }
      rejectDuplicateContent(session, source);
    } catch (error) {
      Object.keys(source).forEach((key) => delete source[key]);
      Object.assign(source, before);
      throw error;
    }
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
  const release = withLock(session.id);
  try {
    if (session.demo) throw badRequest('Sample sources cannot be removed. Start your own session instead.');
    const before = session.sources.length;
    session.sources = session.sources.filter((s) => s.id !== req.params.sourceId);
    if (session.sources.length === before) throw notFound('Source not found.');
    if (session.analysis) session.analysisStale = true;
    await saveSession(session);
    res.json({ session: publicSession(session) });
  } finally {
    release();
  }
}

export async function analyze(req, res) {
  const session = loadSession(req.params.id);
  const retrieved = session.sources.filter((s) => s.status === 'retrieved');
  if (!retrieved.length) {
    throw badRequest('Add at least one source that was retrieved successfully before running the analysis.');
  }
  const release = withLock(session.id);
  try {
    const { analysis, checklist: built, sourceDates } = await analyzeSession(session);
    // Checklist changes made while the analysis was running (ticks, own items) are kept.
    const current = new Map(session.checklist.map((item) => [item.key, item]));
    const checklist = built.map((item) => (current.has(item.key) ? { ...item, done: current.get(item.key).done, doneAt: current.get(item.key).doneAt } : item));
    const builtKeys = new Set(checklist.map((item) => item.key));
    for (const item of session.checklist) if (item.origin === 'user' && !builtKeys.has(item.key)) checklist.push(item);
    analysis.sourceSnapshot = Object.fromEntries(
      session.sources.map((s) => [s.id, { contentHash: s.contentHash || contentHash(s.text || ''), retrievedAt: s.retrievedAt || null, status: s.status }]),
    );
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

export async function uploadPdf(req, res) {
  const session = loadSession(req.params.id);
  if (session.demo) throw badRequest('Files cannot be added to the sample session. Start your own session instead.');
  if (session.sources.length >= config.limits.maxSourcesPerSession) {
    throw badRequest(`A session can hold up to ${config.limits.maxSourcesPerSession} sources. Remove one to add another.`);
  }
  const { fileName, buffer } = validatePdfUpload(req);
  const release = withLock(session.id);
  try {
    const source = { id: newId('src'), kind: 'pdf', url: null, addedAt: new Date().toISOString(), fileSize: buffer.length };
    try {
      await buildPdfSource(source, { buffer, fileName });
    } catch (error) {
      if (error instanceof PdfError) throw badRequest(error.message, { file: error.message });
      throw error;
    }
    rejectDuplicateContent(session, source);
    session.sources.push(source);
    if (session.analysis) session.analysisStale = true;
    await saveSession(session);
    res.status(201).json({ source: publicSource(source), session: publicSession(session) });
  } finally {
    release();
  }
}

export async function search(req, res) {
  const session = loadSession(req.params.id);
  if (session.demo) throw badRequest('Search is not available in the sample session.');
  const { query } = validateSearch(req.body);
  const result = await webSearch(query);
  const known = new Set(session.sources.flatMap((s) => [s.url, s.finalUrl]).filter(Boolean));
  res.json({ ...result, results: result.results.map((r) => ({ ...r, alreadyAdded: known.has(r.url) })) });
}

export async function exportReport(req, res) {
  const session = loadSession(req.params.id);
  if (!session.analysis) throw badRequest('Run the analysis before exporting a report.');
  const format = req.query.format === 'html' ? 'html' : 'markdown';
  const report = buildReport(session, format);
  const fileName = `digital-dark-spot-report-${session.createdAt.slice(0, 10)}`;
  if (format === 'html') {
    // Standalone printable document: only its own inline styles are allowed.
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.type('html').send(report);
  } else {
    res.set('Content-Disposition', `attachment; filename="${fileName}.md"`);
    res.type('text/markdown; charset=utf-8').send(report);
  }
}
