-- Keypals saves. Kept as little as the game needs: no emails or names from children.
-- players: one per save code; data is the game's own profile (nickname, buddy, progress, settings)
CREATE TABLE IF NOT EXISTS players (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL,
  created INTEGER NOT NULL,
  opened INTEGER NOT NULL,
  account TEXT
);
CREATE INDEX IF NOT EXISTS players_account ON players(account);
-- accounts: grown-ups who signed in with Google or Microsoft (adults only)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  sub TEXT NOT NULL,
  email TEXT,
  name TEXT,
  created INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  UNIQUE(provider, sub)
);
-- sessions: only a hash of the cookie is stored
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  expires INTEGER NOT NULL
);
-- sign-in in progress (PKCE), for a few minutes
CREATE TABLE IF NOT EXISTS sign_ins (
  state TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  provider TEXT NOT NULL,
  created INTEGER NOT NULL
);
-- simple rate limits by a hash of the address (the address itself isn't kept)
CREATE TABLE IF NOT EXISTS limits (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  reset INTEGER NOT NULL
);
-- players a grown-up deleted everywhere: only the code, whose account it was in, and when (no player data),
-- so a computer that was offline removes its copy too and an old copy can never bring the player back.
-- Kept 3 years.
CREATE TABLE IF NOT EXISTS gone (
  code TEXT PRIMARY KEY,
  account TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gone_account ON gone(account);
-- Ideas and help (worker.js). ideas: suggested by grown-ups; shown on the Ideas board only once an admin
-- approves them. email: only if the grown-up asked for a reply (never shown; cleared after 180 days).
-- status: new (waiting), shown, planned, done, hidden, merged (into merged_into, which took its votes).
-- votes: the count only (who voted is remembered on each computer, not here).
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL,
  merged_into INTEGER,
  votes INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ideas_status ON ideas(status);
-- problems: told by a grown-up (kind "told"), or sent by the game when something breaks (kind "auto": the
-- message, a trimmed stack, screen, game version, browser and screen size; never player data). The same
-- error again (same sig) only adds to times. Deleted when not seen for 180 days.
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  email TEXT,
  sig TEXT,
  stack TEXT,
  screen TEXT,
  version TEXT,
  browser TEXT,
  size TEXT,
  times INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created INTEGER NOT NULL,
  lastseen INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS problems_sig ON problems(sig);
-- visit counts (worker.js "counting visits"): daily totals only, no identifiers. A row is one day's count
-- of one thing: event (open, player_day, screen, game, ...) and key (phone, hub, math-trip, US, ...).
-- day is the playing computer's date. Kept two years.
CREATE TABLE IF NOT EXISTS counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (day, event, key)
);
