// Domain types shared by the client and the server. Nothing here is secret:
// tokens and individual ballots only exist in the server's own `Room` model.

export type Phase = 'lobby' | 'voting' | 'results';

export type Vote = 'yes' | 'neutral' | 'veto';
export const VOTES: readonly Vote[] = ['yes', 'neutral', 'veto'];

/** One participant's votes, keyed by movie id. A valid ballot covers exactly the candidate set. */
export type Ballot = Record<string, Vote>;

export type Genre =
  | 'action'
  | 'adventure'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'drama'
  | 'family'
  | 'fantasy'
  | 'horror'
  | 'music'
  | 'mystery'
  | 'romance'
  | 'scifi'
  | 'thriller'
  | 'war';

/** A two-stop CSS gradient for the designed movie card: `[from, to]` as hex colors. */
export type Palette = readonly [from: string, to: string];

export interface CatalogMovie {
  kind: 'catalog';
  id: string;
  /** Title as released in Türkiye. */
  title: string;
  /** Original title, or the international one when the original isn't in Latin script. */
  originalTitle: string;
  year: number;
  /** Minutes. Left out where the figure couldn't be verified: no guesses presented as facts. */
  runtime?: number;
  genres: readonly Genre[];
  /** One spoiler-free sentence in Turkish. */
  description: string;
  palette: Palette;
}

export interface CustomMovie {
  kind: 'custom';
  id: string;
  title: string;
  /** Chosen deterministically from the title, see `paletteForTitle`. */
  palette: Palette;
}

export type Movie = CatalogMovie | CustomMovie;

export interface PublicParticipant {
  id: string;
  name: string;
  /** At least one socket is attached to this identity right now. */
  connected: boolean;
  /** Part of the voter list locked at voting start. Always false in the lobby. */
  isVoter: boolean;
  hasVoted: boolean;
}

/** A locked voter who left the room during voting. They still count in the voter total. */
export interface DepartedVoter {
  id: string;
  name: string;
  hasVoted: boolean;
}

/** The full room snapshot broadcast after every accepted change. */
export interface PublicRoom {
  code: string;
  phase: Phase;
  round: number;
  hostId: string;
  /** In join order. */
  participants: PublicParticipant[];
  departedVoters: DepartedVoter[];
  /** In the order they were added. */
  candidates: Movie[];
  results: Results | null;
}

export interface Turnout {
  /** N: voters locked at voting start. */
  voterCount: number;
  /** V: ballots actually submitted. Every count and percentage is out of V. */
  ballotCount: number;
  /** N − V. */
  excludedCount: number;
}

export interface MovieResult {
  movie: Movie;
  yes: number;
  neutral: number;
  veto: number;
  /** yes × 2 + neutral × 1. */
  points: number;
  /** round(100 × points / 2V). */
  compatibility: number;
  /** At least one veto. */
  eliminated: boolean;
  /** 1-based competition rank among eligible movies (ties share it), null when eliminated. */
  rank: number | null;
  /** Shares its rank with another eligible movie. */
  tied: boolean;
}

export interface Results extends Turnout {
  status: 'match' | 'no-match';
  /** Up to three eligible movies, best first. Empty on a no-match. */
  top: MovieResult[];
  /** Every candidate: eligible movies in rank order, then eliminated ones (fewest vetoes first). */
  breakdown: MovieResult[];
}
