// The rules of Which Way the Wind Bakes, shared by the game and the pacing sim (sim.mjs).
//
// A cupcake needs one of each wind's ingredient: flour (north mill), honey (east hives), eggs (south
// henhouse) and cream (west churn). Tracing a rune casts that wind; breezes (workers) do the same
// work all the time, on whichever job you give them. Corner plots boost the two farms beside them.
// Every cast points Wendell at the pigeons on that side, and pigeons take a pointing rooster over a
// pile of cupcakes as an invitation: they come in waves to "collect". Guard breezes blow them back
// and they leave feathers behind. The placard counts cupcakes assembled; it has four digits.

export const CAP = 9999;
export const DIRS = ['N', 'E', 'S', 'W'];
export const ING = { N: 'flour', E: 'honey', S: 'eggs', W: 'cream' };
export const JOB_OF = { N: 'mill', E: 'hive', S: 'hens', W: 'churn' };
export const JOBS = ['mill', 'hive', 'hens', 'churn', 'guard'];
export const FARM = { mill: 'windmill', hive: 'beehive', hens: 'henhouse', churn: 'dairy' };
// Corner plots and the two farms each one sits between.
export const CORNERS = { sun: ['mill', 'hive'], clover: ['hive', 'hens'], hay: ['hens', 'churn'], pond: ['churn', 'mill'] };
export const PHASE2 = 260;   // cupcakes assembled when the pigeons notice
export const PHASE3 = 5000;  // the Jubilee rush: the whole Society turns up

// Tunables (the sim can override them).
export const T = {
  breeze: 0.15,       // ingredient per second, per breeze, before boosts
  cast: 4,            // ingredient per cast, before boosts
  castSecs: 2.5,        // a cast also blows this many seconds of the village's own output for that wind
  hire: [14, 1.24],    // breeze n costs hire[0] * hire[1]^n cupcakes
  waveGap: 42,        // seconds between waves
  rushGap: 32,
  fly: 11,            // seconds a pigeon takes from the edge to the sill
  hp: [3.5, 1.18],    // pigeon persistence: hp[0] * hp[1]^wave
  guard: 1.1,         // persistence a guard breeze blows off per second
  farm: 0.2,          // per farm level
  corner: 0.15,       // per corner level, to each farm beside it
  tins: 0.25,          // extra cupcakes per set, per Mini Tins level
  green: 1.5,
  cost: 2.5,            // every shop price
  push: 0.08,         // how far a gust down their side blows a pigeon back (of the whole way)
};

export function newState() {
  return {
    t: 0, ended: false, phase: 1,
    ing: { flour: 0, honey: 0, eggs: 0, cream: 0 },
    cakes: 0, made: 0, feathers: 0,
    breezes: 0, jobs: { mill: 0, hive: 0, hens: 0, churn: 0, guard: 0 },
    lv: {}, odd: {}, seen: [], shopTab: 'cakes',
    bag: [], rune: 'N', next: 'E', casts: 0, whirl: 0,
    point: { N: 0, E: 0, S: 0, W: 0 },
    wave: 0, waveT: 20, waveDir: 'N', pigeons: [], spawn: [], shooed: 0, stolen: 0, landed: 0,
    hint: {},
  };
}
export function load(raw) {
  const S = newState();
  for (const k of Object.keys(raw || {})) {
    if (S[k] && typeof S[k] === 'object' && !Array.isArray(S[k]) && raw[k] && typeof raw[k] === 'object') S[k] = { ...S[k], ...raw[k] };
    else S[k] = raw[k];
  }
  if (!DIRS.includes(S.rune)) S.rune = 'N';
  return S;
}
const L = (S, id) => S.lv[id] || 0;
export const lvl = L;

// ---------- Production ----------
export function farmMult(S, job) {
  let m = 1 + T.farm * L(S, FARM[job]);
  for (const [c, pair] of Object.entries(CORNERS)) if (pair.includes(job)) m *= 1 + T.corner * L(S, c);
  if (L(S, 'green')) m *= T.green;
  return m;
}
export function breezeMult(S) { return (1 + 0.2 * L(S, 'bed')) * (S.odd.oil ? 1.05 : 1); }
// Ingredient per second from the breezes on each farm job.
export function rates(S) {
  const r = {};
  for (const d of DIRS) { const job = JOB_OF[d]; r[ING[d]] = S.jobs[job] * T.breeze * farmMult(S, job) * breezeMult(S); }
  return r;
}
export const perSet = S => 1 + T.tins * L(S, 'tins');
// Cupcakes per second if nothing is left over: the slowest ingredient sets the pace.
export function cakeRate(S) { const r = rates(S); return Math.min(...Object.values(r)) * perSet(S); }
export function bottleneck(S) {
  const r = rates(S); let best = null;
  for (const d of DIRS) { const k = ING[d]; const v = r[k] + S.ing[k] * 0.02; if (!best || v < best.v) best = { d, k, v }; }
  return best;
}
export function castYield(S, d) {
  const job = JOB_OF[d];
  return (T.cast + 2 * L(S, 'deep')) * farmMult(S, job) + T.castSecs * (1 + 0.5 * L(S, 'deep')) * rates(S)[ING[d]];
}
export const guardPower = S => T.guard * (1 + 0.6 * L(S, 'gale')) * (S.odd.plume ? 1.1 : 1);
export const guardDps = S => S.jobs.guard * guardPower(S);
export const castBlast = S => 6 * (1 + 0.6 * L(S, 'gale')) * (1 + 0.5 * L(S, 'deep'));

// ---------- Runes ----------
// Wendell can't decide: the next wind is whichever way he spins, every wind once per round.
function draw(S) {
  if (!S.bag.length) { S.bag = DIRS.slice(); for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.bag[i], S.bag[j]] = [S.bag[j], S.bag[i]]; } }
  return S.bag.pop();
}
export const whirlEvery = S => L(S, 'whirl') ? 7 - L(S, 'whirl') : 0;
export const isWhirl = S => whirlEvery(S) > 0 && S.whirl >= whirlEvery(S);
// One traced rune. Returns what it did.
export function cast(S, out = []) {
  if (S.ended) return null;
  const whirl = isWhirl(S);
  const dirs = whirl ? DIRS : [S.rune];
  const got = {};
  for (const d of dirs) {
    const n = castYield(S, d) * (whirl ? 1.5 : 1);
    S.ing[ING[d]] += n; got[ING[d]] = n;
    S.point[d] += 1;
    // A gust down the side it points at blows back the pigeons on their way in from there.
    for (const p of S.pigeons) if (p.dir === d && p.hp > 0) { p.hp -= castBlast(S); p.p = Math.max(0, p.p - T.push); }
  }
  S.casts++;
  S.whirl = whirl ? 0 : S.whirl + 1;
  const dir = S.rune;
  S.rune = S.next; S.next = draw(S);
  out.push({ type: 'cast', dir, whirl, got });
  return { dir, whirl, got };
}

// ---------- Shop ----------
// kind: 'lvl' (levels up to max), 'odd' (a silly one-off). cur: 'cakes' or 'feathers'.
const farm = (id, job, name, base, desc, lines) => ({ id, cur: 'cakes', kind: 'lvl', max: 8, name, base, grow: 1.9, desc, job,
  show: S => S.breezes >= 1 || S.made >= 20 });
export const ITEMS = [
  // The four farms.
  farm('windmill', 'mill', 'Windmill Sails', 14, 'New canvas on the windmill. North gusts and mill breezes grind half as much again, per level.'),
  farm('beehive', 'hive', 'Beehive', 16, 'Another skep at the hives. East gusts and hive breezes bring half as much again, per level.'),
  farm('henhouse', 'hens', 'Henhouse', 18, 'A roomier henhouse. South gusts and hen breezes bring half as much again, per level.'),
  farm('dairy', 'churn', 'Dairy Churn', 20, 'A bigger churn, with paddles. West gusts and churn breezes bring half as much again, per level.'),
  // Corner plots: each boosts the two farms beside it.
  { id: 'sun', cur: 'cakes', kind: 'lvl', max: 5, name: 'Sunflowers', base: 70, grow: 2.6, desc: 'Between the mill and the hives. Bees love them, and the seeds go in the flour. +35% flour and honey per level.', show: S => L(S, 'windmill') && L(S, 'beehive') },
  { id: 'clover', cur: 'cakes', kind: 'lvl', max: 5, name: 'Clover Patch', base: 80, grow: 2.6, desc: 'Between the hives and the henhouse. Bees love it, hens eat it. +35% honey and eggs per level.', show: S => L(S, 'beehive') && L(S, 'henhouse') },
  { id: 'hay', cur: 'cakes', kind: 'lvl', max: 5, name: 'Haystack', base: 90, grow: 2.6, desc: 'Between the henhouse and the dairy. Hens nest in it, cows eat it. +35% eggs and cream per level.', show: S => L(S, 'henhouse') && L(S, 'dairy') },
  { id: 'pond', cur: 'cakes', kind: 'lvl', max: 5, name: 'Mill Pond', base: 100, grow: 2.6, desc: 'Between the dairy and the mill. The cows drink from it and it turns the wheel on still days. +35% cream and flour per level.', show: S => L(S, 'dairy') && L(S, 'windmill') },
  { id: 'green', cur: 'cakes', kind: 'lvl', max: 1, name: 'Village Green', base: 2600, grow: 1, desc: 'Every plot in the diorama built. A green in the middle of it all: every farm makes half as much again.', show: S => Object.keys(CORNERS).every(c => L(S, c) >= 2) },
  // The bakery and the vane.
  { id: 'tins', cur: 'cakes', kind: 'lvl', max: 4, name: 'Mini Tins', base: 45, grow: 3, desc: 'Smaller tins. The same four ingredients make half a cupcake more, per level. Nobody can tell.', show: S => S.made >= 30 },
  { id: 'deep', cur: 'cakes', kind: 'lvl', max: 4, name: 'Deep Breath', base: 10, grow: 2.9, desc: 'Wendell breathes in before he points. Every rune you trace blows harder: more of its ingredient, and a bigger gust at the pigeons.', show: S => S.made >= 4 },
  { id: 'foreman', cur: 'cakes', kind: 'lvl', max: 1, name: 'Foreman Breeze', base: 600, grow: 1, desc: 'A senior breeze with a clipboard. Keeps the farm breezes balanced so nothing piles up (guards stay where you put them).', show: S => S.breezes >= 8 },
  // Silly one-offs, which plant the order.
  { id: 'oil', cur: 'cakes', kind: 'odd', name: 'Oil the Hinge', base: 9, desc: 'One drop of oil on Wendell\'s spindle. He still can\'t decide, but quieter. (+5% breezes, out of relief.)', show: S => S.made >= 6 },
  { id: 'bib', cur: 'cakes', kind: 'odd', name: 'A Bib', base: 35, desc: 'A tiny gingham bib, tied round a tin rooster. In case.', show: S => S.made >= 25 },
  { id: 'rope', cur: 'cakes', kind: 'odd', name: 'Velvet Rope', base: 160, desc: 'A velvet rope in front of the plinth. The visitors stand back. The pigeons do not read.', show: S => S.phase >= 2 },
  { id: 'fork', cur: 'cakes', kind: 'odd', name: 'A Very Small Fork', base: 900, desc: 'Model-railway scale. 1:48. Wendell keeps it under his wing for later.', show: S => S.made >= 1500 },
  { id: 'sign', cur: 'cakes', kind: 'odd', name: 'Do Not Feed Sign', base: 260, desc: 'A small enamel sign on the plinth: PLEASE DO NOT FEED THE PIGEONS. The pigeons are delighted to see their name on something.', show: S => S.wave >= 4 },
  { id: 'postcard', cur: 'cakes', kind: 'odd', name: 'Gift Shop Postcard', base: 1300, desc: 'The museum shop now sells a postcard of the exhibit: Wendell, mid-spin, pointing four ways at once. It is their bestseller among pigeons.', show: S => S.made >= 2500 },
  { id: 'card', cur: 'cakes', kind: 'odd', name: 'Recipe Card', base: 2400, desc: 'Framed beside the exhibit: "CUPCAKES. One of each wind. Serves: everyone." Somebody has pencilled "& pigeons?" underneath.', show: S => S.made >= 3500 },
  // Feathers: what the pigeons leave behind.
  { id: 'gale', cur: 'feathers', kind: 'lvl', max: 8, name: 'Gale Force', base: 4, grow: 1.8, desc: 'Guard breezes blow 60% harder per level, and so do your gusts at the pigeons.', show: S => S.feathers > 0 || S.shooed > 0 },
  { id: 'scare', cur: 'feathers', kind: 'lvl', max: 3, name: 'Scarecrow', base: 12, grow: 2.8, desc: 'A scarecrow in a flour-sack coat. The pigeons slow down to look at it, 25% per level. They think it\'s the head waiter.', show: S => S.shooed >= 4 },
  { id: 'bed', cur: 'feathers', kind: 'lvl', max: 4, name: 'Feather Bed', base: 20, grow: 2.5, desc: 'The breezes sleep on pigeon feathers between shifts. Every breeze works 20% harder per level.', show: S => S.shooed >= 10 },
  { id: 'spikes', cur: 'feathers', kind: 'lvl', max: 3, name: 'Polite Spikes', base: 30, grow: 2.6, desc: 'Rubber spikes along the sill, very polite. A pigeon who gets through takes a third less, per level.', show: S => S.stolen >= 10 },
  { id: 'tail', cur: 'feathers', kind: 'lvl', max: 1, name: 'Tail Feathers', base: 16, grow: 1, desc: 'Real feathers on Wendell\'s tin tail. He still spins, but now you can see which way he\'ll spin next.', show: S => S.shooed >= 6 },
  { id: 'whirl', cur: 'feathers', kind: 'lvl', max: 3, name: 'Whirlwind', base: 60, grow: 2.4, desc: 'When Wendell has spun enough, he can\'t decide at ALL: a round rune that blows every wind at once. Comes round more often, per level.', show: S => S.shooed >= 20 },
  { id: 'scrap1', cur: 'feathers', kind: 'odd', name: 'Read the Scrap', base: 8, desc: 'A pigeon dropped a scrap of paper. It says "…AKERY AT ODDW…" and "…QUANTITY…". Probably nothing.', show: S => S.shooed >= 3 },
  { id: 'scrap2', cur: 'feathers', kind: 'odd', name: 'Another Scrap', base: 45, desc: 'Another one. "…FOR THE JUBIL…" and "…LEAVE ON THE SI…". Pigeons, it seems, write things down.', show: S => S.odd.scrap1 && S.made >= 1800 },
  { id: 'scrap3', cur: 'feathers', kind: 'odd', name: 'A Third Scrap', base: 180, desc: '"…THE ROOSTER ON THE ROOF…" and a pawprint. No: a footprint. A pigeon footprint, signed with a flourish: "O."', show: S => S.odd.scrap2 && S.made >= 4500 },
  { id: 'duster', cur: 'feathers', kind: 'odd', name: 'Feather Duster', base: 110, desc: 'For the night curator, made of the finest shooed-pigeon down. She dusts the diorama, and pauses at the sill, and frowns at a little envelope there.', show: S => S.shooed >= 90 },
  { id: 'plume', cur: 'feathers', kind: 'odd', name: 'A Plume', base: 70, desc: 'One fine grey feather in Wendell\'s cap. He doesn\'t have a cap. It goes behind his comb. (+10% guard, from the confidence.)', show: S => S.shooed >= 40 },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const hireCost = S => Math.ceil(T.hire[0] * Math.pow(T.hire[1], S.breezes));
export function cost(S, it) { return Math.ceil(T.cost * (it.kind === 'odd' ? it.base : it.base * Math.pow(it.grow, L(S, it.id)))); }
const owned = (S, it) => it.kind === 'odd' ? !!S.odd[it.id] : L(S, it.id) >= it.max;
export function items(S) {
  return ITEMS.filter(it => !owned(S, it) && (S.seen.includes(it.id) || it.show(S)))
    .map(it => ({ ...it, cost: cost(S, it), l: L(S, it.id) }));
}
// The Bought shelf: everything that has left the shop for good.
export function shelf(S) { return ITEMS.filter(it => owned(S, it)).map(it => ({ ...it, l: L(S, it.id) })); }
export function buy(S, id, out = []) {
  const it = ITEM[id]; if (!it || S.ended || owned(S, it)) return false;
  const c = cost(S, it);
  if (S[it.cur] < c) return false;
  S[it.cur] -= c;
  if (it.kind === 'odd') S.odd[id] = 1; else S.lv[id] = L(S, id) + 1;
  if (id === 'tail') S.hint.tail = 1;
  out.push({ type: 'buy', id });
  return true;
}
export const canHire = S => !S.ended && S.cakes >= hireCost(S);
// A new breeze goes where it's needed most: the slowest farm, or the guard once the pigeons come.
export function hire(S, out = []) {
  if (!canHire(S)) return false;
  S.cakes -= hireCost(S); S.breezes++;
  const job = S.phase >= 2 && S.jobs.guard < Math.round(S.breezes * 0.25) ? 'guard' : JOB_OF[bottleneck(S).d];
  S.jobs[job]++;
  out.push({ type: 'hire', job });
  return job;
}
export const idle = S => S.breezes - JOBS.reduce((a, j) => a + S.jobs[j], 0);
export function assign(S, job, delta) {
  if (!JOBS.includes(job)) return false;
  if (delta > 0) {
    if (idle(S) > 0) { S.jobs[job]++; return true; }
    // Nobody free: borrow from the job with the most hands (never from this one).
    let from = null;
    for (const j of JOBS) if (j !== job && S.jobs[j] > 0 && (!from || S.jobs[j] > S.jobs[from])) from = j;
    if (!from) return false;
    S.jobs[from]--; S.jobs[job]++; return true;
  }
  if (S.jobs[job] <= 0) return false;
  S.jobs[job]--; return true;
}
// The foreman: farm breezes spread so the four ingredients come in evenly.
export function balance(S) {
  const farmers = S.breezes - S.jobs.guard;
  const jobs = ['mill', 'hive', 'hens', 'churn'];
  for (const j of jobs) S.jobs[j] = 0;
  for (let i = 0; i < farmers; i++) {
    let best = null;
    for (const j of jobs) {
      const k = ING[DIRS[jobs.indexOf(j)]];
      const v = (S.jobs[j] + 1) * farmMult(S, j) + S.ing[k] / 60;
      const cur = S.jobs[j] * farmMult(S, j) + S.ing[k] / 60;
      if (!best || cur < best.cur) best = { j, cur, v };
    }
    S.jobs[best.j]++;
  }
}

// ---------- Pigeons ----------
export const flyTime = S => T.fly * (1 + 0.25 * L(S, 'scare'));
export function waveSize(S, w = S.wave, pts = null) {
  const p = pts ?? Math.max(...DIRS.map(d => S.point[d]));
  const base = 3 + Math.floor(w * 0.7) + Math.floor(p / 4);
  return Math.min(S.phase >= 3 ? 48 : 30, S.phase >= 3 ? base + 6 : base);
}
export const pigeonHp = (S, w = S.wave) => T.hp[0] * Math.pow(T.hp[1], w);
export const featherDrop = (S, w = S.wave) => 1 + Math.floor(w / 4);
export const stealOf = S => Math.max(1, Math.floor(S.cakes * 0.02 * Math.pow(2 / 3, L(S, 'spikes'))));
// The side that has been pointed at most since the last wave is the side that thinks it was invited.
export function nextDir(S) { let best = 'N'; for (const d of DIRS) if (S.point[d] > S.point[best]) best = d; return best; }
const WAVE_NAMES = ['A polite queue', 'The early birds', 'The committee', 'A delegation in hats', 'The Thursday regulars', 'A coach party', 'The bell-ringers\' outing', 'The whole choir', 'Ottoline\'s cousins', 'A very large family'];
export const waveName = w => WAVE_NAMES[w % WAVE_NAMES.length];
function launch(S, out) {
  const dir = nextDir(S), n = waveSize(S), hp = pigeonHp(S);
  S.waveDir = dir;
  for (let i = 0; i < n; i++) S.spawn.push({ dir, at: i * 0.55, hp, max: hp, lane: (i % 5) - 2 + (Math.random() - 0.5) * 0.6, w: S.wave });
  out.push({ type: 'wave', dir, n, w: S.wave, name: waveName(S.wave) });
  S.wave++;
  S.point = { N: 0, E: 0, S: 0, W: 0 };
  S.waveT = S.phase >= 3 ? T.rushGap : T.waveGap;
}

// ---------- Time ----------
export function step(S, dt, out = []) {
  if (S.ended) return out;
  S.t += dt;
  if (L(S, 'foreman')) balance(S);
  const r = rates(S);
  for (const k of Object.keys(r)) S.ing[k] += r[k] * dt;
  // Assembly: whole sets of four become cupcakes.
  const sets = Math.floor(Math.min(...Object.values(S.ing)));
  if (sets > 0) {
    for (const k of Object.keys(S.ing)) S.ing[k] -= sets;
    const n = sets * perSet(S), room = CAP - S.made;
    const add = Math.min(n, room);
    S.made += add; S.cakes += add;
    out.push({ type: 'assemble', n: add });
  }
  if (S.phase === 1 && S.made >= PHASE2) { S.phase = 2; S.waveT = 14; out.push({ type: 'phase', phase: 2 }); }
  if (S.phase === 2 && S.made >= PHASE3) { S.phase = 3; S.waveT = Math.min(S.waveT, 8); out.push({ type: 'phase', phase: 3 }); }
  // Pigeons.
  if (S.phase >= 2) {
    S.waveT -= dt;
    if (S.waveT <= 0 && !S.spawn.length) launch(S, out);
    for (const s of S.spawn) s.at -= dt;
    while (S.spawn.length && S.spawn[0].at <= 0) { const s = S.spawn.shift(); S.pigeons.push({ dir: s.dir, p: 0, hp: s.hp, max: s.max, lane: s.lane, w: s.w }); }
    const ft = flyTime(S);
    // Guards blow at the pigeon closest to the sill.
    let dmg = guardDps(S) * dt;
    const live = S.pigeons.filter(p => p.hp > 0).sort((a, b) => b.p - a.p);
    for (const p of live) { if (dmg <= 0) break; const d = Math.min(dmg, p.hp); p.hp -= d; dmg -= d; }
    for (const p of S.pigeons) {
      if (p.hp <= 0) {
        if (!p.gone) { p.gone = true; const f = featherDrop(S, p.w); S.feathers += f; S.shooed++; out.push({ type: 'shoo', dir: p.dir, f, p: p.p, lane: p.lane }); }
        continue;
      }
      p.p += dt / ft;
      if (p.p >= 1) {
        p.gone = true; p.hp = 0; p.landed = true;
        const n = Math.min(S.cakes, stealOf(S));
        S.cakes -= n; S.stolen += n; S.landed++;
        out.push({ type: 'steal', dir: p.dir, n, lane: p.lane });
      }
    }
    S.pigeons = S.pigeons.filter(p => !p.gone);
  }
  if (S.made >= CAP) { S.ended = true; S.pigeons = []; S.spawn = []; out.push({ type: 'end' }); }
  return out;
}

// ---------- Formatting ----------
export function fmt(n) { return Math.floor(n).toLocaleString('en-US'); }
export function fmtShort(n) {
  if (n < 10) return (Math.round(n * 10) / 10).toString();
  if (n < 10000) return Math.round(n).toLocaleString('en-US');
  return (n / 1000).toFixed(n < 1e5 ? 1 : 0) + 'k';
}
