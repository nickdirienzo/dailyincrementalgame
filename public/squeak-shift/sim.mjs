// Pacing sim: node public/squeak-shift/sim.mjs [--sit=30] [--away=180] [--quiet] [--seed=7]
// A reasonable player: tunes a duck by hand every ~4 s when there's one to tune (hits the line
// 85% of the time, dead-on 35%; honks are harder), answers bells a few seconds after they ring,
// buys a duck by hand when out of them, buys the cheapest affordable upgrade, keeps the clipboard
// in a sensible order, spreads the night staff over the jobs, and plays in sittings.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const SIT = arg('sit', 30) * 60, AWAY = arg('away', 180) * 60, quiet = process.argv.includes('--quiet');
let seed = arg('seed', 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rnd;
if (process.argv.some(a => a.startsWith('--T='))) Object.assign(E.T, JSON.parse(process.argv.find(a => a.startsWith('--T=')).slice(4)));
const S = E.newState();
const log = [], gaps = [], buckets = [];
let played = 0, sitT = 0, sittings = 1, lastBuy = 0, tuneT = 0, bellLag = 0, honkSeen = null, rounds = 0;
const fmtT = t => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(played)}  ${s}`);
const dt = 0.1;
const ORDER1 = ['bell', 'tune', 'buy', 'chairs', 'lost', 'cover'];
const ORDER2 = ['bell', 'tune', 'buy', 'cover', 'lost', 'chairs'];
const PICK1 = ['bell', 'chairs', 'buy', 'tune', 'lost'], PICK2 = ['bell', 'cover', 'buy', 'tune', 'lost'];
function program() {
  // Tick the most useful chores the clipboard has room for, then put them in a sensible order.
  const n = E.stats(S).lines, pick = (S.review ? PICK2 : PICK1).filter(id => S.queue.some(q => q.id === id)).slice(0, n);
  const order = S.review ? ORDER2 : ORDER1;
  S.queue.sort((a, b) => (pick.includes(b.id) - pick.includes(a.id)) || order.indexOf(a.id) - order.indexOf(b.id));
  for (const q of S.queue) { q.on = pick.includes(q.id); if (q.id === 'chairs') q.upto = 40; }
  return;
  for (const q of S.queue) { if (q.id !== 'buy') q.on = !(S.review && q.id === 'chairs'); if (q.id === 'buy') q.stock = 2; }
}
function staff() {
  if (!S.review) return;
  const n = S.staff, J = { scrounge: 0, tune: 0, hush: 0, cover: 0 };
  if (S.plan >= E.PLANS.length) { J.cover = n; }
  else {
    J.hush = 1; J.tune = Math.max(1, Math.round(n * 0.25)); J.scrounge = Math.max(1, Math.round(n * 0.3));
    J.cover = Math.max(0, n - J.hush - J.tune - J.scrounge);
  }
  S.jobs = J;
}
function bought(what) {
  if (lastBuy) gaps.push({ t: played, gap: played - lastBuy, ph: E.phase(S), what });
  lastBuy = played;
  buckets[Math.floor(played / 600)] = (buckets[Math.floor(played / 600)] || 0) + 1;
}
function handle(out) {
  for (const ev of out) {
    if (ev.type === 'prank') mark(`*** prank ${ev.plan + 1}: ${E.PLANS[ev.plan].name} (★${ev.stars}) ***  [night ${S.night}, staff ${S.staff}]`);
    if (ev.type === 'ready') mark(`  sheet ${ev.plan + 1} full; fitting costs ${E.fitCost(S)}${E.fitCur(S)}`);
    if (ev.type === 'review') mark('=== THE BUDGET REVIEW: no more pennies; the night staff volunteer ===');
    if (ev.type === 'matron') rounds++;
  }
}

while (!S.ended && played < 10 * 3600) {
  played += dt; sitT += dt;
  const out = E.step(S, dt); handle(out);
  // Bells: answered by hand a few seconds after they ring, if the clipboard hasn't got there.
  if (S.bells.length) { bellLag += dt; if (bellLag > 5 + rnd() * 4) { handle([E.answerBell(S, 0) && { type: 'answer' }].filter(Boolean)); bellLag = 0; } } else bellLag = 0;
  // Discover the honk a minute after the first “?” slot appears.
  const p = E.plan(S);
  if (!S.honk && p && p.notes.some(n => E.isHonk(n))) { honkSeen ??= played; }
  const canHonk = S.honk || (honkSeen != null && played - honkSeen > 60);
  // Tune by hand.
  if (S.raw > 0 && S.matron <= 0 && (tuneT += dt) >= 4) {
    tuneT = 0;
    const n = E.autoNote(S, canHonk);
    if (n != null) {
      const honk = E.isHonk(n), st = E.stats(S);
      const r = rnd(), hit = honk ? 0.45 + st.honkTol : 0.72 + st.noteTol * 0.4, perf = honk ? 0.15 : 0.3;
      const pitch = r < perf ? n : r < hit ? n + (honk ? st.honkTol * 0.8 : st.noteTol * 0.8) : n + 0.62;
      const o = []; E.tune(S, pitch, o); handle(o);
    }
  }
  // Fit a finished sheet as soon as it's affordable.
  if (S.ready && E.canFit(S)) { const o = []; E.fit(S, o); handle(o); bought('fit'); }
  // Save for the fitting or the next upgrade when it's close; otherwise spend spare pennies on ducks.
  const cur = E.duckCur(S), cheap = E.items(S).filter(i => i.cur === cur).sort((a, b) => a.cost - b.cost)[0];
  const saving = S.plan >= E.PLANS.length || S.ready || (!S.review && cheap && cheap.cost - E.have(S, cur) <= 5);
  const bq = S.queue.find(x => x.id === 'buy'); if (bq) bq.stock = saving ? 0 : 2;
  if (S.raw < 1 && !saving && E.have(S, cur) >= E.stats(S).price && E.autoNote(S, canHonk) != null) { E.buyDuck(S); bought('duck'); }
  if (Math.floor(played / 5) !== Math.floor((played - dt) / 5)) { program(); staff(); }
  if (E.canGive(S)) { const g = E.giveAway(S); mark(`GIVE IT ALL AWAY: ${g.ducks} ducks, ${g.favours} favours, ${g.pence}p`); break; }
  for (let guard = 0; guard < 6; guard++) {
    const opts = E.items(S).filter(i => E.have(S, i.cur) >= i.cost).sort((a, b) => (b.kind === 'staff') - (a.kind === 'staff') || a.cost - b.cost);
    // Near the end, save favours for the last purchase instead of buying silly things.
    // A full sheet waiting to be fitted comes first: only buy what leaves enough for the fitting.
    const fitC = S.ready ? E.fitCost(S) : 0, fc = E.fitCur(S);
    // After the Review, keep a duck's worth of favours when out of ducks.
    const keep = S.review && S.raw < 1 && E.autoNote(S, true) != null ? E.stats(S).price : 0;
    const pick = S.plan >= E.PLANS.length ? null : opts.find(o => (o.cur !== fc || E.have(S, o.cur) - o.cost >= fitC) && (o.cur !== 'f' || S.favours - o.cost >= keep));
    if (!pick) break;
    E.buy(S, pick.id); bought(pick.id);
    mark(`${pick.name}${pick.max > 1 ? ' ' + (pick.l + 1) : ''}${pick.kind === 'staff' ? ' (' + S.staff + ')' : ''}  ${pick.cost}${pick.cur}   [p${S.pence} f${S.favours} raw${S.raw} sheet ${S.plan + 1} ${S.installed}/${E.TOTAL_DUCKS}]`);
  }
  if (sitT >= SIT && SIT > 0 && !S.ended) {
    const got = E.offline(S, AWAY);
    if (got) mark(`--- away ${AWAY / 60} min: +${got.pence}p +${got.favours} favours, ${got.installed} ducks fitted, ${got.pranks} pranks ---`);
    sitT = 0; sittings++; lastBuy = played;
  }
}
if (!quiet) console.log(log.join('\n'));
const g = gaps.map(x => x.gap).sort((a, b) => a - b), q = p => g[Math.floor(g.length * p)]?.toFixed(1);
console.log(`\nflats ${S.flats.length} repaired ${S.repaired}; ended ${S.ended} after ${fmtT(played)} played, ${sittings} sittings, ${S.night} nights; purchases ${g.length + 1}; tuned ${S.tuned} (★${S.perfect}, honks ${S.honks}); matron rounds ${rounds}`);
console.log(`gap median ${q(0.5)}s p90 ${q(0.9)}s max ${q(1)}s`);
console.log('longest gaps:', [...gaps].sort((a, b) => b.gap - a.gap).slice(0, 6).map(x => `${x.gap.toFixed(0)}s @${fmtT(x.t)} (p${x.ph})`).join(', '));
console.log('purchases per 10 min:', [...buckets].map((n, i) => `${i * 10}m:${n || 0}`).join(' '));
