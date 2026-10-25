// Pacing sim: node public/three-lemons/sim.mjs [--sit=30] [--away=180] [--quiet]
// A reasonable player: one action every 1.3 s (a rub, or a pull of the fruit machine every fifth
// action while there's no nephew), buys the cheapest affordable thing (in seconds of income), and
// plays in sittings with offline progress between them.
import * as E from './economy.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const SIT = arg('sit', 30) * 60, AWAY = arg('away', 180) * 60, quiet = process.argv.includes('--quiet');
let seed = arg('seed', 7);
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

if (process.argv.some(a => a.startsWith('--k='))) E.setRateK(arg('k', 0.2));
const S = E.defaults();
const log = [];
const buckets = [];
let played = 0, sittings = 1, sitT = 0, actT = 0, n = 0, lastBuy = 0, gaps = [];
const mark = (t, s) => log.push(`${fmtT(t)}  ${s}`);
function fmtT(t) { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }

const dt = 0.1;
let firstHelper = null;
while (!S.ended && played < 20 * 3600) {
  played += dt; sitT += dt; actT += dt;
  for (const ev of E.step(S, dt, rnd)) if (ev.kind === 'scrap') mark(played, `  map scrap ${S.scraps}`);
  if (actT >= 1.3) {
    actT = 0; n++;
    if (!S.owned.lever && n % 5 === 0 && S.duds >= E.PULL_COST) {
      const r = E.pull(S, rnd);
      if (r && r.kind === 'scrap') mark(played, `  map scrap ${S.scraps}`);
    } else E.rub(S);
  }
  const st = E.stats(S);
  if (process.argv.includes('--dbg') && Math.floor(played/300)!==Math.floor((played-dt)/300)) mark(played, `DBG lemons ${E.fmt(S.lemons)} dig ${JSON.stringify(E.costOf(S,'dig'))} can ${E.canBuy(S,'dig')} scraps ${S.scraps} cellars ${S.cellars} rate ${E.fmt(st.lemonRate)} rub ${E.fmt(st.perRub)}`);
  if (Math.floor(played / 600) !== Math.floor((played - dt) / 600) && process.argv.includes('--diag'))
    mark(played, `DIAG rate ${E.fmt(st.lemonRate)} buff ${st.buff} global ${st.global.toFixed(1)} rub ${E.fmt(st.perRub)} V ${E.fmt(st.voltRate)} L ${E.fmt(st.lightRate)} | ${Object.entries(S.owned).filter(([k]) => E.BY_ID[k].kind !== 'one').map(([k, v]) => k + ':' + v).join(' ')} | hm ${JSON.stringify(st.hmult)}`);
  // Buy the cheapest affordable thing, measured in seconds of income. Save up for the big
  // things (a tunnel, an unlock, the next eyes) when they're within a few minutes.

  const rate = { lemons: st.lemonRate + st.perRub / 1.3, duds: (st.lemonRate + st.perRub / 1.3) * E.DUD_RATIO, volts: st.voltRate + 0.01, light: st.lightRate + 0.01 };
  for (let guard = 0; guard < 20; guard++) {
    const opts = E.SHOP_ORDER.filter(id => E.canBuy(S, id)).map(id => {
      const c = E.costOf(S, id);
      return { id, secs: Math.max(...Object.entries(c).map(([r, v]) => v / Math.max(rate[r], 1e-9))) };
    }).sort((a, b) => a.secs - b.secs);
    // Goals first: a tunnel, the next eyes, an unlock.
    const goal = opts.findIndex(o => o.id === 'dig' || o.id === 'eyes' || E.BY_ID[o.id].unlock);
    if (goal > 0) opts.unshift(...opts.splice(goal, 1));
    const key = E.SHOP_ORDER.filter(id => (id === 'dig' || id === 'eyes' || E.BY_ID[id].unlock) && E.visible(S, id) && !E.canBuy(S, id))
      .filter(id => Math.max(...Object.entries(E.costOf(S, id)).map(([r, v]) => (v - S[r]) / Math.max(rate[r], 1e-9))) < 900);
    if (key.length) {
      // Saving up: only spend currencies the goal doesn't need.
      const need = new Set(key.flatMap(k => Object.keys(E.costOf(S, k))));
      opts.splice(0, opts.length, ...opts.filter(o => o.id === 'dig' || o.id === 'eyes' || E.BY_ID[o.id].unlock || Object.keys(E.costOf(S, o.id)).every(r => !need.has(r))));
    }
    if (!opts.length) break;
    const id = opts[0].id;
    E.buy(S, id);
    const u = E.BY_ID[id];
    if (lastBuy) gaps.push({ t: played, gap: played - lastBuy, phase: E.phase(S) });
    buckets[Math.floor(played / 900)] = (buckets[Math.floor(played / 900)] || 0) + 1;
    lastBuy = played;
    const tag = u.kind === 'dig' ? `DIG -> ${E.CELLARS[S.cellars - 1].name}` : u.kind === 'eyes' ? `eyes -> ${E.EYES[S.eyes - 1].name}` : `${u.name}${u.kind !== 'one' ? ' #' + S.owned[id] : ''}`;
    if (u.kind === 'helper' && !firstHelper) firstHelper = played;
    if (u.kind !== 'helper' && u.kind !== 'battery' && u.kind !== 'bulb' || S.owned[id] === 1 || S.owned[id] % 10 === 0) mark(played, `${tag}   [shipped ${E.fmt(S.shipped)}, ${E.fmt(st.lemonRate)}/s, rub ${E.fmt(st.perRub)}]`);
  }
  if (sitT >= SIT && !S.ended) {
    const got = E.offline(S, AWAY);
    mark(played, `--- away ${AWAY / 60} min: +${E.fmt(got.lemons)} lemons, +${E.fmt(got.volts)} volts, +${E.fmt(got.light)} light ---`);
    sitT = 0; sittings++; lastBuy = played;
  }
}
if (!quiet) console.log(log.join('\n'));
const g = gaps.map(x => x.gap).sort((a, b) => a - b);
const q = p => g[Math.floor(g.length * p)]?.toFixed(1);
console.log(`\nended: ${S.ended} after ${fmtT(played)} played, ${sittings} sittings; purchases ${g.length + 1}; first helper ${firstHelper && fmtT(firstHelper)}`);
console.log(`gap median ${q(0.5)}s, p90 ${q(0.9)}s, max ${q(1)}s; eyes ${S.eyes}, cellars ${S.cellars}, pulls ${S.pulls}, trinkets ${S.trinkets.length}`);
// Longest gaps
console.log('longest gaps:', gaps.sort((a, b) => b.gap - a.gap).slice(0, 6).map(x => `${x.gap.toFixed(0)}s @${fmtT(x.t)} (p${x.phase})`).join(', '));
console.log('purchases per 15 min:', buckets.map((n, i) => `${i * 15}m:${n}`).join(' '));
