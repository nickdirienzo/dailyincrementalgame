// The site's Worker. Everything in public/ is served as static assets without running this script
// (wrangler.jsonc); it only handles /api/*.
//
// POST /api/play: daily.js reports a player's totals for one game (see "Play stats" in daily.js).
// Reports carry running totals, so the row keeps the largest of each and the first ending, and a
// repeated or out-of-order report changes nothing. Rows go to the D1 binding DB (migrations/).
const DAY = 86400;
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

async function play(request, env) {
  let b;
  try { b = await request.json(); } catch (e) { return new Response(null, { status: 400 }); }
  const pid = typeof b.pid === 'string' && /^[0-9a-f-]{36}$/.test(b.pid) ? b.pid : null;
  const n = int(b.n, 100000);
  const sessions = int(b.sessions, 10000);
  const active = int(b.active, 30 * DAY);
  const visible = int(b.visible, 30 * DAY);
  if (!pid || !n || sessions == null || active == null || visible == null) return new Response(null, { status: 400 });
  const finished = b.finished === true;
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO plays (pid, n, first_at, last_at, sessions, active_s, visible_s, finished_at, finish_active_s, finish_visible_s, finish_sessions, country)
    VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ON CONFLICT (pid, n) DO UPDATE SET
      last_at = excluded.last_at,
      sessions = max(sessions, excluded.sessions),
      active_s = max(active_s, excluded.active_s),
      visible_s = max(visible_s, excluded.visible_s),
      finished_at = coalesce(finished_at, excluded.finished_at),
      finish_active_s = coalesce(finish_active_s, excluded.finish_active_s),
      finish_visible_s = coalesce(finish_visible_s, excluded.finish_visible_s),
      finish_sessions = coalesce(finish_sessions, excluded.finish_sessions)
  `).bind(
    pid, n, now, sessions, active, visible,
    finished ? now : null, finished ? active : null, finished ? visible : null, finished ? sessions : null,
    (request.cf && request.cf.country) || null,
  ).run();
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/play') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
      return play(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
