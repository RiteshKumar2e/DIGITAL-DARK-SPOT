import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';

/**
 * Minimal JSON-file persistence for research sessions. Suitable for a single
 * server instance; writes are serialised and atomic (temp file + rename).
 */
const sessions = new Map();
let writeChain = Promise.resolve();
let loaded = false;

export async function loadStore() {
  if (loaded) return;
  try {
    const raw = await fs.readFile(config.dataFile, 'utf8');
    const data = JSON.parse(raw);
    for (const session of data.sessions || []) sessions.set(session.id, session);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Keep the unreadable file for inspection instead of overwriting it on the next save.
      const backup = `${config.dataFile}.corrupt-${Date.now()}`;
      try {
        await fs.rename(config.dataFile, backup);
        console.error(`[store] data file was unreadable; moved to ${path.basename(backup)} and starting empty`);
      } catch {
        console.error('[store] data file was unreadable and could not be moved; starting empty');
      }
    }
  }
  loaded = true;
}

export class StorageError extends Error {}

// Writes are serialised and atomic (temp file + rename), so a failed write
// leaves the previous file intact. The failure is returned to the caller.
function persist() {
  const write = writeChain.then(async () => {
    await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
    const tmp = `${config.dataFile}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ version: 1, sessions: [...sessions.values()] }), 'utf8');
    await fs.rename(tmp, config.dataFile);
  });
  writeChain = write.catch(() => {});
  return write.catch((error) => {
    console.error('[store] write failed:', error.code || error.message);
    throw new StorageError('The change could not be saved on the server. Please try again.');
  });
}

export const getSession = (id) => sessions.get(id) || null;

export async function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  sessions.set(session.id, session);
  await persist();
  return session;
}

export async function deleteSession(id) {
  const existed = sessions.delete(id);
  if (existed) await persist();
  return existed;
}

export async function purgeExpired(days = config.sessionRetentionDays) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, session] of sessions) {
    if (Date.parse(session.updatedAt || session.createdAt) < cutoff) {
      sessions.delete(id);
      removed += 1;
    }
  }
  if (removed) await persist();
  return removed;
}

export const flushStore = () => writeChain;
