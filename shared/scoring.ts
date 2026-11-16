// "The Venn": stage 1 keeps the movies nobody vetoed (the overlap), stage 2 ranks them
// by enthusiasm. Pure functions only; the server computes results once and freezes them.
import { VOTE_POINTS } from './constants.js';
import type { Ballot, Movie, MovieResult, Results, Turnout, Vote } from './types.js';

export const VOTE_LABELS: Record<Vote, string> = {
  yes: 'Evet',
  neutral: 'Fark etmez',
  veto: 'Veto',
};

/** The whole algorithm in one sentence, for the results screen and the README. */
export const ALGORITHM_SUMMARY = 'Kimsenin veto etmediği filmler arasında en çok Evet alan kazanır.';

const TOP_COUNT = 3;

/**
 * @param candidates in list order; this order breaks ties.
 * @param ballots the submitted ballots (V ≥ 1). Each must cover every candidate.
 * @param voterCount N, the voters locked at voting start (N ≥ V).
 */
export function computeResults(candidates: readonly Movie[], ballots: readonly Ballot[], voterCount: number): Results {
  const ballotCount = ballots.length;
  if (ballotCount === 0) throw new RangeError('computeResults needs at least one ballot');
  if (voterCount < ballotCount) throw new RangeError('voterCount cannot be smaller than the number of ballots');

  const tallies = candidates.map((movie) => tally(movie, ballots));

  // Array#sort is stable, so equal points keep candidate-list order.
  const eligible = tallies.filter((t) => !t.eliminated).sort((a, b) => b.points - a.points);
  const ranked = eligible.map((t) => ({
    ...t,
    rank: 1 + eligible.filter((other) => other.points > t.points).length,
    tied: eligible.some((other) => other !== t && other.points === t.points),
  }));
  const eliminated = tallies
    .filter((t) => t.eliminated)
    .sort((a, b) => a.veto - b.veto || b.points - a.points);

  return {
    status: ranked.length > 0 ? 'match' : 'no-match',
    top: ranked.slice(0, TOP_COUNT),
    breakdown: [...ranked, ...eliminated],
    voterCount,
    ballotCount,
    excludedCount: voterCount - ballotCount,
  };
}

function tally(movie: Movie, ballots: readonly Ballot[]): MovieResult {
  const counts: Record<Vote, number> = { yes: 0, neutral: 0, veto: 0 };
  for (const ballot of ballots) {
    const vote = ballot[movie.id];
    if (vote === undefined || !Object.hasOwn(counts, vote)) {
      throw new Error(`A ballot has no valid vote for movie "${movie.id}"`);
    }
    counts[vote] += 1;
  }
  const points = counts.yes * VOTE_POINTS.yes + counts.neutral * VOTE_POINTS.neutral;
  return {
    movie,
    ...counts,
    points,
    compatibility: roundedPercent(points, VOTE_POINTS.yes * ballots.length),
    eliminated: counts.veto > 0,
    rank: null,
    tied: false,
  };
}

/** round(100 × part / whole), half up, in integer arithmetic so 87.5 is always 88. */
function roundedPercent(part: number, whole: number): number {
  return Math.floor((200 * part + whole) / (2 * whole));
}

// ── Turkish copy ────────────────────────────────────────────────────────────

// The 3rd-person possessive suffix follows the last spoken word of the number:
// bir'i, iki'si, üç'ü, dört'ü, beş'i, altı'sı, yedi'si, sekiz'i, dokuz'u …
const UNIT_SUFFIXES = ['', "'i", "'si", "'ü", "'ü", "'i", "'sı", "'si", "'i", "'u"];
// … on'u, yirmi'si, otuz'u, kırk'ı, elli'si, altmış'ı, yetmiş'i, seksen'i, doksan'ı.
const TEN_SUFFIXES = ['', "'u", "'si", "'u", "'ı", "'si", "'ı", "'i", "'i", "'ı"];

/** "4" → "4'ü", "2" → "2'si", "10" → "10'u": the count as in "5 kişiden 4'ü". */
export function possessive(n: number): string {
  let suffix: string;
  if (n === 0) suffix = "'ı"; // sıfır
  else if (n % 10 !== 0) suffix = UNIT_SUFFIXES[n % 10]!;
  else if (n % 100 !== 0) suffix = TEN_SUFFIXES[(n / 10) % 10]!;
  else if (n % 1000 !== 0) suffix = "'ü"; // yüz
  else suffix = "'i"; // bin
  return `${n}${suffix}`;
}

/** After an early end the wording is about the people who voted, never the whole group. */
function isFullTurnout(turnout: Turnout): boolean {
  return turnout.excludedCount === 0;
}

export function compatibilityLabel(result: MovieResult, turnout: Turnout): string {
  if (result.eliminated) return 'Elendi';
  const everyone = isFullTurnout(turnout);
  if (result.yes === turnout.ballotCount) return everyone ? 'Herkes bayıldı' : 'Oy verenlerin hepsi bayıldı';
  // ≥ 75 %, compared exactly: points / 2V ≥ 3/4.
  if (2 * result.points >= 3 * turnout.ballotCount) return 'Güçlü uyum';
  return everyone ? 'Herkes için uygun' : 'Oy verenler için uygun';
}

/** "5 kişiden 4'ü Evet, 1'i Fark etmez dedi · veto yok", or "2 veto · elendi". */
export function reasonText(result: MovieResult, turnout: Turnout): string {
  if (result.eliminated) return `${result.veto} veto · elendi`;

  const voters = turnout.ballotCount;
  const who = isFullTurnout(turnout) ? '' : 'Oy veren ';
  let said: string;
  if (result.yes === voters || result.neutral === voters) {
    const vote = VOTE_LABELS[result.yes === voters ? 'yes' : 'neutral'];
    said = voters === 1 ? `${who}1 kişi ${vote} dedi` : `${who}${voters} kişinin hepsi ${vote} dedi`;
  } else {
    said = `${who}${voters} kişiden ${possessive(result.yes)} Evet, ${possessive(result.neutral)} Fark etmez dedi`;
  }
  return `${said} · veto yok`;
}

/** "4 kişiden 4'ü oy verdi", or after an early end "5 kişiden 3'ü oy verdi · 2 kişi hesaba katılmadı". */
export function turnoutText(turnout: Turnout): string {
  if (turnout.voterCount === 1) return '1 kişi oy verdi';
  const voted = `${turnout.voterCount} kişiden ${possessive(turnout.ballotCount)} oy verdi`;
  return isFullTurnout(turnout) ? voted : `${voted} · ${turnout.excludedCount} kişi hesaba katılmadı`;
}
