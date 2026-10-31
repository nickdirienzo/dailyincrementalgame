// Pacing sim: node public/we-have-a-pickle/sim.mjs [--quiet] [--stroke=1.6] [--seed=7] [--T={...}]
// A reasonable player: draws a stroke about every 1.6 s (a drag takes longer than a tap) and
// catches most of what's adrift within reach; neighbors sometimes cut a stroke (more neighbors,
// more cuts, fewer after the polite letters). Buys the cheapest affordable thing, eats whenever
// a bite would at least double what the Sun has eaten, and brines when the next jar upgrade
// needs jars it can get from half the stash.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const quiet = process.argv.includes('--quiet'), STROKE = arg('stroke', 1.6);
let seed = arg('seed', 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const Targ = process.argv.find(a => a.startsWith('--T='));
if (Targ) Object.assign(E.T, JSON.parse(Targ.slice(4)));

const S = E.newState();
const log = [], gaps = [];
let lastTot = 0, rate = 0, adrift = 0, strokeAcc = 0, autoAcc = 0, lastBuy = 0, buys = 0, phaseWas = 'rescue';
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(S.t).padStart(6)}  ${s}`);
const dt = 0.1;

function spend() {
  for (let guard = 0; guard < 50; guard++) {
    E.reveal(S);
    const pick = E.items(S).filter(u => u.price <= E.wallet(S, u)).sort((a, b) => a.price / (a.tab === 'j' ? 1 / E.JAR : 1) - b.price / (b.tab === 'j' ? 1 / E.JAR : 1))[0];
    if (!pick) break;
    E.buy(S, pick.id); buys++;
    gaps.push(S.t - lastBuy); lastBuy = S.t;
    if (!quiet) mark(`${pick.tab === 'j' ? '[jar] ' : ''}${pick.name}${pick.max ? ' ' + E.lvl(S, pick.id) : ''} (${E.fmt(pick.price)})`);
  }
  // Brine for the next jar upgrade.
  if (E.canBrine(S)) {
    const next = E.items(S).filter(u => u.tab === 'j').sort((a, b) => a.price - b.price)[0];
    if (next && next.price > S.jars && Math.floor(S.p / 2 / E.JAR) + S.jars >= next.price) {
      const n = E.brine(S); if (!quiet) mark(`  brine -> ${n} jars`);
      spend();
    }
  }
  // Eat when a bite at least doubles the meal so far.
  if (E.canEat(S) && S.p / 2 >= Math.max(30, S.eaten)) {
    const b = E.eat(S); if (!quiet) mark(`  EAT ${E.fmt(b)}  (eaten ${E.fmt(S.eaten)}, glow x${E.stats(S).glow.toFixed(2)}, ${E.hungerName(S)})`);
  }
}

while (!E.full(S) && S.t < 4 * 3600) {
  const st = E.stats(S);
  adrift = Math.min(st.cap, adrift + st.spawn * dt);
  E.tick(S, dt);
  strokeAcc += dt;
  if (strokeAcc >= STROKE) {
    strokeAcc -= STROKE;
    let n = Math.floor(Math.min(adrift, st.reach) * (0.75 + 0.2 * rnd()));
    const crowd = E.planetsOut(S).filter(p => E.blocks(S, p)).reduce((a, p) => a + p.size / 32, 0);
    const cut = rnd() < 0.05 * crowd * st.hit;
    if (cut) n = Math.floor(n / 2);
    adrift -= n;
    E.stroke(S, n, cut);
  }
  if (st.autoEvery) {
    autoAcc += dt;
    if (autoAcc >= st.autoEvery) { autoAcc = 0; const n = Math.floor(Math.min(adrift, Math.ceil(st.reach / 2))); adrift -= n; E.stroke(S, n, false, true); }
  }
  if (Math.round(S.t * 10) % 300 === 0) { rate = (S.total - lastTot) / 30; lastTot = S.total; if (quiet) mark(`rate ${E.fmt(rate)}/s  p ${E.fmt(S.p)} eaten ${E.fmt(S.eaten)} jars ${S.jars} buys ${buys}`); }
  spend();
  const ph = E.phase(S);
  if (ph !== phaseWas) { mark(`=== phase: ${ph} ===`); phaseWas = ph; }
}
mark(`*** FULL: ${E.fmt(S.eaten)} eaten, ${S.eats} meals, ${S.brines} brines, glow x${E.stats(S).glow.toFixed(1)}; secret items: ${E.SECRET.filter(i => S.odd[i]).join(', ')}`);
console.log(log.join('\n'));
const g = gaps.slice(1).sort((a, b) => a - b);
console.log(`\nfinished in ${fmtT(S.t)} (${(S.t / 60).toFixed(1)} min), ${buys} purchases, median gap ${g[g.length >> 1]?.toFixed(1)}s, max gap ${g[g.length - 1]?.toFixed(1)}s`);
console.log(`unbought: ${E.items(S).map(u => u.name).join(', ')}`);
