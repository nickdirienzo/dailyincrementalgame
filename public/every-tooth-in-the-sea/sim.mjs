// Pacing sim: node public/every-tooth-in-the-sea/sim.mjs [--sit=30] [--away=180] [--quiet] [--T={...}]
// A reasonable player: stops the pen about every 1.6 s (measured: the fish swap takes ~0.9 s) (hit chance from the grin's width, about a
// quarter of hits on the front tooth), clicks the pen to Lou's colour a few seconds after each
// call, buys the cheapest affordable thing, and lays out deck lines one tile at a time in a sensible
// pattern (one line per row; two per row sharing a porthole once the cabin is open). Plays in sittings.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const DUMP = arg('dump', 0) * 60, SIT = arg('sit', 30) * 60, AWAY = arg('away', 180) * 60, quiet = process.argv.includes('--quiet');
let seed = arg('seed', 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const Targ = process.argv.find(a => a.startsWith('--T='));
if (Targ) Object.assign(E.T, JSON.parse(Targ.slice(4)));

const S = E.newState();
const log = [], gaps = [];
let played = 0, sitT = 0, sittings = 1, lastBuy = 0, stopAcc = 0, inkLag = -1, buys = 0;
const fmtT = t => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(played)}  ${s}`);
const dt = 0.1;

// The tiles the player wants, in build order, for the current deck size.
function plan() {
  const [w, h] = E.GRIDS[S.gridN];
  const want = [];
  const mid = S.pen4 ? 'pen' : 'belt';
  for (let y = 0; y < h; y++) {
    const row = y * w;
    [['shelf', 0], ['chew', 1], ['press', 2], [mid, 3], ['port', 4]].forEach(([k, x]) => want.push({ i: row + x, k, d: 0 }));
    if (w >= 10) [['pen', 5], ['press', 6], ['chew', 7], ['shelf', 8]].forEach(([k, x]) => want.push({ i: row + x, k: k === 'pen' && !S.pen4 ? 'belt' : k, d: 2 }));
  }
  return want;
}
function nextTile() {
  for (const p of plan()) {
    const c = S.grid.c[p.i];
    if (c && c.k === p.k) { c.d = p.d; continue; }
    if (c && c.k !== p.k) { E.remove(S, p.i); }
    return p;
  }
  return null;
}

function spend() {
  for (let guard = 0; guard < 50; guard++) {
    const opts = E.items(S).map(i => ({ kind: 'item', id: i.id, cost: i.cost, name: i.name }));
    if (S.deck) { const p = nextTile(); if (p) opts.push({ kind: 'tile', p, cost: E.toolCost(S, p.k), name: E.TOOLS[p.k].name }); }
    // Hold off on silly one-offs and tiles while a key is close: a person saves for the next door.
    const pick = opts.filter(o => o.cost <= S.doub).sort((a, b) => a.cost - b.cost)[0];
    if (!pick) return;
    const out = [];
    if (pick.kind === 'item') E.buy(S, pick.id, out); else E.place(S, pick.p.i, pick.p.k, pick.p.d);
    buys++;
    gaps.push(played - lastBuy); lastBuy = played;
    const key = E.BY_ID[pick.id]?.kind === 'key';
    if (!quiet || key) mark(`${key ? '*** ' : ''}${pick.kind === 'tile' ? 'tile: ' : ''}${pick.name}${pick.kind === 'item' && E.BY_ID[pick.id]?.max ? ' ' + E.lvl(S, pick.id) : ''} (${E.fmt(pick.cost)})  · left ${E.fmt(E.left(S))}`);
  }
}

let phaseWas = 1;
while (!S.ended && played < 6 * 3600) {
  played += dt; sitT += dt;
  if (DUMP && played >= DUMP) { S.lastSeen = Date.now(); process.stdout.write(JSON.stringify(S)); process.exit(0); }
  for (const ev of E.step(S, dt)) {
    if (ev.type === 'trend') inkLag = 3 + rnd() * 6;
    if (ev.type === 'final') mark('*** the last tooth: Lou\'s ***');
  }
  if (inkLag >= 0 && (inkLag -= dt) < 0) S.ink = S.trend;
  const st = E.stats(S);
  stopAcc += dt;
  if (stopAcc >= 1.6) {
    stopAcc = 0;
    const r = rnd(), pHit = Math.min(0.92, 0.35 + 1.6 * st.zone);
    E.stop(S, r < pHit * 0.27 ? 'bull' : r < pHit ? 'hit' : 'miss');
  }
  if (Math.round(played * 10) % 5 === 0) spend();
  if (E.phase(S) !== phaseWas) { phaseWas = E.phase(S); mark(`=== phase ${phaseWas} ===`); }
  if (sitT >= SIT && !S.ended && !S.final) {
    const got = E.offline(S, AWAY);
    mark(`--- away ${AWAY / 60} min: +${got ? E.fmt(got.teeth) : 0} teeth, +${got ? E.fmt(got.doub) : 0} doubloons ---`);
    sitT = 0; sittings++;
  }
}
for (const l of log) console.log(l);
const g = gaps.slice(1).sort((a, b) => a - b), q = p => g[Math.floor(p * (g.length - 1))]?.toFixed(0);
console.log(`\nended: ${S.ended} at ${fmtT(played)} played, ${sittings} sittings, ${buys} purchases`);
console.log(`gaps between purchases: median ${q(0.5)}s, p90 ${q(0.9)}s, max ${q(1)}s`);
console.log(`crowned by hand ${E.fmt(S.handC)}, deck ${E.fmt(S.deckC)}, clubs ${E.fmt(S.clubC)}; hits ${S.hits}, misses ${S.misses}`);
const long = []; let t = 0;
for (let i = 1; i < gaps.length; i++) { t += gaps[i - 1]; if (gaps[i] > 75) long.push(`${fmtT(t)} +${gaps[i].toFixed(0)}s`); }
if (long.length) console.log('gaps over 75 s:', long.slice(0, 20).join(', '));
