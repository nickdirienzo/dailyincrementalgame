// We Have a Pickle: the rules. index.html draws them; sim.mjs plays them headless.
//
// Pickles drift in the dark around the Sun. A chalk stroke from the Sun out through them reels in
// up to `reach` of them (a combo: the more in one stroke, the more each is worth); clean strokes in
// a row build a streak. A neighbor's planet crossing the line cuts it there. Eating half the stash
// (the sacrifice) fills the hunger meter and makes the Sun glow, which multiplies every pickle
// after. Later, brining half the stash makes jars (100 pickles each), the currency for hardware.

export const GOAL = 2e6;          // pickles eaten for a full Sun
export const JAR = 100;           // pickles per jar
export const EAT_AT = 60;         // total rescued before the Sun gets the idea
export const BRINE_AT = 450;     // pickles eaten before Mission Control finds the jars
export const SUPPER_AT = 120000;  // pickles eaten before the last stretch
export const T = { spawn: 0.8, probe: 0.35, glowK: 150, glowP: 0.18, hull: 1.35, lids: 1.2, dill: 2 };

export function newState() {
  return {
    p: 0, eaten: 0, jars: 0, total: 0, t: 0, lv: {}, odd: {},
    streak: 0, bestStreak: 0, bestCombo: 0, strokes: 0, cuts: 0, eats: 0, brines: 0,
    ended: false, ending: null, seen: [], shopTab: 'p', boughtOpen: false, venusMet: false,
  };
}
export function load(raw) {
  const S = Object.assign(newState(), raw || {});
  S.lv = S.lv || {}; S.odd = S.odd || {}; S.seen = S.seen || [];
  if (S.ended) { S.eaten = Math.max(S.eaten, GOAL); S.total = Math.max(S.total, GOAL); S.venusMet = true; }
  return S;
}

const L = (S, id) => S.lv[id] || 0;
export const lvl = L;

// rescue -> brine -> supper -> (nap | trick)
export function phase(S) {
  if (S.ended) return S.ending === 'trick' ? 'trick' : 'nap';
  if (S.eaten >= SUPPER_AT) return 'supper';
  if (S.eaten >= BRINE_AT) return 'brine';
  return 'rescue';
}
export const canEat = S => S.total >= EAT_AT || S.eats > 0;
export const canBrine = S => S.eaten >= BRINE_AT;
export const full = S => S.eaten >= GOAL;
// Hunger meter on a log scale: each meal roughly doubles what's been eaten.
export const fullness = S => Math.min(1, Math.log10(1 + S.eaten) / Math.log10(1 + GOAL));
export const HUNGER = ['Peckish', 'Snacky', 'Rumbly', 'Dinner-ish', 'Nearly full', 'Stuffed'];
export const hungerName = S => full(S) ? HUNGER[5] : HUNGER[Math.min(4, Math.floor(fullness(S) * 5))];

// The neighbors who come out as the night goes on. r: orbit radius (share of the board's half-size),
// size: body radius in board units (the board is 1000 across), period: seconds per orbit.
export const PLANETS = [
  { id: 'mercury', name: 'Mercury', r: 0.3,  size: 26, period: 21, phase0: 0.3, when: () => true },
  { id: 'venus',   name: 'Venus',   r: 0.45, size: 34, period: 34, phase0: 2.4, when: S => S.total >= 400 },
  { id: 'earth',   name: 'Earth',   r: 0.63, size: 36, period: 50, phase0: 4.1, when: S => canBrine(S), moon: true },
  { id: 'mars',    name: 'Mars',    r: 0.81, size: 32, period: 70, phase0: 1.2, when: S => S.eaten >= SUPPER_AT },
];
export const planetsOut = S => PLANETS.filter(p => p.when(S));
export const blocks = (S, p) => !(p.id === 'mars' && S.odd.mars);

// ---------- Derived numbers ----------
const DILLS = ['dill', 'kosher', 'halfsour', 'fullsour', 'garlic'];
export function stats(S) {
  const glow = Math.pow(1 + S.eaten / T.glowK, T.glowP);
  const dill = Math.pow(T.dill, DILLS.filter(d => S.odd[d]).length);
  const lids = Math.pow(T.lids, L(S, 'lids'));
  const value = dill * lids * glow * (S.odd.shades ? 1.05 : 1);
  return {
    glow, value,
    reach: 3 + L(S, 'chalk') + (S.odd.tail ? 3 : 0),                                    // pickles one stroke can carry
    spawn: T.spawn * Math.pow(1.3, L(S, 'light')),               // pickles drifting in per second
    cap: 9 + 3 * L(S, 'light'),                                  // most adrift at once
    combo: 0.15 + 0.06 * L(S, 'dust'),                           // + per extra pickle in a stroke
    streakCap: 10 + 10 * L(S, 'telemetry'),
    probes: L(S, 'probe') * T.probe * Math.pow(T.hull, L(S, 'hull')) * (S.odd.moon ? 1.5 : 1), // pickles per second, fetched
    autoEvery: L(S, 'auto') ? 9 / Math.pow(1.25, L(S, 'auto') - 1) : 0,
    hit: Math.pow(0.8, L(S, 'letter')),                          // neighbors' size
    slow: Math.pow(0.85, L(S, 'letter')),                        // neighbors' speed
  };
}
export const comboMult = (S, n) => 1 + stats(S).combo * Math.max(0, n - 1);
export const streakMult = S => 1 + 0.04 * Math.min(S.streak, stats(S).streakCap);

// ---------- Actions ----------
// A finished stroke that carried n pickles home. cut: a neighbor broke it (the streak resets).
export function stroke(S, n, cut, auto = false) {
  if (!auto) {
    S.strokes++;
    if (cut) { S.cuts++; S.streak = 0; } else if (n > 0) S.streak++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.bestCombo = Math.max(S.bestCombo, n);
  }
  if (n <= 0) return 0;
  const st = stats(S);
  const gain = n * st.value * comboMult(S, n) * (auto ? 1 : streakMult(S));
  S.p += gain; S.total += gain;
  return gain;
}
export function tick(S, dt) {
  S.t += dt;
  const g = stats(S).probes * stats(S).value * dt;
  S.p += g; S.total += g;
  return g;
}
export function eat(S) {
  if (!canEat(S) || S.p < 2) return 0;
  const bite = Math.floor(S.p / 2);
  S.p -= bite; S.eaten += bite; S.eats++;
  return bite;
}
export function brine(S) {
  if (!canBrine(S)) return 0;
  const n = Math.floor(S.p / 2 / JAR);
  if (n < 1) return 0;
  S.p -= n * JAR; S.jars += n; S.brines++;
  return n;
}

// ---------- The shop ----------
// tab p spends pickles, tab j spends jars. Repeatables have max; one-offs don't. silly: story.
// Costs are functions of the current level.
const geo = (base, g) => n => Math.ceil(base * Math.pow(g, n));
export const UPGRADES = [
  // Pickles
  { id: 'bowl', tab: 'p', name: 'Treat Bowl', cost: () => 25, silly: true, when: S => S.total >= 12,
    desc: 'A bowl of candy by the door, for trick-or-treaters.', joke: 'Nobody comes. The porch is 5,500 °C. The candy is now a puddle with opinions.' },
  { id: 'chalk', tab: 'p', name: 'Longer Chalk', max: 10, cost: geo(14, 2.1), when: S => S.total >= 5,
    desc: 'A stroke can carry one more pickle home.', joke: 'Procurement says it is the same chalk, just more of it.' },
  { id: 'light', tab: 'p', name: 'Floodlight', max: 10, cost: geo(22, 2.0), when: S => S.total >= 15,
    desc: 'Lights more of the dark: pickles drift in 30% faster, and 3 more can be adrift at once.', joke: 'Aimed at Venus\'s yard. She waves.' },
  { id: 'dill', tab: 'p', name: 'Dill Rating', cost: () => 160, when: S => S.total >= 90,
    desc: 'Every pickle is worth 2× as much. Mission Control now grades pickles.', joke: 'Grade: dill. Upgraded from "cucumber, technically".' },
  { id: 'probe', tab: 'p', name: 'Gherkin Probe', max: 30, cost: geo(55, 1.24), when: S => S.total >= 400,
    desc: 'A small probe that fetches pickles from the far dark on its own.', joke: 'Built from a tin can, a bendy straw and one (1) antenna. Launches on a sneeze.' },
  { id: 'dust', tab: 'p', name: 'Chalk Dust', max: 8, cost: geo(90, 2.3), when: S => S.bestCombo >= 3,
    desc: 'Combos pay more: every extra pickle in one stroke adds 6% more to all of them.', joke: 'The dust settles. Then it settles harder.' },
  { id: 'shades', tab: 'p', name: 'Sunglasses', cost: () => 400, silly: true, when: S => S.total >= 300,
    desc: 'Pickles are worth 5% more. It is night. The Sun wears them anyway.', joke: 'MISSION CONTROL: Flight, the Sun has entered "cool" mode. Telemetry unchanged.' },
  { id: 'kosher', tab: 'p', name: 'Kosher Dill', cost: () => 1800, when: S => S.odd.dill,
    desc: 'Every pickle is worth 2× as much again. Garlic. Lots of garlic.', joke: 'Vampires report a no-fly zone around the inner solar system.' },
  { id: 'halfsour', tab: 'p', name: 'Half-Sour', cost: () => 22000, when: S => S.odd.kosher,
    desc: 'Every pickle is worth 2× as much again.', joke: 'Half sour, half sweet, all trajectory.' },
  { id: 'shoes', tab: 'p', name: 'Walking Shoes', cost: () => 60000, silly: true, when: S => S.eaten >= 20000,
    desc: 'Size 1.4 million kilometers. Does nothing. The Sun does not walk anywhere. Probably.', joke: 'MISSION CONTROL: Flight, why did we buy the Sun shoes? ... Flight?' },
  { id: 'fullsour', tab: 'p', name: 'Full Sour', cost: () => 260000, when: S => S.odd.halfsour,
    desc: 'Every pickle is worth 2× as much again. Fully committed.', joke: 'Sourness nominal. Faces pinched across three planets.' },
  { id: 'garlic', tab: 'p', name: 'Garlic Supreme', cost: () => 2.5e6, when: S => S.odd.fullsour,
    desc: 'Every pickle is worth 2× as much again. The best pickle Venus has ever thrown.', joke: 'Banned on Mars. Mars is not consulted.' },
  // Jars
  { id: 'coffee', tab: 'j', name: 'Coffee for Flight', cost: () => 2, silly: true, when: S => canBrine(S),
    desc: 'A jar of coffee for the Flight Director. Does nothing for the pickles.', joke: 'It is pickle-flavored. It was in a pickle jar. Lessons were learned.' },
  { id: 'auto', tab: 'j', name: 'Autopilot Arm', max: 6, cost: geo(4, 3.6), when: S => canBrine(S),
    desc: 'A chalk-holding arm that draws its own stroke to the thickest pickles every few seconds (no streak).', joke: 'Handwriting: worse than yours. Trajectories: identical.' },
  { id: 'hull', tab: 'j', name: 'Jar Hulls', max: 6, cost: geo(3, 4.2), when: S => canBrine(S),
    desc: 'Probes rebuilt inside pickle jars fetch 35% faster. Brine is excellent shielding.', joke: 'The probes smell incredible on re-entry.' },
  { id: 'telemetry', tab: 'j', name: 'Streak Telemetry', max: 5, cost: geo(6, 3.4), when: S => canBrine(S),
    desc: 'The streak bonus can climb 10 strokes higher (4% per clean stroke).', joke: 'A new screen that says STREAK in very large letters.' },
  { id: 'letter', tab: 'j', name: 'Polite Letter', max: 4, cost: geo(8, 3.8), when: S => canBrine(S),
    desc: 'Ask the neighbors to keep it down: their planets cross your lines 20% less (smaller and slower).', joke: '"Dear neighbors, please stop orbiting so loudly. Warmly, the Sun." Warmly is an understatement.' },
  { id: 'address', tab: 'j', name: 'Venus\'s Address', cost: () => 60, silly: true, when: S => canBrine(S) && S.total >= 400,
    desc: 'Written on a napkin: "2nd house from the Sun. Porch light\'s on, sugar." Does nothing. Who would visit?', joke: 'MISSION CONTROL: Filed under "places the Sun has never been". It is a long file.' },
  { id: 'lids', tab: 'j', name: 'Wide-Mouth Lids', max: 5, cost: geo(15, 4), when: S => S.eaten >= 8000,
    desc: 'Every pickle is worth 20% more. Wider lids, bigger pickles.', joke: 'The pickles were always this big. They were just shy.' },
  { id: 'costume', tab: 'j', name: 'Pickle Costume', cost: () => 900, silly: true, when: S => S.eaten >= SUPPER_AT / 2,
    desc: 'A green bumpy costume, Sun-sized, for trick-or-treating door to door. Not that the Sun goes anywhere.', joke: 'MISSION CONTROL: Flight, the Sun is trying it on. It has been trying it on for an hour.' },
  // Supper: the last stretch
  { id: 'tail', tab: 'p', name: 'Comet-Tail Chalk', cost: () => 350000, when: S => S.eaten >= SUPPER_AT,
    desc: 'Chalk from a comet\'s tail: a stroke can carry three more pickles home.', joke: 'The comet asked for it back. The comet was told it would be returned "after supper".' },
  { id: 'bib', tab: 'p', name: 'Napkin Bib', cost: () => 700000, silly: true, when: S => S.eaten >= SUPPER_AT,
    desc: 'The Sun tucks in a napkin. Does nothing. Signals intent.', joke: 'It caught fire. A second napkin was deployed. MISSION CONTROL: Napkin budget exceeded.' },
  { id: 'moon', tab: 'j', name: 'Borrow the Moon', cost: () => 1500, when: S => S.eaten >= SUPPER_AT,
    desc: 'Earth lends its Moon for the night. Probes fetch 50% faster with it herding.', joke: 'Earth wants it back by sunrise. The Sun points out that it IS sunrise.' },
  { id: 'mars', tab: 'j', name: 'Treat for Mars', cost: () => 3000, when: S => S.eaten >= SUPPER_AT,
    desc: 'A jar of the good pickles for Mars. Mars stops crossing your lines.', joke: 'Mars was only cranky because nobody ever gives Mars anything. Mars is red with gratitude. Mars was already red.' },
];
export const BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const SECRET = ['shoes', 'address', 'costume'];
export const secretReady = S => SECRET.every(id => S.odd[id]);

export const owned = (S, u) => (u.max ? L(S, u.id) >= u.max : !!S.odd[u.id]);
export const costOf = (S, u) => u.cost(L(S, u.id));
export const wallet = (S, u) => (u.tab === 'j' ? S.jars : S.p);
export const unlocked = (S, u) => S.seen.includes(u.id) || u.when(S);
// Upgrades in the shop right now (revealed and not maxed/bought).
export function items(S) {
  return UPGRADES.filter(u => unlocked(S, u) && !owned(S, u)).map(u => ({ ...u, price: costOf(S, u), level: L(S, u.id) }));
}
// Remember what has been revealed so it never hides again.
export function reveal(S) {
  const fresh = [];
  for (const u of UPGRADES) if (!S.seen.includes(u.id) && u.when(S)) { S.seen.push(u.id); fresh.push(u.id); }
  return fresh;
}
export function buy(S, id) {
  const u = BY_ID[id];
  if (!u || !unlocked(S, u) || owned(S, u)) return false;
  const c = costOf(S, u);
  if (wallet(S, u) < c) return false;
  if (u.tab === 'j') S.jars -= c; else S.p -= c;
  if (u.max) S.lv[id] = L(S, id) + 1; else S.odd[id] = true;
  return true;
}

// ---------- Formatting ----------
export function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}
