// Pacing sim: node public/which-way-the-wind-bakes/sim.mjs [--quiet] [--T='{"breeze":0.4}']
// A reasonable player: traces a rune every ~1.3 s, buys the cheapest affordable thing (hiring a breeze
// counts), puts new breezes where the slowest ingredient is, keeps about a quarter of them on guard once
// the pigeons come, and rebalances the farm breezes every half minute or so (by hand, until the Foreman).
import * as E from './economy.mjs';

const tArg = process.argv.find(a => a.startsWith('--T='));
if (tArg) Object.assign(E.T, JSON.parse(tArg.slice(4)));
const quiet = process.argv.includes('--quiet');
const S = E.newState();
const log = [], gaps = [];
let lastBuy = 0, castAcc = 0, balAcc = 0, firstHelper = null, buys = 0;
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const mark = s => log.push(`${fmtT(S.t)}  ${s}`);
const dt = 0.1;

function want(it) {
  // Cost in seconds of that currency's income: cheapest first.
  const inc = it.cur === 'cakes' ? Math.max(0.05, E.cakeRate(S) + 0.77 / 4 * E.perSet(S) * 3) : Math.max(0.02, S.shooed / Math.max(1, S.t - 300) * 2);
  return it.cost / inc;
}
while (!S.ended && S.t < 3 * 3600) {
  const out = E.step(S, dt);
  for (const ev of out) {
    if (ev.type === 'phase') mark(`*** phase ${ev.phase} ***`);
    if (ev.type === 'wave' && !quiet) mark(`   wave ${ev.w + 1} (${ev.name}): ${ev.n} pigeons from ${ev.dir}, hp ${E.pigeonHp(S, ev.w).toFixed(1)} · guards ${S.jobs.guard} dps ${E.guardDps(S).toFixed(1)}`);
    if (ev.type === 'end') mark('*** 9,999: THE CRUNCH ***');
  }
  if (S.breezes && firstHelper === null) firstHelper = S.t;
  castAcc += dt;
  if (castAcc >= 1.3) { castAcc = 0; E.cast(S); }
  balAcc += dt;
  if (balAcc >= 30) {
    balAcc = 0;
    // Keep about a quarter on guard once the pigeons are coming.
    if (S.phase >= 2) { const g = Math.round(S.breezes * 0.28); while (S.jobs.guard < g && E.idle(S) >= 0 && E.assign(S, 'guard', 1)); }
    if (!E.lvl(S, 'foreman')) E.balance(S);
  }
  // Shop.
  const opts = E.items(S).filter(it => S[it.cur] >= it.cost);
  if (E.canHire(S) && S.breezes < 60) opts.push({ id: '__hire', cost: E.hireCost(S), cur: 'cakes', name: 'Hire a breeze' });
  if (opts.length) {
    opts.sort((a, b) => want(a) - want(b));
    const it = opts[0];
    const ok = it.id === '__hire' ? E.hire(S) : E.buy(S, it.id);
    if (ok) {
      buys++; gaps.push(S.t - lastBuy); lastBuy = S.t;
      if (!quiet || it.kind === 'odd' || it.id === '__hire' && S.breezes % 5 === 0) mark(`buy ${it.name}${it.kind === 'lvl' ? ` ${E.lvl(S, it.id)}` : it.id === '__hire' ? ` #${S.breezes}` : ''} (${it.cost} ${it.cur}) · made ${E.fmt(S.made)} · ${E.fmtShort(E.cakeRate(S))}/s`);
    }
  }
  if (Math.floor(S.t / 60) !== Math.floor((S.t - dt) / 60)) mark(`[min ${Math.round(S.t / 60)}] made ${E.fmt(S.made)} · sill ${E.fmt(S.cakes)} · ${E.fmtShort(E.cakeRate(S))}/s · breezes ${S.breezes} (guard ${S.jobs.guard}) · feathers ${Math.floor(S.feathers)} · shooed ${S.shooed} stolen ${S.stolen}`);
}
console.log(log.join('\n'));
gaps.sort((a, b) => a - b);
const med = gaps[Math.floor(gaps.length / 2)], max = gaps[gaps.length - 1];
console.log(`\nfinished: ${S.ended} in ${fmtT(S.t)} · ${buys} purchases · median gap ${med?.toFixed(1)}s · longest ${max?.toFixed(1)}s · first breeze ${fmtT(firstHelper ?? 0)} · waves ${S.wave} · shooed ${S.shooed} · landed ${S.landed} · stolen ${S.stolen}`);
