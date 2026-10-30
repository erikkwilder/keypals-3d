-- Keypals for teachers: classes, students, assignments and the boards (deploy/site/classes.js). Applied
-- after schema.sql. About a child we keep only the first name or nickname the teacher typed, the picture
-- password (so the teacher can print it), the game progress (an ordinary player, in players) and this
-- week's effort for the boards. No emails, last names or birthdays.

-- teachers: grown-ups (signed in, in accounts) who said "I'm a teacher": the name kids see, and when they
-- agreed to the note (using Keypals with the school's permission, for learning only)
CREATE TABLE IF NOT EXISTS teachers (
  account TEXT PRIMARY KEY,
  display TEXT NOT NULL,
  agreed INTEGER NOT NULL,
  created INTEGER NOT NULL
);
-- classes: a teacher's class, its code (two words and a number) and its settings
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  teacher TEXT NOT NULL,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  board INTEGER NOT NULL DEFAULT 1,
  goal INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS classes_teacher ON classes(teacher);
-- students: the name the teacher typed, the player (a save code in players), the picture password (two
-- picture numbers in order), whether the player came from home (a family's player linked to the class),
-- and active or waiting for the teacher to say yes (claims: the classmate a family says it is)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  class TEXT NOT NULL,
  name TEXT NOT NULL,
  player TEXT NOT NULL,
  pics TEXT NOT NULL,
  home INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  claims TEXT,
  buddy TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS students_class ON students(class);
CREATE INDEX IF NOT EXISTS students_player ON students(player);
-- assignments: what, the goal, the due date, who, how it's scored (the game's own JSON: src/lib/teach/assignments.ts)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  class TEXT NOT NULL,
  data TEXT NOT NULL,
  created INTEGER NOT NULL,
  due INTEGER,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS assignments_class ON assignments(class);
-- one week's effort for a player, sent by the game: right answers (correct), minutes (ms) and stars, with the
-- player's nickname and buddy for the family board (id: player code and week)
CREATE TABLE IF NOT EXISTS player_week (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  week TEXT NOT NULL,
  correct INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  name TEXT,
  buddy TEXT,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS player_week_week ON player_week(week, player);
-- class against class: a challenge for one week, by its code; the classes in it
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  week TEXT NOT NULL,
  created INTEGER NOT NULL,
  owner TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS challenge_classes (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  class TEXT NOT NULL,
  joined INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS challenge_classes_class ON challenge_classes(class);
CREATE INDEX IF NOT EXISTS challenge_classes_challenge ON challenge_classes(challenge);
-- world boards for the Arcade's daily challenge: a made-up name (adjective and animal), the buddy, the
-- best score of the day; `who` is a hash of a random number the game keeps (never a save code)
CREATE TABLE IF NOT EXISTS world_scores (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  day TEXT NOT NULL,
  who TEXT NOT NULL,
  alias TEXT NOT NULL,
  buddy TEXT NOT NULL,
  score INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS world_scores_day ON world_scores(game, day, score);
