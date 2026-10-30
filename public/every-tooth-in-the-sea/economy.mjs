// Every Tooth in the Sea: the rules. index.html draws them; sim.mjs plays them headless.
//
// The number goes down: TOTAL teeth in the sea, minus every tooth Dewey has crowned. Crowns go on
// three ways: by hand (stop the pen on a grin), from the deck (a belt grid: shelf -> chewer ->
// press -> pen -> porthole), and, late on, from the clubs (crowned fish passing crowns on, which
// grows with how many are crowned already). Fish tip "Dr. Worm" for every tooth: doubloons.
// Lou calls an ink colour "in" every few minutes; crowns in that colour count triple.

export const TOTAL = 8.8e15;               // teeth in the sea (kept under 2^53 so the odometer is exact)
export const OFFLINE_CAP = 3 * 3600, OFFLINE_RATE = 0.1;
export const TREND_EVERY = 150;            // seconds between Lou's colour calls
export const INKS = [
  { id: 'blue', name: 'blue' }, { id: 'red', name: 'red' }, { id: 'green', name: 'green' }, { id: 'black', name: 'black' },
];
export const GRIDS = [[6, 4], [8, 5], [10, 6]]; // the deck, then the galley, then the captain's cabin
// Items on the deck. Inked crowns are INKED + colour.
export const PAGE = 1, PULP = 2, CROWN = 3, INKED = 4;
export const TOOLS = {
  belt:  { name: 'Belt',     base: 25,  g: 1.22, desc: 'Moves whatever is on it one square along, the way it points.' },
  shelf: { name: 'Shelf',    base: 400, g: 2.1, desc: 'A shelf of the library. Pushes out a page every tick. Dewey is sorry about the books.' },
  chew:  { name: 'Chewer',   base: 300, g: 2.1, desc: 'A bookworm cousin. A page goes in, pulp comes out. Anything else passes through.' },
  press: { name: 'Press',    base: 350, g: 2.1, desc: 'Presses pulp into a paper crown. Anything else passes through.' },
  pen:   { name: 'Pen',      base: 900, g: 2.1, desc: 'Inks a crown in the colour the four-colour pen is clicked to. In Lou\'s colour, it counts triple.' },
  port:  { name: 'Porthole', base: 200, g: 2.1, desc: 'Out to the reef. Every crown through it goes on a tooth. Takes things in from any side.' },
};
export const TOOL_ORDER = ['shelf', 'chew', 'press', 'pen', 'port', 'belt'];

export function newState() {
  return {
    crowned: 0, doub: 0, earned: 0, t: 0, hits: 0, bulls: 0, misses: 0, pages: 0,
    lv: {}, odd: {}, deck: false, pen4: false, clubs: false, final: false, ended: false,
    grid: null, gridN: 0, ink: 0, trend: 0, trendT: 0, trendN: 0, tick: 0,
    deckRate: 0, clubRate: 0, handC: 0, deckC: 0, clubC: 0, wasted: 0,
    seen: [], shopTab: 'up', lastSeen: Date.now(),
  };
}
export function load(raw) {
  const S = Object.assign(newState(), raw || {});
  S.lv = S.lv || {}; S.odd = S.odd || {}; S.seen = S.seen || [];
  if (S.ended) { S.deck = S.pen4 = S.clubs = S.final = true; S.crowned = TOTAL; S.gridN = 2; }
  if (S.deck && !S.grid) S.grid = starterGrid(S);
  if (S.grid) S.grid = fitGrid(S.grid, GRIDS[S.gridN]);
  return S;
}

const L = (S, id) => S.lv[id] || 0;
export const lvl = L;
export const left = S => Math.max(0, TOTAL - Math.floor(S.crowned));
export function phase(S) { return S.ended ? 5 : S.final ? 4 : S.clubs ? 3 : S.deck ? 2 : 1; }

// ---------- Derived numbers ----------
export function stats(S) {
  const tip = Math.pow(1.5, L(S, 'tips')) * (S.odd.plate ? 1.25 : 1);
  const hand = Math.pow(2, L(S, 'stencil')) * Math.pow(1.6, L(S, 'nib'));
  const zone = 0.2 + 0.035 * L(S, 'grin');               // share of the sweep that's an open grin
  const sweep = 1.5 * (1 + 0.15 * L(S, 'steady'));        // seconds for one pass across
  const front = 3 + 2 * L(S, 'front');                    // bullseye multiplier
  const tickT = 0.9 * Math.pow(0.86, L(S, 'belts'));      // seconds per deck tick
  const crownV = 6 * Math.pow(2, L(S, 'volumes')) * Math.pow(1.5, L(S, 'glue'));
  const clubR = S.clubs ? T.clubR * Math.pow(T.passM, L(S, 'pass')) * Math.pow(T.shoalM, L(S, 'shoals')) * (S.odd.float ? 1.1 : 1) : 0;
  return { tip, hand, zone, sweep, front, tickT, crownV, clubR };
}
// How much the ink is worth right now: plain crowns x1, inked in Lou's colour x3, off-trend x1.
export const inkMult = (S, ink) => (S.pen4 && ink === S.trend ? 3 : 1);

// ---------- Crowning ----------
function crown(S, n, src, out) {
  if (S.final || S.ended || n <= 0) return 0;
  const room = TOTAL - 1 - S.crowned;      // the last tooth is Lou's, and it's crowned by hand
  const got = Math.min(n, room);
  S.crowned += got;
  const d = got * stats(S).tip * (src === 'club' ? 0.5 : 1);
  S.doub += d; S.earned += d;
  if (src === 'hand') S.handC += got; else if (src === 'deck') S.deckC += got; else S.clubC += got;
  if (S.crowned >= TOTAL - 1) { S.final = true; out.push({ type: 'final' }); }
  return got;
}

// The page (or the sim) calls this when the player stops the pen: 'miss', 'hit' or 'bull'.
export function stop(S, quality, out = []) {
  if (S.ended) return 0;
  if (quality === 'miss') { S.misses++; return 0; }
  if (S.final) { S.hits++; S.ended = true; S.crowned = TOTAL; out.push({ type: 'end' }); return 1; }
  const st = stats(S);
  const n = st.hand * (quality === 'bull' ? st.front : 1) * inkMult(S, S.pen4 ? S.ink : -1);
  S.hits++; if (quality === 'bull') S.bulls++;
  return crown(S, n, 'hand', out);
}

// ---------- The deck ----------
const cell = (k, d = 0) => ({ k, d, it: 0 });
export function starterGrid(S) {
  const [w, h] = GRIDS[S.gridN || 0];
  const g = { w, h, c: Array(w * h).fill(null) };
  // A first line that already works, so the deck explains itself: shelf, chewer, press, belt, porthole.
  ['shelf', 'chew', 'press', 'belt', 'port'].forEach((k, i) => { g.c[i] = cell(k, 0); });
  return g;
}
function fitGrid(g, [w, h]) {
  if (g.w === w && g.h === h) return g;
  const n = { w, h, c: Array(w * h).fill(null) };
  for (let y = 0; y < Math.min(h, g.h); y++) for (let x = 0; x < Math.min(w, g.w); x++) n.c[y * w + x] = g.c[y * g.w + x];
  return n;
}
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up
export function count(S, k) { return S.grid ? S.grid.c.filter(c => c && c.k === k).length : 0; }
export function toolCost(S, k) { const t = TOOLS[k]; return Math.ceil(t.base * Math.pow(t.g, Math.max(0, count(S, k) - 1))); }
export function toolOpen(S, k) { return S.deck && (k !== 'pen' || S.pen4); }
export function place(S, i, k, d = 0) {
  if (!S.grid || S.grid.c[i] || !toolOpen(S, k)) return false;
  const cost = toolCost(S, k);
  if (S.doub < cost) return false;
  S.doub -= cost; S.grid.c[i] = cell(k, d);
  return true;
}
// Picking a tile up refunds what the last one of its kind cost.
export function remove(S, i) {
  const c = S.grid && S.grid.c[i];
  if (!c) return false;
  S.grid.c[i] = null;
  S.doub += toolCost(S, c.k);
  return true;
}
export function rotate(S, i) { const c = S.grid && S.grid.c[i]; if (c) c.d = (c.d + 1) % 4; }

function transform(k, it, ink) {
  if (k === 'chew' && it === PAGE) return PULP;
  if (k === 'press' && it === PULP) return CROWN;
  if (k === 'pen' && it === CROWN) return INKED + ink;
  return it;
}
// One tick of the belts. Every item moves at most one square; lines move together.
export function deckTick(S, out = []) {
  const g = S.grid; if (!g) return 0;
  const { w, h, c } = g, st = stats(S);
  let scored = 0;
  for (const t of c) if (t && t.k === 'shelf' && !t.it) { t.it = PAGE; S.pages += 1; }
  const moved = new Uint8Array(w * h);
  for (let pass = 0, any = true; any && pass < w * h; pass++) {
    any = false;
    for (let i = 0; i < c.length; i++) {
      const t = c[i];
      if (!t || !t.it || moved[i] || t.k === 'port') continue;
      const [dx, dy] = DIRS[t.d], x = i % w + dx, y = (i / w | 0) + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x, u = c[j];
      if (!u || u.k === 'shelf') continue;
      if (u.k === 'port') {
        const it = t.it; t.it = 0; moved[i] = 1; any = true;
        if (out.anim) out.push({ type: 'mv', a: i, b: j, it, gone: true });
        if (it >= CROWN) {
          const v = st.crownV * (it >= INKED ? inkMult(S, it - INKED) : 1);
          scored += crown(S, v, 'deck', out);
          out.push({ type: 'port', i: j, ink: it >= INKED ? it - INKED : -1 });
        } else { S.wasted++; out.push({ type: 'waste', i: j, it }); }
        continue;
      }
      if (u.it) continue;
      u.it = transform(u.k, t.it, S.ink); t.it = 0; moved[i] = moved[j] = 1; any = true;
      if (out.anim) out.push({ type: 'mv', a: i, b: j, it: u.it });
    }
  }
  S.tick++;
  return scored;
}

// ---------- Time ----------
let tickAcc = 0;
export function step(S, dt, out = []) {
  if (S.ended) return out;
  S.t += dt;
  const st = stats(S);
  if (S.pen4) {
    S.trendT += dt;
    if (S.trendT >= TREND_EVERY) {
      S.trendT = 0; S.trendN++;
      // A new colour every call, never the same twice running.
      S.trend = (S.trend + 1 + ((S.trendN * 7) % 3)) % 4;
      out.push({ type: 'trend', ink: S.trend });
    }
  }
  if (S.deck && !S.final) {
    tickAcc += dt;
    let got = 0;
    while (tickAcc >= st.tickT) { tickAcc -= st.tickT; got += deckTick(S, out); }
    S.deckRate += (got / dt - S.deckRate) * Math.min(1, dt / 20);
  }
  if (S.clubs && !S.final) {
    const n = S.crowned * st.clubR * dt;
    crown(S, n, 'club', out);
    S.clubRate = S.crowned * st.clubR;
  }
  return out;
}

// While away the deck and the clubs keep going, at a tenth of the speed, for up to three hours.
// Never all the way to the end: Lou's tooth is crowned by hand.
export function offline(S, secs) {
  if (S.ended || S.final || !S.deck || secs < 30) return null;
  const s = Math.min(secs, OFFLINE_CAP) * OFFLINE_RATE, st = stats(S), before = S.crowned, d0 = S.doub;
  const out = [];
  crown(S, Math.min(S.deckRate * s, TOTAL * 0.02), 'deck', out);
  if (S.clubs) crown(S, Math.min(S.crowned * (Math.exp(st.clubR * s) - 1), S.crowned * 2), "club", out);
  if (S.crowned >= TOTAL - 2) { S.crowned = TOTAL - 2; S.final = false; }
  return { secs: Math.min(secs, OFFLINE_CAP), teeth: S.crowned - before, doub: S.doub - d0 };
}

// ---------- The shop ----------
const geo = (base, g) => l => Math.ceil(base * Math.pow(g, l));
// Tuning knobs, so the sim can try prices without editing the lists.
export const T = {
  deck: 6e4, pen4: 6e5, galley: 1e8, cabin: 2e11, grinweek: 5e13,
  stencilG: 6, tipsG: 5.5, nibG: 7, volG: 6.5, glueG: 7, passG: 4, shoalG: 4.5, clubR: 0.002, passM: 1.13, shoalM: 1.12,
};
export const UPGRADES = [
  { id: 'stencil', name: 'Crown Stencil', max: 60, cost: l => geo(6, T.stencilG)(l), show: S => S.hits >= 3,
    desc: 'Each stop of the pen crowns twice as many teeth.' },
  { id: 'grin', name: 'Wider Grins', max: 6, cost: geo(25, 4.2), show: S => S.hits >= 6,
    desc: 'Tell a better joke first. The open part of the grin is wider.' },
  { id: 'tips', name: 'Gold-Leaf Edges', max: 40, cost: l => geo(40, T.tipsG)(l), show: S => S.earned >= 20,
    desc: 'Fancier crowns. The fish tip half as much again for every tooth.' },
  { id: 'steady', name: 'Steady Hand', max: 4, cost: geo(90, 6), show: S => S.misses >= 3 || S.earned >= 150,
    desc: 'The pen sweeps a little slower.' },
  { id: 'front', name: 'Front-Tooth Bonus', max: 6, cost: geo(160, 5.5), show: S => S.bulls >= 2,
    desc: 'Stop the pen dead on the front tooth (the dotted one) and the whole row gets crowned: more per level.' },
  { id: 'nib', name: 'Finer Nib', max: 30, cost: l => geo(2e4, T.nibG)(l), show: S => S.deck,
    desc: 'Smaller, neater crowns, more to a grin. Hand crowns go 1.6 times further.' },
  { id: 'volumes', name: 'Fatter Volumes', max: 60, cost: l => geo(2e3, T.volG)(l), show: S => S.deck,
    desc: 'Encyclopedias on the shelves. Every crown off the deck covers twice as many teeth.' },
  { id: 'belts', name: 'Greased Belts', max: 10, cost: geo(1.5e4, 5), show: S => S.deck && S.tick > 30,
    desc: 'The deck ticks faster.' },
  { id: 'glue', name: 'Fish-Glue Paste', max: 30, cost: l => geo(4e6, T.glueG)(l), show: S => S.gridN >= 1,
    desc: 'Stickier pulp. Deck crowns go 1.5 times further.' },
  { id: 'pass', name: 'Pass It On', max: 20, cost: l => geo(T.grinweek * 2, T.passG)(l), show: S => S.clubs,
    desc: 'Every crowned fish passes a few more crowns along. The clubs grow faster.' },
  { id: 'shoals', name: 'Shoal Rotas', max: 10, cost: l => geo(T.grinweek * 12, T.shoalG)(l), show: S => S.clubs && L(S, 'pass') >= 2,
    desc: 'Whole shoals take turns crowning each other. The clubs grow faster again.' },
];
// Keys open the next part of the game; odds are one-offs, mostly for the story.
export const ONEOFFS = [
  { id: 'plate', kind: 'odd', name: 'Dr. Worm Name Plate', cost: () => 120, show: S => S.earned >= 60,
    desc: 'A brass plate for the library door. Fish trust a plate. Tips go up a quarter.' },
  { id: 'floss', kind: 'odd', name: 'Floss Bunting', cost: () => 900, show: S => S.earned >= 400,
    desc: 'Strings of floss across the library. Does nothing. Very festive.' },
  { id: 'deck', kind: 'key', name: 'Open the Deck', cost: () => T.deck, show: S => S.earned >= T.deck * 0.25,
    desc: 'Clear the books off the main deck and lay belts. Crowns get made and sent out on their own: a shelf, a chewer, a press and a porthole, ready to go.' },
  { id: 'pen4', kind: 'key', name: 'The Four-Colour Pen', cost: () => T.pen4, show: S => S.deck && S.earned >= T.pen4 * 0.15,
    desc: 'The captain\'s own clicky pen: blue, red, green and black. Unlocks Pens on the deck and Lou\'s colour of the hour. Crowns in Lou\'s colour count triple, by hand too.' },
  { id: 'coat', kind: 'odd', name: 'A White Coat', cost: () => 2.5e5, show: S => S.pen4,
    desc: 'If they insist he\'s a dentist, he may as well look like one.' },
  { id: 'galley', kind: 'key', name: 'Knock Through to the Galley', cost: () => T.galley, show: S => S.pen4 && S.earned >= T.galley * 0.1,
    desc: 'A bigger deck: eight squares by five.' },
  { id: 'mail', kind: 'odd', name: 'Fan Mail', cost: () => 3e7, show: S => S.gridN >= 1,
    desc: 'Lou reads out letters addressed to "Dr. Worm, the Library". Some fish want a second crown.' },
  { id: 'cabin', kind: 'key', name: 'The Captain\'s Cabin', cost: () => T.cabin, show: S => S.gridN >= 1 && S.earned >= T.cabin * 0.05,
    desc: 'The biggest deck: ten squares by six.' },
  { id: 'request', kind: 'odd', name: 'The Request Line', cost: () => 2e10, show: S => S.gridN >= 2,
    desc: 'Dewey phones in a request. Lou says she only plays requests for winners.' },
  { id: 'grinweek', kind: 'key', name: 'Grin of the Week', cost: () => T.grinweek, show: S => S.gridN >= 2 && S.earned >= T.grinweek * 0.03,
    desc: 'Get a crowned grin on Lou\'s show. Once the sea sees one, the crowned fish stop being scared and start passing crowns on: the clubs, which grow with every tooth already crowned.' },
  { id: 'dentures', kind: 'odd', name: 'Lou\'s Tooth Fund', cost: () => 5e13, show: S => S.clubs,
    desc: 'A whip-round for Lou\'s wobbly tooth. She says she\'s fine. She is lisping.' },
  { id: 'float', kind: 'odd', name: 'A Tiny Float', cost: () => 4e15, show: S => S.clubs && S.crowned > TOTAL * 1e-3,
    desc: 'Somebody on the reef is building a parade float. Nobody will say what for. Clubs grow a tenth faster.' },
];
export const BY_ID = Object.fromEntries([...UPGRADES, ...ONEOFFS].map(u => [u.id, u]));

// Everything revealed and not yet bought. Once shown, never hidden again.
export function items(S) {
  const list = [];
  for (const u of UPGRADES) {
    const l = L(S, u.id);
    if (l >= u.max) continue;
    if (!S.seen.includes(u.id) && !u.show(S)) continue;
    list.push({ id: u.id, kind: 'lvl', name: u.name, desc: u.desc, cost: u.cost(l), l, max: u.max });
  }
  for (const u of ONEOFFS) {
    if (u.kind === 'key' ? S[u.id] || (u.id === 'grinweek' && S.clubs) || (u.id === 'galley' && S.gridN >= 1) || (u.id === 'cabin' && S.gridN >= 2) : S.odd[u.id]) continue;
    if (!S.seen.includes(u.id) && !u.show(S)) continue;
    list.push({ id: u.id, kind: u.kind, name: u.name, desc: u.desc, cost: u.cost() });
  }
  return list;
}
export function bought(S) {
  const list = [];
  for (const u of ONEOFFS) {
    const has = u.id === 'galley' ? S.gridN >= 1 : u.id === 'cabin' ? S.gridN >= 2 : u.id === 'grinweek' ? S.clubs : u.kind === 'key' ? S[u.id] : S.odd[u.id];
    if (has) list.push({ id: u.id, kind: u.kind, name: u.name, desc: u.desc });
  }
  for (const u of UPGRADES) if (L(S, u.id) >= u.max) list.push({ id: u.id, kind: 'lvl', name: u.name, desc: u.desc, max: u.max });
  return list;
}
export function buy(S, id, out = []) {
  const it = items(S).find(i => i.id === id);
  if (!it || S.doub < it.cost || S.ended) return false;
  S.doub -= it.cost;
  if (it.kind === 'lvl') S.lv[id] = L(S, id) + 1;
  else if (it.kind === 'odd') S.odd[id] = true;
  else if (id === 'galley' || id === 'cabin') { S.gridN = id === 'galley' ? 1 : 2; S.grid = fitGrid(S.grid, GRIDS[S.gridN]); }
  else {
    S[id === 'grinweek' ? 'clubs' : id] = true;
    if (id === 'deck') S.grid = starterGrid(S);
    if (id === 'pen4') { S.trend = 1; S.trendT = 0; }
  }
  out.push({ type: 'buy', id, kind: it.kind, name: it.name });
  return true;
}

// ---------- Numbers ----------
const NAMES = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toLocaleString('en-US');
  if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
  const k = Math.min(NAMES.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / Math.pow(1000, k);
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + NAMES[k];
}
export const fmtShort = n => n < 1e6 ? fmt(n) : fmt(n).replace(' million', 'M').replace(' billion', 'B').replace(' trillion', 'T').replace(' quadrillion', 'Qa');
