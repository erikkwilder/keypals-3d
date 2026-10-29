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
