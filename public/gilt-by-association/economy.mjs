// Gilt by Association: the rules. index.html draws them; sim.mjs plays them headless.
//
// Gold leaf is real gold beaten so thin it sticks to whatever bites it. Quarto nibbles it off book
// spines (one tap, one bite, a few trillion atoms) and wears it on his teeth. Three shelves, each its
// own small economy: foil from the paperbacks, gold leaf from the encyclopedias, then pigment from
// fans in the rare-books room. The library keeps hours: worms chew by night and gossip by day, and
// the day's gossip brings cousins (later fans) at closing time. The library only has so much gilt.

export const CYCLE = 120, NIGHT = 80;           // seconds: 80 s of night, 40 s of library hours
export const OFFLINE_CAP = 4 * 3600, OFFLINE_RATE = 0.1;
export const ATOMS_PER_GRAM = 3.06e21;            // gold, 197 g/mol
export const LIBRARY_GILT = 6.1e21;               // every gilt letter in the library: about two grams
export const RIVAL = [0, 64, 4500, 700000];        // the grin Quarto has to beat on each shelf
export const SLOTS = 16;                          // 0-7 upper teeth, 8-15 lower teeth

// Tunables (the sim can override them with --T='{"k":v}').
export const T = {
  bite: 2e12,          // atoms per bite on the paperbacks (foil)
  goldBite: 2e13,      // atoms per bite on the encyclopedias
  silver: 1.4e12,      // foil per second per silverfish
  cousinFoil: 4e12,    // foil per second per cousin, at night
  cousinGold: 1e13,    // gold per second per cousin, at night
  gTap: 1,             // gossip per whisper
  gPass: 0.06,         // gossip per second by day, per sqrt(grin)
  cBase: 6, cGrow: 1.22,   // gossip for the next cousin
  fBase: 12, fGrow: 1.035,  // gossip for the next fan
  smile: 5e12,         // pigment per smile, per grin
  tribute: 3e11,     // pigment per second per fan per grin, at night
  fanChew: 6e14,       // gilt a fan chews per second at night, for their own grin
  beetle: 3e13,        // gold per second per deathwatch beetle, at night
  headshot: 3e11,      // pigment per second per headshot handed out, per grin
  craze: 0.055,        // fans' growth per second during the craze
};

// ---------- Pieces for the teeth ----------
export const PIECES = {
  foil:  { name: 'Foil Cap',      base: 2,   cur: 'foil', foil: true },
  fstar: { name: 'Foil Star',     base: 5,   cur: 'foil', foil: true },
  gold:  { name: 'Gold Cap',      base: 30,  cur: 'gold', cap: true },
  stud:  { name: 'Gold Stud',     base: 55,  cur: 'gold' },
  mono:  { name: 'Q Monogram',    base: 90,  cur: 'gold', cap: true },
  verd:  { name: 'Verdigris Gem', base: 300, cur: 'pig', gem: true },
  rose:  { name: 'Rose Madder',   base: 520, cur: 'pig', gem: true },
  orp:   { name: 'Orpiment',      base: 900, cur: 'pig', gem: true },
};

export function newState() {
  return {
    phase: 1, t: 0, clock: 0, night: 1, taps: 0,
    foil: 0, gold: 0, pig: 0, gossip: 0, cousins: 0, fans: 0,
    pool: LIBRARY_GILT, eaten: 0, bites: 0,
    lv: {}, odd: {}, bought: {},
    mouth: Array(SLOTS).fill(null), held: null,
    spine: 0, letters: 0, revealed: false, beat: 0, climbReady: 0, craze: false, crazeT: 0,
    ended: false, seen: [], shopTab: 'foil', lastSeen: Date.now(), peak: 0, joinedTonight: 0,
  };
}
export function load(raw) {
  const S = Object.assign(newState(), raw || {});
  for (const k of ['lv', 'odd', 'bought']) S[k] = S[k] || {};
  if (!Array.isArray(S.mouth) || S.mouth.length !== SLOTS) S.mouth = Array(SLOTS).fill(null);
  if (S.ended) { S.phase = 3; S.pool = 0; S.craze = true; if (!S.mouth.some(Boolean)) S.mouth = finishedMouth(); S.fans = Math.max(S.fans, 10482); }
  return S;
}
// The mouth of a finished game, for a save of just { ended: true }.
export function finishedMouth() {
  return ['gold', 'gold', 'gold', 'mono', 'gold', 'gold', 'gold', 'gold', 'orp', 'rose', 'orp', 'orp', 'orp', 'rose', 'orp', 'orp'];
}

const L = (S, id) => S.lv[id] || 0;
export const lvl = L;
export const isNight = S => S.clock < NIGHT;
export const open = S => S.phase === 1 ? [2, 3, 4, 5] : S.phase === 2 ? [0, 1, 2, 3, 4, 5, 6, 7] : [...Array(SLOTS).keys()];
export const rival = S => RIVAL[S.phase];

// ---------- The grin ----------
// One rule per shelf: matching foil side by side shines; a run of gold caps is a grill; a gem set
// under a gold cap counts double.
export function toothValues(S, mouth = S.mouth) {
  const v = Array(SLOTS).fill(0);
  for (let i = 0; i < SLOTS; i++) {
    const p = mouth[i]; if (!p) continue;
    const P = PIECES[p]; let x = P.base;
    const row = i < 8 ? 0 : 8, col = i - row;
    if (P.foil) {
      const same = (col > 0 && mouth[i - 1] === p) || (col < 7 && mouth[i + 1] === p);
      if (same) x += 1.5;
      if (S.revealed) x *= 0.5;
    }
    if (P.cap) {
      let a = col, b = col;
      while (a > 0 && PIECES[mouth[row + a - 1]]?.cap) a--;
      while (b < 7 && PIECES[mouth[row + b + 1]]?.cap) b++;
      x *= 1 + 0.25 * (b - a);
    }
    if (P.gem && row === 8 && PIECES[mouth[col]]?.cap) x *= 2;
    v[i] = x;
  }
  return v;
}
export function grinMult(S) {
  return Math.pow(1.5, L(S, 'shine')) * Math.pow(1.45, L(S, 'gloss')) * Math.pow(1.4, L(S, 'pose'))
    * (S.odd.mirror ? 1.1 : 1) * (S.odd.floss ? 1.15 : 1) * (S.odd.sign ? 1.25 : 1);
}
export function grin(S, mouth = S.mouth) {
  return toothValues(S, mouth).reduce((a, b) => a + b, 0) * grinMult(S);
}
// What placing a piece on each open tooth would do to the grin.
export function previews(S, piece) {
  const now = grin(S), out = {};
  for (const i of open(S)) { const m = S.mouth.slice(); m[i] = piece; out[i] = grin(S, m) - now; }
  return out;
}
export function bestSlot(S, piece) {
  const p = previews(S, piece); let best = -1, bv = -Infinity;
  for (const [i, d] of Object.entries(p)) if (d > bv) { bv = d; best = Number(i); }
  return best;
}

// ---------- Derived numbers ----------
export function stats(S) {
  const jaw = Math.pow(1.9, L(S, 'jaw'));
  const vols = Math.pow(1.5, L(S, 'vol'));
  const glasses = Math.pow(1.6, L(S, 'glasses'));
  const g = grin(S);
  return {
    g, jaw, vols,
    bite: S.phase === 1 ? T.bite * jaw : T.goldBite * vols * (S.odd.ladder ? 2 : 1),
    beetle: T.beetle * vols * Math.pow(1.5, L(S, 'varnish')),
    headshot: T.headshot * g * Math.pow(1.6, L(S, 'rope')),
    silver: T.silver * Math.pow(1.6, L(S, 'crumbs')),
    cousinFoil: T.cousinFoil * Math.pow(1.6, L(S, 'crumbs')),
    cousinGold: T.cousinGold * glasses * vols * (S.odd.ladder ? 1.5 : 1),
    whisper: T.gTap * Math.pow(2, L(S, 'whisper')) * Math.pow(1.8, L(S, 'margin')),
    passive: T.gPass * Math.sqrt(Math.max(1, g)) * Math.pow(1.8, L(S, 'margin')) * (S.odd.column ? 1.5 : 1),
    smile: T.smile * g * Math.pow(1.7, L(S, 'practice')),
    tribute: T.tribute * g * Math.pow(1.6, L(S, 'rope')) * (S.odd.table ? 2 : 1),
    club: Math.pow(1.5, L(S, 'club')),
  };
}
// Gossip needed for the next recruit (cousins on the first two shelves, fans on the third).
export function nextCost(S) {
  return S.phase < 3 ? T.cBase * Math.pow(T.cGrow, S.cousins) : T.fBase * Math.pow(T.fGrow, S.fans) / stats(S).club;
}
export function pending(S) {
  let n = 0, g = S.gossip, c = S.phase < 3 ? S.cousins : S.fans;
  const save = S.phase < 3 ? 'cousins' : 'fans';
  const was = S[save];
  while (n < 500) { const k = nextCost(S); if (g < k) break; g -= k; n++; S[save]++; }
  S[save] = was;
  return { n, left: g, c };
}

// Rates right now, for the HUD (per second).
export function rates(S) {
  const st = stats(S), night = isNight(S) && !S.ended;
  const r = { foil: 0, gold: 0, pig: 0, gossip: 0, drain: 0 };
  if (night) {
    const silver = (S.lv.silver || 0) * st.silver;
    if (S.phase === 1) r.foil = silver + S.cousins * st.cousinFoil;
    else { r.foil = silver; r.gold = S.cousins * st.cousinGold + (S.lv.beetle || 0) * st.beetle; }
    if (S.phase === 3) { r.pig = S.fans * st.tribute + (S.lv.headshot || 0) * st.headshot; r.drain = S.fans * T.fanChew * (S.craze ? 6 : 1); }
  } else if (!S.ended) r.gossip = st.passive;
  r.gold = Math.min(r.gold, S.pool);
  return r;
}

// ---------- Actions ----------
// The one tap: a bite by night (a smile, on the last shelf), a whisper by day.
export function tap(S, out = []) {
  if (S.ended) return null;
  const st = stats(S);
  S.taps++;
  if (!isNight(S)) { S.gossip += st.whisper; return { kind: 'whisper', n: st.whisper }; }
  if (S.phase === 3) { const n = st.smile; S.pig += n; return { kind: 'smile', n }; }
  const n = Math.min(st.bite, S.phase === 2 ? S.pool : Infinity);
  if (S.phase === 1) S.foil += n; else { S.gold += n; S.pool -= n; S.eaten += n; }
  S.bites++;
  // A spine has twelve letters; each bite takes a little of one. Every 6 bites a letter goes.
  S.letters++;
  if (S.letters >= 6 * 12) { S.letters = 0; S.spine++; out.push({ type: 'spine', n: S.spine }); }
  return { kind: 'bite', n };
}

// ---------- The shop ----------
const DECO = (id, piece, base, grow, show, desc) => ({ id, kind: 'deco', piece, cur: PIECES[piece].cur, base, grow, show, name: PIECES[piece].name, desc });
export const ITEMS = [
  // Shelf one: the paperbacks. Foil.
  DECO('foil', 'foil', 16000000000000.0, 1.55, S => S.taps >= 3, 'A cap of shiny paperback foil, pressed on with a very small tongue. Two the same side by side shine more.'),
  { id: 'jaw', kind: 'lvl', cur: 'foil', base: 30000000000000.0, grow: 3.4, max: 12, show: S => S.foil >= 1e13 || S.lv.jaw, name: 'Sharper Mandibles', desc: 'Grind your mandibles on a staple. Every bite takes almost twice as much.' },
  { id: 'silver', kind: 'count', cur: 'foil', base: 50000000000000.0, grow: 1.22, max: 60, show: S => S.foil >= 3e13 || S.lv.silver, name: 'Silverfish Lodger', desc: 'A silverfish moves into your book and pays the rent in foil it chews off the paperbacks at night. Silverfish don\'t care about grins. They care about rent.' },
  DECO('fstar', 'fstar', 400000000000000.0, 2.4, S => S.foil >= 6e13 || S.bought.foil >= 2, 'A little foil star for the middle of a tooth. Very bottom shelf. Very brave. Two the same side by side shine more.'),
  { id: 'shine', kind: 'lvl', cur: 'foil', base: 1200000000000000.0, grow: 7, max: 3, show: S => S.bought.foil >= 1 || S.bought.fstar >= 1, name: 'Spit-shine', desc: 'Polish every tooth with worm spit. Grin ×1.5.' },
  { id: 'whisper', kind: 'lvl', cur: 'foil', base: 200000000000000.0, grow: 3.4, max: 5, show: S => S.night >= 2 || S.gossip > 0, name: 'Stage Whisper', desc: 'A whisper you can hear three books away. Each daytime tap spreads twice the gossip.' },
  { id: 'crumbs', kind: 'lvl', cur: 'foil', base: 900000000000000.0, grow: 3.6, max: 6, show: S => S.cousins >= 2 || (S.lv.silver || 0) >= 4, name: 'Crumb Rations', desc: 'Pay the help in eraser crumbs. Silverfish and cousins chew foil 1.6× faster.' },
  { id: 'lend', kind: 'odd', cur: 'foil', base: 400000000000000.0, show: S => S.cousins >= 1, name: 'Lend Mabel a Fleck', desc: 'Your cousin Mabel asked where you get your foil. Lend her a fleck. She won\'t copy you. She says.' },
  { id: 'mirror', kind: 'odd', cur: 'foil', base: 3000000000000000.0, show: S => S.bought.fstar >= 1, name: 'A Sliver of Mirror', desc: 'From a broken compact in the lost property box. Finally, you can see your own grin. Grin ×1.1.' },

  // Shelf two: the encyclopedias. Real gold leaf.
  DECO('gold', 'gold', 2000000000000000.0, 1.5, S => S.phase >= 2, 'Real gold leaf, from a real encyclopedia, on a real tooth. Gold caps side by side make a grill: each one shines more for every cap in its run.'),
  { id: 'vol', kind: 'lvl', cur: 'gold', base: 8000000000000000.0, grow: 4, max: 8, show: S => S.phase >= 2, name: 'Next Volume', desc: 'Move along the shelf to the next volume of the encyclopedia. The titles get longer. Bites and cousins ×1.6.' },
  { id: 'glasses', kind: 'lvl', cur: 'gold', base: 2e+16, grow: 4.4, max: 8, show: S => S.phase >= 2 && S.cousins >= 1, name: 'Reading Glasses', desc: 'Tiny glasses for the cousins, so they can find the gilt in the dark. Cousins chew twice as much gold.' },
  DECO('stud', 'stud', 5e+16, 1.8, S => S.phase >= 2 && S.bought.gold >= 2, 'A gold stud. Shines more than a cap on its own, but it isn\'t a cap, so it breaks up a grill.'),
  { id: 'beetle', kind: 'count', cur: 'gold', base: 3e15, grow: 1.2, max: 50, show: S => S.phase >= 2 && S.bought.gold >= 1, name: 'Deathwatch Beetle', desc: 'A beetle from the wainscot who taps in the night and eats gilt for a living. Works for gold. Doesn\'t gossip, which is frankly suspicious.' },
  { id: 'varnish', kind: 'lvl', cur: 'gold', base: 1e17, grow: 5, max: 5, show: S => S.phase >= 2 && (S.lv.beetle || 0) >= 3, name: 'Shell Polish', desc: 'Buff the beetles\' shells until they shine. They feel valued. Beetles chew 1.5× faster.' },
  { id: 'gloss', kind: 'lvl', cur: 'gold', base: 1e+17, grow: 3.5, max: 5, show: S => S.phase >= 2 && S.bought.gold >= 1, name: 'Lip Gloss', desc: 'Lip gloss scraped off a library card. Frames the teeth. Grin ×1.45.' },
  { id: 'margin', kind: 'lvl', cur: 'gold', base: 5e+16, grow: 4.5, max: 5, show: S => S.phase >= 2 && S.night >= 3, name: 'Margin Notes', desc: 'Scribble gossip in the margins, where every worm reads it. Daytime gossip ×1.8.' },
  DECO('mono', 'mono', 6e+17, 1, S => S.phase >= 2 && S.bought.gold >= 4, 'A Q, in gold, on one tooth. For Quarto. It counts as a cap, so it fits into a grill.'),
  { id: 'ladder', kind: 'odd', cur: 'gold', base: 6e+17, show: S => S.phase >= 2 && (S.lv.vol || 0) >= 2, name: 'The Library Ladder', desc: 'The rolling ladder to the top shelf, where the gilt is thickest. Bites ×3, cousins ×1.5.' },
  { id: 'floss', kind: 'odd', cur: 'gold', base: 2e+17, show: S => S.phase >= 2 && S.bought.gold >= 3, name: 'Gold Floss', desc: 'A single thread pulled from a bookmark ribbon. Between every tooth. Grin ×1.15.' },
  { id: 'column', kind: 'odd', cur: 'gold', base: 8e+17, show: S => S.phase >= 2 && S.cousins >= 6, name: 'An Interview', desc: 'Give Madame Marginalia an exclusive for The Spine. Daytime gossip ×1.5.' },
  { id: 'teach', kind: 'odd', cur: 'gold', base: 4e+18, show: S => S.phase >= 2 && S.cousins >= 10, name: 'Teach a Cousin to Gild', desc: 'Show your cousin Folio how to press gold leaf onto a tooth. Just the one cousin. Just this once.' },

  // Shelf three: the rare-books room. Pigment, from fans.
  DECO('verd', 'verd', 3e+18, 1.75, S => S.phase >= 3, 'A flake of verdigris from a manuscript border, set on a lower tooth. Set it under a gold cap and it counts double.'),
  { id: 'practice', kind: 'lvl', cur: 'pig', base: 2e+19, grow: 5, max: 8, show: S => S.phase >= 3, name: 'Practise in the Mirror', desc: 'Practise the smile in the glass of the case. Every smile collects 1.7× the pigment.' },
  { id: 'rope', kind: 'lvl', cur: 'pig', base: 3e+19, grow: 5, max: 8, show: S => S.phase >= 3 && S.fans >= 1, name: 'Velvet Rope', desc: 'A rope of red bookbinding thread. Fans queue for longer and leave more pigment. Tribute ×1.6.' },
  DECO('rose', 'rose', 6e+19, 1.75, S => S.phase >= 3 && S.bought.verd >= 2, 'Rose madder, from an illuminated rose. Set it under a gold cap and it counts double.'),
  { id: 'headshot', kind: 'count', cur: 'pig', base: 1e19, grow: 1.16, max: 50, show: S => S.phase >= 3, name: 'Signed Headshot', desc: 'A portrait of your grin, chewed into a page corner and signed with a wiggle. Fans trade pigment for them all night. The better the grin, the more they pay.' },
  { id: 'club', kind: 'lvl', cur: 'pig', base: 6e+19, grow: 5, max: 6, show: S => S.phase >= 3 && S.fans >= 3, name: 'Fan Club', desc: 'Membership cards, newsletters, a secret wiggle. Gossip brings fans 1.5× more easily.' },
  { id: 'pose', kind: 'lvl', cur: 'pig', base: 2e+20, grow: 6.5, max: 5, show: S => S.phase >= 3 && S.bought.verd >= 1, name: 'The Pose', desc: 'Chin up, mandibles out, three-quarter profile. Grin ×1.4.' },
  DECO('orp', 'orp', 1.5e+21, 1.8, S => S.phase >= 3 && S.bought.rose >= 2, 'Orpiment: gold-coloured, a bit poisonous, terribly chic. Set it under a gold cap and it counts double.'),
  { id: 'table', kind: 'odd', cur: 'pig', base: 1.5e+21, show: S => S.phase >= 3 && S.fans >= 12, name: 'A Signing Table', desc: 'An eraser, turned on its side. Fans leave twice the tribute.' },
  { id: 'sign', kind: 'odd', cur: 'pig', base: 6e+21, show: S => S.phase >= 3 && (S.lv.pose || 0) >= 1, name: 'A Neon Sign', desc: 'Your grin, in pink and gold tube, hung from the reading lamp. It is very bright. Grin ×1.25.' },
  { id: 'fleck', kind: 'odd', cur: 'pig', base: 2e+22, show: S => S.phase >= 3 && S.fans >= 30, name: 'Send Isadora a Fleck', desc: 'One fleck of real gold, by silverfish courier, to the glass case. No note. She\'ll know.' },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export function cost(S, it) {
  if (it.kind === 'odd') return it.base;
  const n = it.kind === 'deco' ? (S.bought[it.id] || 0) : L(S, it.id);
  return it.base * Math.pow(it.grow, n);
}
function owned(S, it) {
  if (it.kind === 'odd') return !!S.odd[it.id];
  if (it.kind === 'deco') return it.id === 'mono' && (S.bought.mono || 0) >= 1;
  return L(S, it.id) >= it.max;
}
// Everything that has turned up and isn't sold out. Once seen, it stays until bought.
export function items(S) {
  return ITEMS.filter(it => !owned(S, it) && (S.seen.includes(it.id) || it.show(S)))
    .map(it => ({ ...it, cost: cost(S, it), l: it.kind === 'deco' ? (S.bought[it.id] || 0) : L(S, it.id) }));
}
export const have = (S, cur) => S[cur];

export function buy(S, id, out = []) {
  const it = ITEM[id]; if (!it || S.ended || owned(S, it)) return false;
  const c = cost(S, it);
  if (S[it.cur] < c) return false;
  S[it.cur] -= c;
  if (it.kind === 'odd') S.odd[id] = 1;
  else if (it.kind === 'deco') {
    S.bought[id] = (S.bought[id] || 0) + 1;
    if (S.held) dropHeld(S);  // whatever you were holding goes on first
    S.held = it.piece;
  } else S.lv[id] = L(S, id) + 1;
  out.push({ type: 'buy', id, name: it.name });
  return true;
}
// Put the held piece on a tooth. A piece already there comes off into your hand (to place again).
export function place(S, i) {
  if (!S.held || !open(S).includes(i)) return false;
  const old = S.mouth[i];
  S.mouth[i] = S.held;
  S.held = old && old !== S.held ? old : null;
  return true;
}
// Pick a piece off a tooth to move it.
export function pick(S, i) {
  if (S.held || !S.mouth[i] || !open(S).includes(i)) return false;
  S.held = S.mouth[i]; S.mouth[i] = null; return true;
}
// Drop what you're holding on its best tooth, or in the bin if every tooth is better without it.
export function dropHeld(S) {
  if (!S.held) return;
  const i = bestSlot(S, S.held);
  if (i >= 0 && previews(S, S.held)[i] > 0) place(S, i); else S.held = null;
}

// The next shelf: up to the encyclopedias, then into the rare-books room.
export const canClimb = S => !S.ended && S.phase < 3 && S.beat >= S.phase;
export function climb(S, out = []) {
  if (!canClimb(S)) return false;
  dropHeld(S);
  S.phase++; S.spine = 0; S.letters = 0;
  S.shopTab = S.phase === 2 ? 'gold' : 'pig';
  out.push({ type: 'climb', phase: S.phase });
  return true;
}

// ---------- Time ----------
export function step(S, dt, out = []) {
  if (S.ended) return out;
  S.t += dt;
  const wasNight = isNight(S);
  const r = rates(S);
  S.foil += r.foil * dt; S.gold += r.gold * dt; S.pig += r.pig * dt; S.gossip += r.gossip * dt;
  if (r.gold) { S.pool -= r.gold * dt; S.eaten += r.gold * dt; }
  if (r.drain) { const d = Math.min(S.pool, r.drain * dt); S.pool -= d; S.eaten += d; }
  if (S.craze) {
    S.crazeT += dt;
    S.fans += Math.max(1, S.fans) * T.craze * dt;   // everyone else joins in
  }
  S.clock += dt;
  if (wasNight && !isNight(S)) out.push({ type: 'open' });           // the library opens: day
  if (S.clock >= CYCLE) {                                            // closing time: night
    S.clock -= CYCLE; S.night++;
    const p = pending(S), who = S.phase < 3 ? 'cousins' : 'fans';
    if (p.n) { S[who] += p.n; S.gossip = p.left; }
    S.joinedTonight = p.n;
    out.push({ type: 'close', joined: p.n, who });
  }
  const g = grin(S);
  S.peak = Math.max(S.peak, g);
  // Beating the shelf's rival is the beat that opens the next shelf (or, on the last, the craze).
  if (S.beat < S.phase && g >= rival(S)) {
    S.beat = S.phase;
    if (S.phase === 1) S.revealed = true;     // ...and Isadora tells everyone it's FOIL
    if (S.phase === 3) S.craze = true;
    out.push({ type: 'beat', phase: S.phase });
  }
  if (S.pool <= 0 && !S.ended) { S.pool = 0; S.ended = true; out.push({ type: 'end' }); }
  return out;
}

// While you were away: the help kept chewing, at a reduced rate, for up to four hours. Fans don't
// finish the library without you (it stays above a tenth), and nobody joins until you're back.
export function offline(S, secs) {
  if (S.ended || secs < 30) return null;
  const s = Math.min(secs, OFFLINE_CAP) * OFFLINE_RATE * (NIGHT / CYCLE);
  const clock = S.clock; S.clock = 0;
  const r = rates(S); S.clock = clock;
  const got = { secs: Math.min(secs, OFFLINE_CAP), foil: r.foil * s, gold: r.gold * s, pig: r.pig * s, gossip: 0 };
  if (S.phase >= 2) got.gold = Math.min(got.gold, Math.max(0, S.pool - LIBRARY_GILT * 0.5));
  S.foil += got.foil; S.gold += got.gold; S.pig += got.pig;
  S.pool -= got.gold; S.eaten += got.gold;
  if (r.drain) { const d = Math.min(r.drain * s, Math.max(0, S.pool - LIBRARY_GILT * 0.1)); S.pool -= d; S.eaten += d; got.drain = d; }
  // A day's worth of gossip, too: the worms talk whether you're there or not.
  got.gossip = stats(S).passive * Math.min(secs, OFFLINE_CAP) * OFFLINE_RATE * ((CYCLE - NIGHT) / CYCLE);
  S.gossip += got.gossip;
  return got;
}

// ---------- Numbers ----------
const NAMES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion'];
const SHORT = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
function split(n) {
  if (n < 1000) return [n, 0];
  const e = Math.min(NAMES.length - 1, Math.floor(Math.log10(n) / 3));
  return [n / Math.pow(1000, e), e];
}
const sig = x => x >= 100 ? Math.floor(x).toString() : x >= 10 ? (Math.floor(x * 10) / 10).toString() : (Math.floor(x * 100) / 100).toString();
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return Math.floor(n).toLocaleString('en-US');
  const [x, e] = split(n); return `${sig(x)} ${NAMES[e]}`;
}
export function fmtShort(n) {
  if (n < 1000) return Math.floor(n).toString();
  const [x, e] = split(n); return `${sig(x)}${SHORT[e]}`;
}
// Grams of gold, with every zero showing. That's the joke.
export function grams(atoms) {
  const g = atoms / ATOMS_PER_GRAM;
  if (g >= 0.1) return `${g.toFixed(2)} g`;
  if (g <= 0) return '0 g';
  const d = Math.min(20, Math.max(2, -Math.floor(Math.log10(g)) + 1));
  return `${g.toFixed(d)} g`;
}
