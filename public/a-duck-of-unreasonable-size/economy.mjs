// A Duck of Unreasonable Size: the rules, shared by the game and the pacing sim (sim.mjs).
// Pure state + actions. Anything the page should react to is pushed onto `out` as an event.

export const COLS = 6, ROWS = 5;            // the biggest the pond ever gets; cell index = y*COLS + x
export const FRONT = 0;                      // y = 0 is the row nearest the pier

let rnd = Math.random;
export const setRng = f => { rnd = f; };

// Each size is twice the rubber of the one before. Tips are coins per second, once the paint is dry.
// Paint is seconds of a free tentacle's time. Forms are what Clerk Juniper needs before that size is legal.
export const TIERS = [
  null,
  { name: 'Ducklet', tip: 0.07, paint: 0 },
  { name: 'Duck', tip: 0.18, paint: 3.8 },
  { name: 'Mallard-Class Duck', tip: 0.45, paint: 6, form: { code: '3-A', title: 'Declaration of Buoyancy', stamps: 3, legend: 0 } },
  { name: 'Dinghy Duck', tip: 1.1, paint: 9, form: { code: '7-B', title: 'Application to Exceed Bath Size', stamps: 5, legend: 0 } },
  { name: 'Galleon Duck', tip: 2.6, paint: 13.5, form: { code: '19-F', title: 'Registration of a Duck as a Vessel', stamps: 7, legend: 0 } },
  { name: 'Leviathan Duck', tip: 6, paint: 19.5, form: { code: '40-L', title: 'Permit to Displace the Tide', stamps: 10, legend: 12 } },
  { name: 'Colossal Duck', tip: 14, paint: 27, form: { code: '77-C', title: 'Certificate of Seaworthiness', stamps: 14, legend: 40 } },
  { name: 'Duck of Unreasonable Size', tip: 0, paint: 36, form: { code: 'Ω', title: 'Petition for a Duck of Unreasonable Size', stamps: 24, legend: 150 } },
];
export const TOP = 8;
// Postcards a launched duck sends home, by size.
export const POSTCARDS = [0, 0, 0, 1, 2, 3, 5, 8, 0];

// Forms that flip up from under a duck, or that the booth hands you. All of them are real, apparently.
export const SILLY_FORMS = [
  ['12-Q', 'Duck Is Technically a Lighthouse'], ['3-E', 'Notice of Excessive Squeak'],
  ['88-W', 'Waiver for Looking Smug'], ['5-Z', 'Report of a Duck Facing the Wrong Way'],
  ['61-K', 'Affidavit of Quack (Pending)'], ['9-S', 'Statement That the Moon Is Not a Duck'],
  ['14-H', 'Request to Wear a Small Hat'], ['33-T', 'Complaint from the Tide'],
];

// Coin upgrades: bought per run, lost when a Flotilla sails. `max` levels, cost per level.
export const UPGRADES = [
  { id: 'sign', name: 'Neon “DUCKS” Sign', desc: 'Tips ×1.3. Lo, the pier is lit.', cost: [10], show: S => S.earned >= 3 },
  { id: 'arms', name: 'Untie a Tentacle', desc: '+1 tentacle painting at once.', cost: [16, 70, 165, 360], show: S => S.everMerged >= 2 },
  { id: 'sac', name: 'Deeper Ink Sac', desc: 'Ink pot holds 3 more.', cost: [35, 130], show: S => S.earned >= 12 },
  { id: 'gym', name: 'Squid Calisthenics', desc: 'Ink refills 40% faster.', cost: [45, 180, 450], show: S => S.earned >= 18 },
  { id: 'crab', name: 'Apprentice Crab', desc: 'Drops a free ducklet into the pond every 7s.', cost: [60], show: S => S.earned >= 25 || S.flotillas > 0 },
  { id: 'dredge', name: 'Dredge the Pond', desc: 'One more column of pond.', cost: [80, 285], show: S => S.earned >= 35 || S.flotillas > 0 },
  { id: 'notary', name: 'Night-Shift Notary', desc: 'A crab who stamps a form every 3s, then faster.', cost: [100, 330], show: S => S.formsStamped >= 1 && S.earned >= 40 },
  { id: 'lights', name: 'Pier Lights', desc: 'Front-row ducks tip ×2 instead of ×1.5.', cost: [135], show: S => S.earned >= 60 },
  { id: 'rich', name: 'Richer Ink', desc: '35% of new ducklets come out a size bigger.', cost: [225], show: S => S.earned >= 100 },
  { id: 'tidy', name: 'Tidy Tentacle', desc: 'Squishes a matching pair by itself every 6s.', cost: [390], show: S => S.earned >= 180 },
  { id: 'sign2', name: 'Second Sign: “OPEN LATE”', desc: 'Tips ×1.5. It was always open late.', cost: [570], show: S => S.earned >= 260 },
];

// Postcard upgrades: permanent, bought with postcards from the far coasts.
export const RENOWN = [
  { id: 'pilgrims', name: 'Pilgrims', desc: 'Tourists come to see where the ducks are born. Tips ×1.3 per level.', cost: [4, 9, 16, 26, 40] },
  { id: 'pond', name: 'Harbour Lease', desc: 'One more row of pond, every run.', cost: [6, 20] },
  { id: 'brushes', name: 'Ancestral Brushes', desc: 'Start every run with 2 extra tentacles free.', cost: [8] },
  { id: 'seal', name: 'Seal of Good Standing', desc: 'Forms need 35% fewer stamps.', cost: [12] },
  { id: 'apprentices', name: 'Apprentices Return', desc: 'The Apprentice Crab and Notary are hired from the start.', cost: [15] },
  { id: 'marks', name: 'Lucky Marks', desc: 'Prizes flip up twice as often.', cost: [20] },
  { id: 'ink', name: 'Ink of the Deep', desc: 'Ink pot refills 60% faster, forever.', cost: [28] },
];

// Silly one-offs: bought once, ever. They plant the ending.
export const ONEOFFS = [
  { id: 'sail', name: 'Paint a Tiny Sail on One Duck', desc: 'It does nothing. It points out to sea.', cost: 8, show: S => S.earned >= 6 },
  { id: 'jeff', name: 'Name a Duck “Jeff”', desc: 'Jeff is not a size. Jeff is a feeling.', cost: 20, show: S => S.earned >= 25 },
  { id: 'frame', name: 'Frame Form 7-B', desc: 'Hang it in the shed. The “missed?” box is still blank.', cost: 35, show: S => !!S.reg[4] },
  { id: 'postcard', name: 'Buy a Postcard of Elsewhere', desc: 'A coast you have never seen. You keep it in your hat.', cost: 60, show: S => S.flotillas >= 1 },
  { id: 'hat', name: 'A Hat for Clerk Juniper', desc: 'Juniper wears it to work. Juniper does not mention it.', cost: 120, show: S => S.flotillas >= 2 },
  { id: 'shanty', name: 'Teach Barnaby a Sea Shanty', desc: 'It is about leaving. Barnaby sings it wrong on purpose.', cost: 200, show: S => S.flotillas >= 3 },
];

export const BOOTH_UNLOCK = 30;
export const boothCost = S => 12 + 3 * Math.min(10, S.pullsRun);

export function newState() {
  return {
    v: 1, time: 0, ended: false,
    coins: 0, earned: 0, ink: 4, inkT: 0,
    grid: Array(COLS * ROWS).fill(null),
    up: {}, ren: {}, odd: {}, reg: { 1: true, 2: true }, filed: {},
    legend: 0, postcards: 0, flotillas: 0, booth: false, pullsRun: 0,
    everMerged: 0, formsStamped: 0, best: 1, seq: 0, golden: 0,
    crabT: 0, notaryT: 0, tidyT: 0, censusT: 0, flotillaOpen: false,
    jubilee: false, plea: 0, seen: [], newly: [], phaseSeen: 1,
  };
}

// ---------- Derived numbers ----------
export const lvl = (S, id) => S.up[id] || 0;
export const rlvl = (S, id) => S.ren[id] || 0;
export const cols = S => 4 + lvl(S, 'dredge');
export const rows = S => 3 + rlvl(S, 'pond');
export const active = (S, i) => i >= 0 && i < COLS * ROWS && (i % COLS) < cols(S) && Math.floor(i / COLS) < rows(S);
export const cells = S => { const r = []; for (let i = 0; i < COLS * ROWS; i++) if (active(S, i)) r.push(i); return r; };
export const empties = S => cells(S).filter(i => !S.grid[i]);
export const arms = S => 2 + lvl(S, 'arms') + (rlvl(S, 'brushes') ? 2 : 0);
export const inkCap = S => 4 + 3 * lvl(S, 'sac');
export const inkRate = S => 0.3 * Math.pow(1.4, lvl(S, 'gym')) * (rlvl(S, 'ink') ? 1.6 : 1);
export const frontMult = S => (lvl(S, 'lights') ? 2 : 1.5);
export const tipMult = S => 0.6 * (lvl(S, 'sign') ? 1.3 : 1) * (lvl(S, 'sign2') ? 1.5 : 1) * Math.pow(1.3, rlvl(S, 'pilgrims'));
export const stampsFor = (S, n) => Math.max(1, Math.round(n * (rlvl(S, 'seal') ? 0.65 : 1)));
export const lootChance = S => 0.14 * (rlvl(S, 'marks') ? 2 : 1);
export const hasCrab = S => lvl(S, 'crab') > 0 || rlvl(S, 'apprentices') > 0;
export const notaryEvery = S => { const l = lvl(S, 'notary') + (rlvl(S, 'apprentices') ? 1 : 0); return l >= 2 ? 1.5 : l === 1 ? 3 : 0; };
export const ducks = S => S.grid.filter(c => c && c.k === 'duck');
export const isDry = c => c && c.k === 'duck' && !(c.wet > 0);
export function tipRate(S) {
  let r = 0;
  for (let i = 0; i < S.grid.length; i++) {
    const c = S.grid[i];
    if (isDry(c) && active(S, i)) r += TIERS[c.t].tip * (Math.floor(i / COLS) === FRONT ? frontMult(S) : 1);
  }
  return r * tipMult(S);
}
export const flotillaValue = S => ducks(S).reduce((a, c) => a + POSTCARDS[c.t], 0);
// The biggest size the paperwork currently allows.
export function legalTop(S) {
  let t = 2;
  while (t < TOP && TIERS[t + 1].form.legend <= S.legend) t++;
  return t;
}
export function phase(S) {
  if (S.ended || S.jubilee) return 4;
  if (S.legend >= TIERS[TOP].form.legend) return 3;
  if (S.flotillas > 0) return 2;
  return 1;
}

// ---------- Actions ----------
function place(S, i, cell) { S.grid[i] = cell; }
function newDuck(S, t, wet = 0) { return { k: 'duck', t, wet, seq: ++S.seq }; }
function backEmpty(S) {
  const e = empties(S); if (!e.length) return -1;
  e.sort((a, b) => Math.floor(b / COLS) - Math.floor(a / COLS) || a - b);
  return e[0];
}
function addCoins(S, n) { S.coins += n; S.earned += n; }

export function spawn(S, i, out = []) {
  if (S.ink < 1 || !active(S, i) || S.grid[i]) return false;
  S.ink -= 1;
  let t = 1;
  if (S.golden > 0) { t = Math.min(legalTop(S), 3); S.golden--; out.push({ type: 'golden', i }); }
  else if (lvl(S, 'rich') && rnd() < 0.35) t = 2;
  place(S, i, newDuck(S, t));
  out.push({ type: 'spawn', i, t });
  noteBest(S, t, out);
  return true;
}

export function move(S, from, to, out = []) {
  const a = S.grid[from];
  if (!a || !active(S, to) || from === to) return false;
  if (a.k !== 'duck') return false;
  const b = S.grid[to];
  if (!b) { S.grid[to] = a; S.grid[from] = null; out.push({ type: 'move', from, to }); return true; }
  if (b.k === 'duck' && b.t === a.t) return merge(S, from, to, out);
  if (b.k === 'duck') { S.grid[to] = a; S.grid[from] = b; out.push({ type: 'swap', from, to }); return true; }
  return false;
}

export function canMerge(S, a, b) {
  return a && b && a.k === 'duck' && b.k === 'duck' && a.t === b.t && a.t < TOP && isDry(a) && isDry(b) && !!S.reg[a.t + 1];
}

export function merge(S, from, to, out = []) {
  const a = S.grid[from], b = S.grid[to];
  if (!a || !b || a.t !== b.t || a.k !== 'duck' || b.k !== 'duck') return false;
  const t = a.t + 1;
  if (t > TOP) { out.push({ type: 'deny', reason: 'top', i: to }); return false; }
  if (!isDry(a) || !isDry(b)) { out.push({ type: 'deny', reason: 'wet', i: to }); return false; }
  if (!S.reg[t]) {
    const f = TIERS[t].form;
    out.push({ type: 'deny', reason: f.legend > S.legend ? 'legend' : 'form', t, i: to });
    fileForms(S, out);
    return false;
  }
  S.grid[from] = null;
  S.grid[to] = newDuck(S, t, TIERS[t].paint);
  S.everMerged++;
  out.push({ type: 'merge', i: to, t });
  noteBest(S, t, out);
  if (t < TOP && rnd() < lootChance(S)) loot(S, to, t, out);
  return true;
}

function noteBest(S, t, out) {
  if (t > S.best) { S.best = t; out.push({ type: 'best', t }); }
}

// A prize painted under the duck. Mostly nice. Sometimes paperwork.
function loot(S, i, t, out) {
  const r = rnd();
  if (r < 0.38) { const n = Math.max(2, Math.round(TIERS[t].tip * 25 * tipMult(S))); addCoins(S, n); out.push({ type: 'loot', kind: 'coins', n, i }); }
  else if (r < 0.58) { S.ink = Math.min(inkCap(S) + 3, S.ink + 3); out.push({ type: 'loot', kind: 'ink', i }); }
  else if (r < 0.78) {
    const j = backEmpty(S);
    if (j >= 0 && t > 2) { place(S, j, newDuck(S, t - 1)); out.push({ type: 'loot', kind: 'duck', t: t - 1, i: j }); }
    else { addCoins(S, 5); out.push({ type: 'loot', kind: 'coins', n: 5, i }); }
  }
  else if (r < 0.88) { S.golden++; out.push({ type: 'loot', kind: 'golden', i }); }
  else sillyForm(S, out, i);
}

function sillyForm(S, out, near) {
  const j = backEmpty(S);
  if (j < 0) { out.push({ type: 'loot', kind: 'nothing', i: near }); return; }
  const [code, title] = SILLY_FORMS[Math.floor(rnd() * SILLY_FORMS.length)];
  place(S, j, { k: 'form', code, title, left: stampsFor(S, 2), total: stampsFor(S, 2) });
  out.push({ type: 'form', i: j, code, title, silly: true });
}

// Juniper files the next size's form as soon as you could use it, if your Legend allows.
export function fileForms(S, out = []) {
  for (let t = 3; t <= TOP; t++) {
    if (S.reg[t] || S.filed[t]) continue;
    const f = TIERS[t].form;
    if (S.best < t - 1 || f.legend > S.legend) continue;
    const j = backEmpty(S);
    if (j < 0) { out.push({ type: 'noRoom', t }); return; }
    S.filed[t] = true;
    const n = stampsFor(S, f.stamps);
    place(S, j, { k: 'form', code: f.code, title: f.title, tier: t, left: n, total: n });
    out.push({ type: 'form', i: j, code: f.code, title: f.title, tier: t });
  }
}

export function stamp(S, i, out = []) {
  const c = S.grid[i];
  if (!c || c.k !== 'form') return false;
  c.left--;
  out.push({ type: 'stamp', i, left: c.left });
  if (c.left <= 0) {
    S.grid[i] = null; S.formsStamped++;
    if (c.tier) { S.reg[c.tier] = true; out.push({ type: 'registered', t: c.tier, code: c.code, i }); }
    else { const n = 3 + S.flotillas * 2; addCoins(S, n); out.push({ type: 'filed', code: c.code, n, i }); }
  }
  return true;
}

export function buy(S, id, out = []) {
  const u = UPGRADES.find(u => u.id === id);
  if (u) {
    const l = lvl(S, id); if (l >= u.cost.length || S.coins < u.cost[l]) return false;
    S.coins -= u.cost[l]; S.up[id] = l + 1;
    if (id === 'sac') S.ink += 3;
    out.push({ type: 'buy', id, name: u.name, level: l + 1 });
    return true;
  }
  const o = ONEOFFS.find(o => o.id === id);
  if (o) {
    if (S.odd[id] || S.coins < o.cost) return false;
    S.coins -= o.cost; S.odd[id] = true;
    out.push({ type: 'buy', id, name: o.name, oneoff: true });
    return true;
  }
  if (id === 'booth') {
    if (S.booth || S.coins < BOOTH_UNLOCK) return false;
    S.coins -= BOOTH_UNLOCK; S.booth = true;
    out.push({ type: 'buy', id, name: 'Hook-a-Duck Booth' });
    return true;
  }
  const r = RENOWN.find(r => r.id === id);
  if (r) {
    const l = rlvl(S, id); if (l >= r.cost.length || S.postcards < r.cost[l]) return false;
    S.postcards -= r.cost[l]; S.ren[id] = l + 1;
    out.push({ type: 'buy', id, name: r.name, level: l + 1, renown: true });
    return true;
  }
  return false;
}

// Barnaby's booth: pay, hook a duck, see what's painted underneath.
export function hook(S, out = []) {
  const cost = boothCost(S);
  if (!S.booth || S.coins < cost) return false;
  const j = backEmpty(S);
  if (j < 0) { out.push({ type: 'deny', reason: 'full' }); return false; }
  S.coins -= cost; S.pullsRun++;
  const r = rnd(), top = Math.min(5, legalTop(S));
  if (r < 0.14) { sillyForm(S, out, j); out.push({ type: 'hook', kind: 'form' }); return true; }
  const t = r < 0.44 ? 2 : r < 0.72 ? 3 : r < 0.9 ? 4 : 5;
  const tt = Math.min(t, top);
  place(S, j, newDuck(S, tt));
  out.push({ type: 'hook', kind: 'duck', t: tt, i: j, jackpot: t >= 5 && tt === 5 });
  noteBest(S, tt, out);
  return true;
}

// The pond is full of vessels; harbour code says vessels go to sea.
export function launch(S, out = []) {
  if (!S.flotillaOpen) return false;
  const n = flotillaValue(S);
  if (n < 1) return false;
  const sent = ducks(S).map(c => c.t);
  S.postcards += n; S.legend += n; S.flotillas++;
  S.grid = Array(COLS * ROWS).fill(null);
  S.coins = 0; S.up = {}; S.ink = inkCap(S); S.pullsRun = 0; S.golden = 0;
  S.crabT = S.notaryT = S.tidyT = S.censusT = 0;
  // Unfinished, unregistered forms go back in Juniper's drawer; filed tier forms come back when needed.
  for (const t in S.filed) if (!S.reg[t]) delete S.filed[t];
  out.push({ type: 'launch', n, sent, legend: S.legend });
  fileForms(S, out);
  return true;
}

// The final sail-away has to be argued through, three times.
export function sail(S, out = []) {
  if (!S.jubilee || S.ended) return false;
  S.plea++;
  out.push({ type: 'plea', n: S.plea });
  if (S.plea >= 4) { S.ended = true; out.push({ type: 'end' }); }
  return true;
}

// ---------- Time ----------
export function tick(S, dt, out = []) {
  if (S.ended) return out;
  S.time += dt;
  // Ink refills.
  if (S.ink < inkCap(S)) S.ink = Math.min(inkCap(S), S.ink + inkRate(S) * dt);
  // Paint dries, a few tentacles at a time, oldest first.
  const wet = [];
  for (let i = 0; i < S.grid.length; i++) { const c = S.grid[i]; if (c && c.k === 'duck' && c.wet > 0) wet.push([c.seq, i]); }
  wet.sort((a, b) => a[0] - b[0]);
  const n = Math.min(arms(S), wet.length);
  for (let k = 0; k < n; k++) {
    const i = wet[k][1], c = S.grid[i];
    c.wet -= dt;
    if (c.wet <= 0) {
      c.wet = 0; out.push({ type: 'dry', i, t: c.t });
      if (c.t === TOP && !S.jubilee) { S.jubilee = true; out.push({ type: 'jubilee', i }); }
      if (c.t >= 5 && !S.flotillaOpen) { S.flotillaOpen = true; out.push({ type: 'flotillaOpen' }); }
    }
  }
  // Tips.
  const tips = tipRate(S) * dt;
  if (tips > 0) addCoins(S, tips);
  // Helpers.
  if (hasCrab(S)) {
    S.crabT += dt;
    if (S.crabT >= 7) {
      S.crabT = 0;
      const j = backEmpty(S);
      if (j >= 0) { place(S, j, newDuck(S, lvl(S, 'rich') && rnd() < 0.35 ? 2 : 1)); out.push({ type: 'spawn', i: j, t: 1, crab: true }); }
    }
  }
  const ne = notaryEvery(S);
  if (ne) {
    S.notaryT += dt;
    if (S.notaryT >= ne) {
      S.notaryT = 0;
      const f = S.grid.findIndex((c, i) => c && c.k === 'form' && active(S, i));
      if (f >= 0) stamp(S, f, out);
    }
  }
  if (lvl(S, 'tidy')) {
    S.tidyT += dt;
    if (S.tidyT >= 6) {
      S.tidyT = 0;
      const p = findPair(S);
      if (p) { out.push({ type: 'tidy' }); merge(S, p[0], p[1], out); }
    }
  }
  // The duck census, every couple of minutes once the pond is busy.
  if (ducks(S).length >= 8) {
    S.censusT += dt;
    if (S.censusT >= 110) {
      S.censusT = 0;
      const j = backEmpty(S);
      if (j >= 0) { const k = stampsFor(S, 2); place(S, j, { k: 'form', code: '2-D', title: 'Duck Census', left: k, total: k }); out.push({ type: 'form', i: j, code: '2-D', title: 'Duck Census', census: true }); }
    }
  }
  fileForms(S, out);
  return out;
}

// The smallest matching dry pair whose next size is legal; prefers merging into the front row.
export function findPair(S, maxT = TOP - 1) {
  const by = {};
  for (const i of cells(S)) {
    const c = S.grid[i];
    if (isDry(c) && c.t <= maxT && S.reg[c.t + 1]) (by[c.t] = by[c.t] || []).push(i);
  }
  for (let t = 1; t < TOP; t++) {
    const l = by[t]; if (!l || l.length < 2) continue;
    l.sort((a, b) => Math.floor(b / COLS) - Math.floor(a / COLS)); // back rows first
    return [l[0], l[l.length - 1]];                                   // back one onto the frontmost
  }
  return null;
}

// Merge a save over defaults (older saves may lack newer fields).
export function load(raw) {
  const S = newState();
  if (!raw) return S;
  Object.assign(S, raw);
  if (!Array.isArray(S.grid) || S.grid.length !== COLS * ROWS) S.grid = Array(COLS * ROWS).fill(null);
  return S;
}
