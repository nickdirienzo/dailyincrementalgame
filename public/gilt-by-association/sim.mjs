// Pacing sim: node public/gilt-by-association/sim.mjs [--sit=30] [--away=180] [--quiet] [--T='{"bite":3e12}']
// A reasonable player: taps once every ~1.3 s (a bite by night, a whisper by day), buys the cheapest
// affordable thing (in seconds of that currency's income), skips pieces that wouldn't improve the
// grin, places every piece on its best tooth, climbs to the next shelf as soon as it opens, and plays
// in sittings with offline progress between them.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const SIT = arg('sit', 30) * 60, AWAY = arg('away', 180) * 60, quiet = process.argv.includes('--quiet');
const tArg = process.argv.find(a => a.startsWith('--T='));
if (tArg) Object.assign(E.T, JSON.parse(tArg.slice(4)));
const S = E.newState();
const log = [], gaps = [];
const phaseAt = [0, 0], phaseBuys = [0, 0, 0, 0];
let played = 0, sitT = 0, sittings = 1, lastBuy = 0, tapAcc = 0, firstHelper = null, buys = 0;
const fmtT = t => `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(played)}  ${s}`);
const dt = 0.1;

function income(cur) {
  // Average income per second over a whole cycle, including the player's own taps.
  const c = S.clock; S.clock = 0; const r = E.rates(S); S.clock = c;
  const st = E.stats(S), tapRate = 1 / 1.3, nf = E.NIGHT / E.CYCLE;
  let v = r[cur] * nf;
  if (cur === 'foil' && S.phase === 1) v += st.bite * tapRate * nf;
  if (cur === 'gold' && S.phase === 2) v += st.bite * tapRate * nf;
  if (cur === 'pig' && S.phase === 3) v += st.smile * tapRate * nf;
  return Math.max(v, 1e-9);
}

while (!S.ended && played < 6 * 3600) {
  played += dt; sitT += dt;
  for (const ev of E.step(S, dt)) {
    if (ev.type === 'beat') mark(`*** beat the shelf-${ev.phase} rival (grin ${Math.round(E.grin(S))}) ***`);
    if (ev.type === 'close' && ev.joined && !quiet && S.night % 5 === 0) mark(`   night ${S.night}: +${ev.joined} ${ev.who} (${S.cousins} cousins, ${Math.round(S.fans)} fans)`);
    if (ev.type === 'end') mark('*** the last gilt letter is eaten: THE END ***');
  }
  if (S.cousins && firstHelper === null) { firstHelper = played; mark('   first cousin joins'); }
  if (Math.floor(played / 60) !== Math.floor((played - dt) / 60)) mark(`[min ${Math.round(played / 60)}] foil ${E.fmtShort(income('foil'))}/s gold ${E.fmtShort(income('gold'))}/s pig ${E.fmtShort(income('pig'))}/s · grin ${Math.round(E.grin(S))}/${E.rival(S)} · cousins ${S.cousins} fans ${Math.round(S.fans)}`);
  tapAcc += dt;
  if (tapAcc >= 1.3) { tapAcc -= 1.3; E.tap(S); }
  if (E.canClimb(S)) { E.climb(S); phaseAt.push(played); mark(`=== climb to shelf ${S.phase} ===`); }
  if (S.held) E.dropHeld(S);
  // Shop: cheapest affordable thing, measured in seconds of its currency's income.
  let best = null, bv = Infinity;
  for (const it of E.items(S)) {
    if (S[it.cur] < it.cost) continue;
    if (it.kind === 'deco') { const p = E.previews(S, it.piece); if (Math.max(...Object.values(p)) <= 0.01) continue; }
    const v = it.cost / income(it.cur);
    if (v < bv) { bv = v; best = it; }
  }
  if (best && E.buy(S, best.id)) {
    E.dropHeld(S);
    buys++; phaseBuys[S.phase]++;
    gaps.push(played - lastBuy); lastBuy = played;
    if (!quiet) mark(`buy ${best.name}${best.kind === 'lvl' || best.kind === 'count' ? ' ' + (best.l + 1) : ''}  · grin ${Math.round(E.grin(S))}/${E.rival(S)}`);
  }
  if (sitT >= SIT && !S.ended) {
    const got = E.offline(S, AWAY);
    mark(`--- away ${AWAY / 60} min (offline: ${got ? E.fmtShort(got.foil + got.gold + got.pig) : 0}) ---`);
    sittings++; sitT = 0;
  }
}
console.log(log.join('\n'));
const sorted = gaps.slice().sort((a, b) => a - b);
console.log(`\nplayed ${fmtT(played)} over ${sittings} sittings · ${buys} purchases · median gap ${sorted[sorted.length >> 1]?.toFixed(1)} s · longest ${sorted[sorted.length - 1]?.toFixed(0)} s · first helper ${firstHelper ? fmtT(firstHelper) : '-'} · ended ${S.ended}`);
phaseAt.push(played);
console.log('phases: ' + [1, 2, 3].map(p => `shelf ${p} ${((phaseAt[p + 1] - phaseAt[p]) / 60).toFixed(1)} min, ${phaseBuys[p]} buys`).join(' · '));
console.log(`grin ${Math.round(E.grin(S))} · cousins ${S.cousins} · fans ${Math.round(S.fans)} · pool ${E.fmtShort(S.pool)} · nights ${S.night}`);
