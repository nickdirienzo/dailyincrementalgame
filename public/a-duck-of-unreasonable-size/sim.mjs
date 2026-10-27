// Pacing sim: node public/a-duck-of-unreasonable-size/sim.mjs [seed] [--quiet]
// A reasonable player: one drag every ~1.3s (squish a pair, else stamp a form, else drop a ducklet),
// buys the cheapest thing on show, pulls the booth with spare coins, and launches a Flotilla once
// it pays for the next permit (or the pond is stuck).
import * as E from './economy.mjs';

const seed = Number(process.argv[2]) || 1;
const quiet = process.argv.includes('--quiet');
let s = seed >>> 0;
E.setRng(() => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296));

const S = E.newState();
const dt = 0.1, ACT = 1.3;
let nextAct = 0, lastBuy = 0, gaps = [], idle = 0, stuckSince = null;
const lines = [];
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const log = m => lines.push(`${fmt(S.time)}  ${m}`);

function shopList() {
  const l = [];
  for (const u of E.UPGRADES) { const lv = E.lvl(S, u.id); if (lv < u.cost.length && (u.show(S) || S.seen.includes(u.id))) l.push([u.cost[lv], u.id, 'c']); }
  for (const o of E.ONEOFFS) if (!S.odd[o.id] && (o.show(S) || S.seen.includes(o.id))) l.push([o.cost, o.id, 'c']);
  if (!S.booth && S.earned >= 20) l.push([E.BOOTH_UNLOCK, 'booth', 'c']);
  return l.sort((a, b) => a[0] - b[0]);
}
function buyStuff() {
  for (const r of E.RENOWN) {
    const lv = E.rlvl(S, r.id);
    if (lv < r.cost.length && S.postcards >= r.cost[lv]) { E.buy(S, r.id); log(`  ✉ ${r.name} ${lv + 1}`); }
  }
  for (;;) {
    const l = shopList(); for (const [, id] of l) if (!S.seen.includes(id)) S.seen.push(id);
    if (!l.length || S.coins < l[0][0]) break;
    E.buy(S, l[0][1]);
    gaps.push(S.time - lastBuy); lastBuy = S.time;
    log(`  buy ${l[0][1]} (${l[0][0]})`);
  }
  const l = shopList();
  const saving = l.length ? l[0][0] : Infinity;
  if (S.booth && S.coins >= E.boothCost(S) + Math.min(saving, 400) * 0.6 && E.empties(S).length > 2) { E.hook(S); }
}

function act() {
  const p = E.findPair(S);
  if (p) { E.merge(S, p[0], p[1]); return true; }
  const f = S.grid.findIndex((c, i) => c && c.k === 'form' && E.active(S, i));
  if (f >= 0) { E.stamp(S, f); return true; }
  const e = E.empties(S);
  if (S.ink >= 1 && e.length) {
    e.sort((a, b) => Math.floor(b / E.COLS) - Math.floor(a / E.COLS));
    E.spawn(S, e[0]); return true;
  }
  return false;
}

let lastPhase = 1, lastBest = 1;
while (!S.ended && S.time < 4 * 3600) {
  const out = [];
  E.tick(S, dt, out);
  for (const ev of out) {
    if (ev.type === 'registered') log(`registered ${E.TIERS[ev.t].name} (form ${ev.code})`);
    if (ev.type === 'jubilee') log('THE DUCK OF UNREASONABLE SIZE wins the Jubilee');
  }
  if (S.best > lastBest) { lastBest = S.best; log(`first ${E.TIERS[S.best].name}`); }
  if (S.time >= nextAct) {
    nextAct = S.time + ACT;
    buyStuff();
    if (S.jubilee) { E.sail(S); E.sail(S); E.sail(S); E.sail(S); break; }
    if (!act()) idle += ACT;
    // Flotilla decision.
    if (S.flotillaOpen) {
      const v = E.flotillaValue(S), top = E.legalTop(S);
      const gate = top < E.TOP ? E.TIERS[top + 1].form.legend : Infinity;
      const pairless = !E.findPair(S) && E.empties(S).length === 0;
      if (pairless) stuckSince ??= S.time; else stuckSince = null;
      const worth = gate !== Infinity && S.best >= top && (S.legend + v >= gate || v >= Math.max(12, S.legend));
      if (worth || (stuckSince !== null && S.time - stuckSince > 40)) {
        log(`=== FLOTILLA ${S.flotillas + 1}: +${v} postcards (legend ${S.legend + v}) after ${fmt(S.time - (S._runStart || 0))} run`);
        E.launch(S); S._runStart = S.time; stuckSince = null; lastBuy = S.time;
      }
    }
  }
  const ph = E.phase(S);
  if (ph !== lastPhase) { log(`--- phase ${ph} ---`); lastPhase = ph; }
}
if (!quiet) console.log(lines.join('\n'));
gaps.sort((a, b) => a - b);
const med = gaps[Math.floor(gaps.length / 2)], p90 = gaps[Math.floor(gaps.length * 0.9)];
console.log(`seed ${seed}: ended=${S.ended} at ${fmt(S.time)}, flotillas ${S.flotillas}, legend ${S.legend}, purchases ${gaps.length}, gap median ${med?.toFixed(0)}s p90 ${p90?.toFixed(0)}s max ${gaps.at(-1)?.toFixed(0)}s, idle ${idle.toFixed(0)}s`);
