// Who played each game, who finished, and how long it took, from the play stats D1 database.
//
//   npm run stats             a table per game
//   npm run stats -- --json   the same per game with every games.json field (theme roll, length...)
//
// Reads with `wrangler d1 execute --remote`, so wrangler must be logged in to the personal
// Cloudflare account that hosts the site (not a work login). Times are active minutes: tab visible
// with input in the last minute, the closest thing to "time spent playing" for an idle game.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = 'dailyincrementalgame-stats';
const json = process.argv.includes('--json');

const sql = `SELECT n, sessions, active_s, finished_at IS NOT NULL AS finished, finish_active_s, finish_sessions FROM plays`;
const out = execFileSync('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const rows = JSON.parse(out)[0].results;

const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'games.json'), 'utf8'));
const median = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mins = s => (s == null ? null : Math.round(s / 6) / 10);

const summary = games.map(g => {
  const mine = rows.filter(r => r.n === g.n);
  const done = mine.filter(r => r.finished);
  const quit = mine.filter(r => !r.finished);
  return {
    ...g,
    players: mine.length,
    finished: done.length,
    finishRate: mine.length ? Math.round((done.length / mine.length) * 100) / 100 : null,
    minutesToFinish: mins(median(done.map(r => r.finish_active_s))),
    sittingsToFinish: median(done.map(r => r.finish_sessions)),
    minutesBeforeQuitting: mins(median(quit.map(r => r.active_s))),
  };
}).filter(g => g.players);

if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else if (!summary.length) {
  console.log('No plays recorded yet.');
} else {
  console.table(Object.fromEntries(summary.map(g => [g.title, {
    planned: g.minutes, players: g.players, finished: g.finished,
    'finish %': Math.round(g.finishRate * 100),
    'min to finish': g.minutesToFinish ?? '', sittings: g.sittingsToFinish ?? '',
    'min before quitting': g.minutesBeforeQuitting ?? '',
  }])));
  console.log('Minutes are median active minutes. "planned" is the rolled length from games.json.');
}
