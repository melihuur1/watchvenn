// Every limit and timing in one place, so the rules, the UI and the tests agree.

export const LIMITS = {
  minCandidates: 2,
  maxCandidates: 12,
  maxParticipants: 12,
  maxRooms: 500,
  nameMaxLength: 20,
  customTitleMaxLength: 60,
  /** Socket.IO `maxHttpBufferSize`: the largest message a client may send. */
  maxMessageBytes: 16 * 1024,
  /** Per connection, so one script can't fill the server's room cap in a loop. */
  maxRoomCreatesPerMinute: 5,
} as const;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const TIMINGS = {
  /** A host offline this long hands the role to the earliest-joined connected participant. */
  hostGraceMs: 30 * SECOND,
  /** In the lobby, a participant offline this long is removed. */
  lobbyGraceMs: 60 * SECOND,
  /** A room with nobody connected for this long is deleted. */
  roomIdleMs: 15 * MINUTE,
  /** A room older than this is deleted regardless of activity. */
  roomMaxAgeMs: 6 * HOUR,
  /** How often the server runs `sweep()`. */
  sweepIntervalMs: 10 * SECOND,
  /**
   * Socket.IO heartbeat. A client whose network silently vanished (no TCP close) is noticed
   * within interval + timeout, instead of the library default of up to 45 s.
   */
  heartbeatIntervalMs: 10 * SECOND,
  heartbeatTimeoutMs: 10 * SECOND,
} as const;

/** No 0/O, 1/I/L: codes are easy to read aloud and type. 31^6 ≈ 887 million codes. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

/** Stage 2 of the Venn: points per vote. A veto never scores; it eliminates. */
export const VOTE_POINTS = { yes: 2, neutral: 1, veto: 0 } as const;
