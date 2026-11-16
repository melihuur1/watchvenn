// Everything the browser remembers, in localStorage: the last name typed, the secret token
// per room (so a refresh or reopened link rejoins the same identity) and ballot drafts.
// Storage can be unavailable (private modes, quotas), so every access is best-effort.
import { TIMINGS } from '@shared/constants';
import type { Vote } from '@shared/types';

const NAME_KEY = 'watchvenn:name';
const SESSIONS_KEY = 'watchvenn:sessions';
const draftKey = (code: string) => `watchvenn:draft:${code}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not fatal: the app still works, it just won't survive a refresh.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ── Name ────────────────────────────────────────────────────────────────────

export function getLastName(): string {
  const name = read<unknown>(NAME_KEY);
  return typeof name === 'string' ? name : '';
}

export function rememberName(name: string): void {
  write(NAME_KEY, name);
}

// ── Room sessions ───────────────────────────────────────────────────────────

export interface StoredSession {
  token: string;
  participantId: string;
}

export interface SessionStore {
  get(code: string): StoredSession | null;
  save(code: string, session: StoredSession): void;
  forget(code: string): void;
}

type SessionMap = Record<string, StoredSession & { savedAt: number }>;

function readSessions(): SessionMap {
  const sessions = read<SessionMap>(SESSIONS_KEY);
  return sessions && typeof sessions === 'object' ? sessions : {};
}

export const sessionStore: SessionStore = {
  get(code) {
    const entry = readSessions()[code];
    return entry && typeof entry.token === 'string' ? { token: entry.token, participantId: entry.participantId } : null;
  },
  save(code, session) {
    const now = Date.now();
    // Rooms never outlive their max age, so older sessions are dead weight.
    const kept = Object.entries(readSessions()).filter(([, s]) => now - s.savedAt < TIMINGS.roomMaxAgeMs);
    write(SESSIONS_KEY, { ...Object.fromEntries(kept), [code]: { ...session, savedAt: now } });
  },
  forget(code) {
    const { [code]: _forgotten, ...rest } = readSessions();
    write(SESSIONS_KEY, rest);
    clearDraft(code);
  },
};

// ── Ballot drafts ───────────────────────────────────────────────────────────

/** An unsubmitted ballot, kept per room and round so a refresh mid-vote loses nothing. */
export interface Draft {
  votes: Record<string, Vote>;
  /** The card being voted on; equal to the number of candidates on the review screen. */
  position: number;
}

export function loadDraft(code: string, round: number): Draft | null {
  const saved = read<Draft & { round: number }>(draftKey(code));
  if (!saved || saved.round !== round || typeof saved.votes !== 'object') return null;
  return { votes: saved.votes, position: Number.isInteger(saved.position) ? saved.position : 0 };
}

export function saveDraft(code: string, round: number, draft: Draft): void {
  write(draftKey(code), { ...draft, round });
}

export function clearDraft(code: string): void {
  remove(draftKey(code));
}
