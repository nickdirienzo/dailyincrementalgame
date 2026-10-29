// The Longest Noon: the numbers. Pure functions, no DOM, so the game and the pacing sim run the
// same rules.
//
// Three phases, each with its own currency, all still flowing once unlocked:
//   1. Mend   — drag cracked acorns from the dunes to the bench. Acorns buy tools.
//   2. Grove  — drag acorns from the bag to the grove to plant trees. Trees cast shade; every
//               critter needs a patch of shade to move in, so shade is what hires them.
//   3. Oak    — tapped trees give sap, and drip more into a jar. Drag the jar to the Great Oak, and spend it
//               growing the oak roots to crown. When the crown closes, nobody can see anybody.

export const PARTS = ['roots', 'trunk', 'boughs', 'crown'];

// cost: { acorns, shade, sap }. growth: price multiplier per level, for repeatables. phase: when it
// can show up. who: the camel's comment when you buy it (the helper with opinions).
export const UPGRADES = [
  // ---- Phase 1: Mend ----
  { id: 'scoop', phase: 1, name: 'Sand Scoop', cost: { acorns: 14 }, desc: 'Carry 3× as many acorns per trip.',
    who: '"Good scoop. I sold one just like it to the last penguin." There was no last penguin.' },
  { id: 'glue', phase: 1, name: 'Better Glue', cost: { acorns: 50 }, desc: 'Every acorn mends better: 2× acorns.',
    who: '"Smell it," says the camel. You do not smell it.' },
  { id: 'lizard', phase: 1, name: 'Hire a Lizard', cost: { acorns: 110 }, growth: 1.6, max: 6, desc: 'Lizards love the heat. Each one hauls acorns to the bench for you.',
    who: '"Lizards don\'t need shade," says the camel. "Lizards don\'t need anything." The lizard blinks sideways.' },
  { id: 'sunglasses', phase: 1, name: 'Tiny Sunglasses', cost: { acorns: 600 }, silly: true, desc: 'For the staring contest. Does nothing. Looks incredible.',
    who: '"Harold can still see you," the camel says. "Harold can always see you."' },
  { id: 'bucket', phase: 1, name: 'Bucket', cost: { acorns: 260 }, desc: 'Carry 4× more per trip.',
    who: '"Ah. The bucket." The camel writes something down.' },
  { id: 'bench', phase: 1, name: 'Proper Workbench', cost: { acorns: 1100 }, desc: 'Room to mend three at once: 3× acorns.',
    who: '"Solid oak," says the camel. You both look at the acorns. Nobody says anything.' },
  { id: 'whisper', phase: 1, name: 'Ask the Lizards', cost: { acorns: 3500 }, silly: true, desc: 'What are they always whispering about?',
    who: 'The lizards stop whispering. All of them. At once. Then they start again, slightly louder.' },
  { id: 'wheelbarrow', phase: 1, name: 'Wheelbarrow', cost: { acorns: 6000 }, desc: 'Carry 10× more per trip.',
    who: '"It squeaks," says the camel. "They all squeak. You get used to it." You do not.' },
  { id: 'plant', phase: 1, name: 'Plant the First Acorn', cost: { acorns: 40000 }, unlocks: 2, desc: 'Oaks make shade. Shade makes cold. Cold makes snow. Probably.',
    who: 'The camel watches you dig. "Bold," it says. "Very bold."' },

  // ---- Phase 2: Grove ----
  { id: 'stick', phase: 2, name: 'Planting Stick', cost: { shade: 60 }, desc: 'Plant 5 trees per trip instead of 1.',
    who: '"It\'s a stick," says the camel. "That\'ll be forty shade."' },
  { id: 'fox', phase: 2, name: 'Shade for a Fennec Fox', cost: { shade: 125 }, growth: 1.7, max: 8, desc: 'Foxes haul acorns twice as fast as lizards. They need their shade, though.',
    who: '"Foxes," says the camel, as if that explains it. The fox\'s ears are enormous. It hears everything.' },
  { id: 'watering', phase: 2, name: 'Watering Can', cost: { shade: 6000 }, desc: 'Thirsty trees cast thin shade: 2× shade.',
    who: '"Where does the water come from?" you ask. The camel smiles too wide.' },
  { id: 'snowglobe', phase: 2, name: 'A Snow Globe', cost: { shade: 1000 }, silly: true, desc: 'For reference.',
    who: '"Is that what you\'re going for?" the camel asks, kindly. The penguin holds it very close.' },
  { id: 'scorpion', phase: 2, name: 'Shade for a Scorpion', cost: { shade: 1500 }, growth: 1.8, max: 6, desc: 'Scorpions plant trees on their own, and tend the ones you have: +25% shade each. Very precisely. Very quietly.',
    who: '"Don\'t make eye contact," says the camel. "With the scorpion, I mean. Or with Harold. Either."' },
  { id: 'snowman', phase: 2, name: 'Snowman Kit', cost: { shade: 12000 }, silly: true, desc: 'Practice for later.',
    who: 'You build one out of sand. It is a sandman. "It\'s fine," says the camel. "It\'s a little fine."' },
  { id: 'cart', phase: 2, name: 'Camel Cart', cost: { shade: 25000, acorns: 3e5 }, desc: 'Carry 20× more per trip. The critters ride along: helpers 3×.',
    who: '"I charge by the hump," says the camel. It has two humps. The bill is for three.' },
  { id: 'mulch', phase: 2, name: 'Mulch', cost: { shade: 10000 }, desc: 'Trees take root easier: planting costs half as many acorns.',
    who: '"Don\'t ask what\'s in it," says the camel. You were not going to ask.' },
  { id: 'hammock', phase: 2, name: 'A Hammock', cost: { shade: 40000 }, silly: true, desc: 'You could rest. You could. Harold would win.',
    who: 'The penguin sits in it for one second and gets back up. The staring continues.' },
  { id: 'tap', phase: 2, name: 'Tap the Grove', cost: { shade: 75000, acorns: 1e7 }, unlocks: 3, desc: 'Trees give sap. Sap can grow one tree big enough to matter.',
    who: '"The Great Oak," says the camel quietly. "So you\'ve heard." You have not heard.' },

  // ---- Phase 3: The Great Oak ----
  { id: 'jars', phase: 3, name: 'Sap Jars', cost: { sap: 100 }, desc: 'A bigger jar: holds 3× more before it overflows.',
    who: '"Jars," says the camel. "Lids extra." The lids are free. The camel knows that.' },
  { id: 'roots', phase: 3, part: true, name: 'Great Oak: Roots', cost: { sap: 3500, acorns: 5e9 }, desc: 'Five billion acorns, all the way down. The ground holds its breath.',
    who: '"Deep," says the camel. "Deeper than you\'d think. Deeper than the delivery slip."' },
  { id: 'devil', phase: 3, name: 'Tame a Dust Devil', cost: { sap: 900 }, desc: 'A tiny tornado named Gary hauls for everyone: helpers 10×.',
    who: '"Gary\'s been waiting," the camel says. Gary spins. Gary is always spinning. Gary is happy.' },
  { id: 'avalanche', phase: 3, name: 'Acorn Avalanche', cost: { sap: 1500 }, desc: 'Gary picks up whole dunes now: carry 25× more per trip.',
    who: '"The order was for five billion," says the camel. "I counted." It did not need to count.' },
  { id: 'taps', phase: 3, name: 'More Taps', cost: { sap: 500 }, growth: 2.1, max: 5, desc: 'Another spigot in every tree: +50% sap.',
    who: '"The trees don\'t mind," says the camel. "I asked." You did not see it ask.' },
  { id: 'trunk', phase: 3, part: true, after: 'roots', name: 'Great Oak: Trunk', cost: { sap: 6000, shade: 1.5e5 }, desc: 'Up past the dunes. Up past the camel.',
    who: 'The camel looks up at it for a long time. "Huh," it says.' },
  { id: 'scarf', phase: 3, name: 'Wool Scarf', cost: { sap: 4000 }, silly: true, desc: "It's going to get cold. Any minute now.",
    who: '"Knitted by the lizards," says the camel. The lizards have never once been cold.' },
  { id: 'buckets', phase: 3, name: 'Sap Buckets', cost: { sap: 5000 }, desc: 'Every tree gives 3× sap.',
    who: '"Buckets again," says the camel. "Full circle." It writes something down.' },
  { id: 'boughs', phase: 3, part: true, after: 'trunk', name: 'Great Oak: Boughs', cost: { sap: 8000, acorns: 1e10 }, desc: 'Branches as wide as the desert. Harold squints.',
    who: '"He\'s noticed," says the camel. "Oh, he\'s noticed."' },
  { id: 'sign', phase: 3, name: 'A Welcome Sign', cost: { sap: 12000 }, silly: true, desc: 'SQUIRRELS WELCOME. Just in case.',
    who: '"Who\'s it for?" asks the camel, who knows exactly who it\'s for. The delivery slip has a second page.' },
  { id: 'mittens', phase: 3, name: 'Mittens', cost: { sap: 14000 }, silly: true, desc: 'Flipper mittens. For the cold, which is coming.',
    who: '"They\'re for flippers," says the camel. "I had them in the back." The camel has had them in the back for forty-one days.' },
  { id: 'crown', phase: 3, part: true, after: 'boughs', name: 'Great Oak: Crown', cost: { sap: 20000, shade: 3e5, acorns: 2e10 }, final: true, desc: 'Close the canopy. Nobody will be able to see anybody.',
    who: '"Ready?" says the camel. It is holding the delivery slip.' },
];

export const BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

export const defaults = () => ({
  phase: 1, acorns: 0, mended: 0, trees: 0, shade: 0, sap: 0, owned: {}, seen: {},
  time: 0, ended: false, cracked: 0, jar: 0,
});

const has = (S, id) => (S.owned[id] || 0) > 0;
const count = (S, id) => S.owned[id] || 0;

export function costOf(S, u) {
  const k = Math.pow(u.growth || 1, count(S, u.id));
  const c = {};
  for (const [r, v] of Object.entries(u.cost)) c[r] = Math.round(v * k);
  return c;
}
export const maxed = (S, u) => count(S, u.id) >= (u.max || 1);

// What a tree costs to plant, in acorns: rises gently with the size of the grove.
export function treePrice(S) {
  return Math.round(300 * Math.pow(1.006, S.trees) * (has(S, 'mulch') ? 0.5 : 1));
}

export function stats(S) {
  let scoop = 1;
  if (has(S, 'scoop')) scoop *= 3;
  if (has(S, 'bucket')) scoop *= 4;
  if (has(S, 'wheelbarrow')) scoop *= 10;
  if (has(S, 'cart')) scoop *= 20;
  if (has(S, 'avalanche')) scoop *= 25;
  let mend = 1;
  if (has(S, 'glue')) mend *= 2;
  if (has(S, 'bench')) mend *= 3;
  const perTrip = scoop * mend;
  let helper = 1;
  if (has(S, 'cart')) helper *= 3;
  if (has(S, 'devil')) helper *= 10;
  // Trips per second made by helpers. Lizards are slow; foxes are quick.
  const autoTrips = (count(S, 'lizard') * 0.4 + count(S, 'fox') * 0.8) * helper;
  const acornRate = autoTrips * perTrip;
  const plantPerTrip = has(S, 'stick') ? 5 : 1;
  const autoPlant = count(S, 'scorpion') * 0.25 * helper; // trees per second, if acorns allow
  const shadeRate = S.phase >= 2 ? S.trees * 0.5 * (has(S, 'watering') ? 2 : 1) * (1 + 0.25 * count(S, 'scorpion')) : 0;
  const sapRate = S.phase >= 3 ? S.trees * 0.02 * (has(S, 'buckets') ? 3 : 1) * (1 + 0.5 * count(S, 'taps')) : 0;
  // The jar drips as fast as the grove and holds about fifteen seconds of it (more with Sap Jars):
  // emptying it in time doubles your sap, and dragging more often than that gains nothing.
  const jarCap = S.phase >= 3 ? (sapRate * 15 + 50) * (has(S, 'jars') ? 3 : 1) : 0;
  // How much of Harold's view the oak blocks, for the meter.
  const oak = PARTS.filter(p => has(S, p)).length / PARTS.length;
  const grove = Math.min(1, S.trees / GROVE_MAX);
  const cover = S.phase === 1 ? 0 : S.phase === 2 ? 0.35 * grove : 0.35 + 0.65 * oak;
  return { scoop, mend, perTrip, autoTrips, acornRate, plantPerTrip, autoPlant, shadeRate, sapRate, jarCap, cover, oak };
}

// Drag: dunes -> bench. Mends a trip's worth of acorns.
export function haul(S) {
  const g = stats(S).perTrip;
  S.acorns += g; S.mended += g;
  return g;
}

// Drag: bag -> grove (phase 2+). Plants as many trees as the trip and the acorns allow.
export const GROVE_MAX = 500;
export function plant(S, n = stats(S).plantPerTrip) {
  if (S.phase < 2) return 0;
  let planted = 0;
  while (planted < n && S.trees < GROVE_MAX && S.acorns >= treePrice(S)) { S.acorns -= treePrice(S); S.trees++; planted++; }
  return planted;
}

// Drag: grove -> oak (phase 3). Empties the jar into the oak's sap.
export function carry(S) {
  if (S.phase < 3) return 0;
  const g = Math.floor(S.jar || 0);
  S.jar = (S.jar || 0) - g; S.sap += g;
  return g;
}

// Advance dt seconds.
export function step(S, dt) {
  if (S.ended) return;
  S.time += dt;
  const st = stats(S);
  const made = st.acornRate * dt;
  S.acorns += made; S.mended += made;
  S.shade += st.shadeRate * dt;
  S.sap += st.sapRate * dt;
  if (S.phase >= 3) S.jar = Math.min(st.jarCap, (S.jar || 0) + st.sapRate * dt);
  if (st.autoPlant > 0) {
    S.plantDebt = (S.plantDebt || 0) + st.autoPlant * dt;
    const n = Math.floor(S.plantDebt);
    if (n > 0) { S.plantDebt -= n; plant(S, n); }
  }
}

export function canAfford(S, u) {
  const c = costOf(S, u);
  return Object.entries(c).every(([r, v]) => S[r] >= v);
}
export function canBuy(S, u) { return !S.ended && S.phase >= u.phase && (!u.after || has(S, u.after)) && !maxed(S, u) && canAfford(S, u); }

export function buy(S, id) {
  const u = BY_ID[id];
  if (!u || !canBuy(S, u)) return false;
  for (const [r, v] of Object.entries(costOf(S, u))) S[r] -= v;
  S.owned[id] = count(S, id) + 1;
  if (u.unlocks) S.phase = Math.max(S.phase, u.unlocks);
  if (u.final) S.ended = true;
  return true;
}

// An upgrade shows once its phase has begun and you have a third of its price (or own it). Once
// shown it stays shown until bought, even if spending drops you back below that.
export function visible(S, u) {
  if (maxed(S, u) || S.phase < u.phase || (u.after && !has(S, u.after))) return false;
  if (count(S, u.id) > 0 || (S.seen && S.seen[u.id])) return true;
  const c = costOf(S, u);
  return Object.entries(c).every(([r, v]) => S[r] >= v * 0.33 || (r === 'acorns' && S.mended >= v * 0.33));
}

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1e4) return n.toLocaleString('en-US');
  const units = [[1e12, ' trillion'], [1e9, ' billion'], [1e6, ' million'], [1e3, 'k']];
  for (const [v, s] of units) if (n >= v) { const x = n / v; return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + s; }
  return String(n);
}

// The Bought shelf: one-time upgrades you own, plus repeatables you've maxed (they left the shop too).
export const bought = S => UPGRADES.filter(u => maxed(S, u));

export const fmtCost = (S, u) => Object.entries(costOf(S, u)).map(([r, v]) => `${fmt(v)} ${r}`).join(' + ');
