// Pacing sim: node public/very-bright-actually/sim.mjs [--sit=30] [--away=180] [--quiet]
// A reasonable player: catches what the net can reach (at most one comet every ~0.8 s), picks up
// the shore at dawn one lump per 1.3 s, buys the cheapest affordable thing (in seconds of income),
// sets the shift sliders sensibly, rings the bell a few seconds late, and plays in sittings.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const SIT = arg('sit', 30) * 60, AWAY = arg('away', 180) * 60, quiet = process.argv.includes('--quiet');
let seed = arg('seed', 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
if (process.argv.some(a => a.startsWith('--T='))) Object.assign(E.T, JSON.parse(process.argv.find(a => a.startsWith('--T=')).slice(4)));
const S = E.newState();
const log = [], gaps = [], buckets = [], miles = {};
let played = 0, sitT = 0, sittings = 1, lastBuy = 0, catchAcc = 0, gatherT = 0, bellLag = 0, firstFolk = null;
const fmtT = t => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(played)}  ${s}`);
const dt = 0.1;

function setSplits() {
  if (!S.rota) return;
  // Night: lamp share, more of it while stars are still to win; none once saving for the Thaw.
  S.split.night = S.surveyor ? 0 : 0.35;
  // Day: try each split, keep the one that nets the most comets.
  let best = 0, bestV = -Infinity; const sv = S.shift; S.shift = 'day';
  const clk = S.clock; S.clock = E.nightLen(S) + 1;
  for (let x = 0; x <= 1.001; x += 0.1) { S.split.day = x; const r = E.rates(S); const v = r.beach - r.thaw; if (v > bestV) { bestV = v; best = x; } }
  S.split.day = best; S.shift = sv; S.clock = clk;
}

while (!S.ended && played < 6 * 3600) {
  played += dt; sitT += dt;
  for (const ev of E.step(S, dt)) {
    if (ev.type === 'star') mark(`★${ev.stars} — seen from ${E.PLACES[ev.stars]}`);
    if (ev.type === 'surveyor') { mark('*** the Surveyor arrives ***'); miles.surv = played; }
  }
  const st = E.stats(S);
  if (st.hand && E.isNight(S)) {
    catchAcc += Math.min(st.spawn * st.hit, 1 / 0.8) * dt;
    while (catchAcc >= 1) { catchAcc--; E.catchOne(S); }
  }
  if (!E.isNight(S) && S.lumps > 0 && (gatherT += dt) >= 1.3) { gatherT = 0; E.gather(S); }
  if (E.bellNeeded(S)) { if ((bellLag += dt) > 3) { E.ringBell(S); bellLag = 0; } } else bellLag = 0;
  if (Math.floor(played / 5) !== Math.floor((played - dt) / 5)) setSplits();
  if (S.surveyor && E.canThaw(S)) { E.thaw(S); mark(`THE GREAT THAW: ${E.fmt(S.thawed)} comets`); continue; }

  // Income per second, averaged over a day/night cycle.
  const nf = E.nightLen(S) / E.CYCLE;
  const cometRate = (st.hand ? Math.min(st.spawn * st.hit, 1.25) * st.V : st.netFolk * st.netPow * 0.7) * nf + 1e-9;
  const shineRate = Math.max(1e-9, st.hand ? Math.min(st.spawn * st.hit, 1.25) * st.V * st.tail * nf : S.folk * S.split.night * st.lampPow * st.lumen * nf);
  for (let guard = 0; guard < 10; guard++) {
    const opts = E.items(S).filter(i => (i.cur === 'comets' ? S.comets : S.shine) >= i.cost)
      .filter(i => i.kind !== 'lens' || i.side === (i.ring % 2 ? 'a' : 'b'))
      .map(i => ({ ...i, secs: i.cost / (i.cur === 'comets' ? cometRate : shineRate) }))
      .sort((a, b) => a.secs - b.secs);
    // Save up for the Rota Board and the Knitted Rota when they're close.
    const goal = E.items(S).find(i => (i.id === 'rota' || i.id === 'knit') && i.cost > S.comets && (i.cost - S.comets) / cometRate < 300);
    const pick = S.surveyor ? opts.find(o => o.cur === 'shine' || o.secs < 30) : goal ? opts.find(o => o.cur === 'shine' || o.id === goal.id) : opts[0];
    if (!pick) break;
    E.buy(S, pick.id);
    if (pick.id === 'folk' && !firstFolk) firstFolk = miles.folk = played;
    if (lastBuy) gaps.push({ t: played, gap: played - lastBuy, ph: E.phase(S) });
    lastBuy = played;
    buckets[Math.floor(played / 600)] = (buckets[Math.floor(played / 600)] || 0) + 1;
    if (process.argv.includes('--all') || pick.kind !== 'lvl' || pick.l === 0 || (pick.l + 1) % 4 === 0 || pick.id === 'felt')
      mark(`${pick.name}${pick.kind === 'lvl' ? ' ' + (pick.l + 1) : ''}   [comets ${E.fmt(S.comets)}, ${E.fmt(cometRate)}/s; shine ${E.fmt(S.shine)}; folk ${S.folk}; night ${S.night}; p${E.phase(S)}]`);
    if (pick.id === 'rota' || pick.id === 'knit') miles[pick.id] = played;
    if (pick.id === 'rota') mark('=== PHASE 2: the Rota Board, the net retires ===');
    if (pick.id === 'knit') mark('=== PHASE 3: the Knitted Rota ===');
  }
  if (sitT >= SIT && SIT > 0) {
    const got = E.offline(S, AWAY);
    if (got) mark(`--- away ${AWAY / 60} min: +${E.fmt(got.comets)} comets, +${E.fmt(got.shine)} shine ---`);
    sitT = 0; sittings++; lastBuy = played;
  }
}
if (!quiet) console.log(log.join('\n'));
const g = gaps.map(x => x.gap).sort((a, b) => a - b), q = p => g[Math.floor(g.length * p)]?.toFixed(1);
console.log(`\nended ${S.ended} after ${fmtT(played)} played, ${sittings} sittings, ${S.night} nights; purchases ${g.length + 1}; first Wool Folk ${firstFolk && fmtT(firstFolk)}; folk ${S.folk}`);
console.log(`gap median ${q(0.5)}s p90 ${q(0.9)}s max ${q(1)}s`);
console.log('longest gaps:', [...gaps].sort((a, b) => b.gap - a.gap).slice(0, 6).map(x => `${x.gap.toFixed(0)}s @${fmtT(x.t)} (p${x.ph})`).join(', '));
console.log('purchases per 10 min:', [...buckets].map((n, i) => `${i * 10}m:${n || 0}`).join(' '));

if (process.argv.includes('--brief')) console.log('BRIEF', JSON.stringify(E.T), Object.entries(miles).map(([k, v]) => k + ' ' + (v / 60).toFixed(1)).join(', '), 'end', (played / 60).toFixed(1), 'p90', q(0.9));
