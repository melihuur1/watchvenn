// Payload checks for everything a client can send. Input is `unknown` because it came off
// the wire; output is typed, cleaned and within limits, or null when it isn't acceptable.
// Rules that need the room (is this ballot complete? is this name taken?) live in rooms.ts.
import { LIMITS } from '../shared/constants.js';
import type {
  AddCandidatePayload,
  CreateRoomPayload,
  JoinRoomPayload,
  PeekRoomPayload,
  RemoveCandidatePayload,
  SubmitVotePayload,
} from '../shared/events.js';
import { cleanText, parseRoomCode } from '../shared/text.js';
import { VOTES, type Ballot, type Vote } from '../shared/types.js';

/** Catalog ids are kebab-case, custom ids are "custom-<hex>". No "__proto__" and friends. */
const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
/** Server-issued tokens are 16 random bytes in base64url (22 characters). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Cleaned text whose length, in characters rather than UTF-16 units, is within 1..max. */
function boundedText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const text = cleanText(raw);
  const length = [...text].length;
  return length >= 1 && length <= max ? text : null;
}

export function parseName(raw: unknown): string | null {
  return boundedText(raw, LIMITS.nameMaxLength);
}

export function parseCustomTitle(raw: unknown): string | null {
  return boundedText(raw, LIMITS.customTitleMaxLength);
}

function parseId(raw: unknown): string | null {
  return typeof raw === 'string' && ID_PATTERN.test(raw) ? raw : null;
}

function parseCode(raw: unknown): string | null {
  return typeof raw === 'string' ? parseRoomCode(raw) : null;
}

function isVote(raw: unknown): raw is Vote {
  return VOTES.includes(raw as Vote);
}

export function parseCreateRoom(payload: unknown): CreateRoomPayload | null {
  if (!isRecord(payload)) return null;
  const name = parseName(payload.name);
  return name ? { name } : null;
}

export function parsePeekRoom(payload: unknown): PeekRoomPayload | null {
  if (!isRecord(payload)) return null;
  const code = parseCode(payload.code);
  return code ? { code } : null;
}

/** Exactly one of `token` (rejoin) or `name` (new participant). */
export function parseJoinRoom(payload: unknown): JoinRoomPayload | null {
  if (!isRecord(payload)) return null;
  const code = parseCode(payload.code);
  if (!code) return null;

  if (payload.token !== undefined && payload.name === undefined) {
    return typeof payload.token === 'string' && TOKEN_PATTERN.test(payload.token)
      ? { code, token: payload.token }
      : null;
  }
  if (payload.name !== undefined && payload.token === undefined) {
    const name = parseName(payload.name);
    return name ? { code, name } : null;
  }
  return null;
}

/** Exactly one of `movieId` (catalog) or `customTitle` (free text). */
export function parseAddCandidate(payload: unknown): AddCandidatePayload | null {
  if (!isRecord(payload)) return null;

  if (payload.movieId !== undefined && payload.customTitle === undefined) {
    const movieId = parseId(payload.movieId);
    return movieId ? { movieId } : null;
  }
  if (payload.customTitle !== undefined && payload.movieId === undefined) {
    const customTitle = parseCustomTitle(payload.customTitle);
    return customTitle ? { customTitle } : null;
  }
  return null;
}

export function parseRemoveCandidate(payload: unknown): RemoveCandidatePayload | null {
  if (!isRecord(payload)) return null;
  const movieId = parseId(payload.movieId);
  return movieId ? { movieId } : null;
}

/** Shape only: a positive round and 1..max known ids, each with a known vote. */
export function parseSubmitVote(payload: unknown): SubmitVotePayload | null {
  if (!isRecord(payload)) return null;
  const { round, ballot } = payload;
  if (typeof round !== 'number' || !Number.isSafeInteger(round) || round < 1) return null;
  if (!isRecord(ballot)) return null;

  const entries = Object.entries(ballot);
  if (entries.length === 0 || entries.length > LIMITS.maxCandidates) return null;
  if (!entries.every(([id, vote]) => parseId(id) && isVote(vote))) return null;
  return { round, ballot: Object.fromEntries(entries) as Ballot };
}
