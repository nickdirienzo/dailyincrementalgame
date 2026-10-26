-- One row per player per game: whether they played, whether they finished, and for how long.
-- pid is a random id made in the player's browser (localStorage di:pid), nothing more.
CREATE TABLE plays (
  pid TEXT NOT NULL,
  n INTEGER NOT NULL,             -- the game's number in games.json
  first_at TEXT NOT NULL,         -- UTC, first report (their first tap or key in the game)
  last_at TEXT NOT NULL,          -- UTC, latest report
  sessions INTEGER NOT NULL,      -- page loads they played in
  active_s INTEGER NOT NULL,      -- seconds with the tab visible and input in the last minute
  visible_s INTEGER NOT NULL,     -- seconds with the tab visible, idling included
  finished_at TEXT,               -- UTC, when DailyGame.finish() ran; null if not (yet) finished
  finish_active_s INTEGER,        -- active_s at the ending
  finish_visible_s INTEGER,       -- visible_s at the ending
  finish_sessions INTEGER,        -- sittings it took
  country TEXT,
  PRIMARY KEY (pid, n)
);
