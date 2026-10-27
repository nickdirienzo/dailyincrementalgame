// Three Lemons: the rules. The page and the pacing sim both import this.
//
// Lemons (sorted by rubbing) -> duds go into lemon batteries -> volts -> volts buy bulbs -> light.
// Light trains the mole's eyes, and eyes that can see sort faster. Fitch's map opens new cellars,
// each a bigger source of lemons. The fruit machine in the corner eats three duds a pull.

export const ORDER = 1e9;          // Fitch's order. Shipping it ends the game.
export const DUD_RATIO = 0.25;     // a dud for every four good lemons
export const PULL_COST = 3;        // three lemons a pull
export const OFFLINE_RATE = 0.1, OFFLINE_CAP = 8 * 3600;

// ---------- Things you buy more than one of ----------
// cellar: how many cellars must be open before it shows up.
export const HELPERS = [
  { id: 'beetle', name: 'Night beetle', cost: 25, rate: 0.3, cellar: 1, desc: 'Sorts by sniffing. Slow. Never late.' },
  { id: 'vole', name: 'Vole cousin', cost: 600, rate: 2.4, cellar: 1, desc: 'Everyone has a vole cousin. Yours sorts lemons.' },
  { id: 'shrew', name: 'Shrew crew', cost: 12000, rate: 18, cellar: 3, desc: 'Three shrews, one apron. They take turns.' },
  { id: 'badger', name: 'Badger foreman', cost: 150000, rate: 100, cellar: 4, desc: 'Doesn’t sort. Makes everyone else sort faster by standing there.' },
  { id: 'starnose', name: 'Star-nosed mole', cost: 2.5e6, rate: 450, cellar: 5, desc: 'Twenty-two fingers on its nose. Reads a lemon like a newspaper.' },
  { id: 'belt', name: 'Conveyor belt', cost: 4e7, volts: 3e5, rate: 2000, cellar: 6, desc: 'Runs on volts. Lemons go by. You rub them as they pass.' },
  { id: 'nose', name: 'The Electric Nose', cost: 6e8, volts: 5e6, rate: 9000, cellar: 7, desc: 'A machine that smells. Fitch bought it off a guy.' },
];
// Batteries and bulbs, like the helpers, come with the cellars (cellar: how many must be open).
export const BATTERIES = [
  { id: 'cell', name: 'Lemon cell', cost: 20, rate: 0.15, cellar: 3, desc: 'One dud, one copper nail, one zinc nail. It works. It shouldn’t, but it does.' },
  { id: 'stack', name: 'Lemon stack', cost: 250, rate: 1.2, cellar: 3, desc: 'A dozen duds wired in a row. Hums a little.' },
  { id: 'cratebat', name: 'Crate battery', cost: 3000, rate: 9, cellar: 4, desc: 'A whole crate of duds, nailed. Don’t lick it.' },
  { id: 'barrel', name: 'Barrel battery', cost: 40000, rate: 70, cellar: 5, desc: 'Sloshes. Sparks. Smells like a cleaning product.' },
  { id: 'pile', name: 'The Great Dud Pile', cost: 6e5, rate: 550, cellar: 6, desc: 'Every lemon nobody wanted, working together at last.' },
];
export const BULBS = [
  { id: 'penlight', name: 'Penlight bulb', cost: 15, rate: 0.12, cellar: 3, desc: 'The size of a pea. The brightest thing you have ever been near.' },
  { id: 'desk', name: 'Desk lamp', cost: 200, rate: 1, cellar: 3, desc: 'Green shade. Every office in every story has one.' },
  { id: 'street', name: 'Streetlamp', cost: 2500, rate: 8, cellar: 4, desc: 'Fitch got it from a street. Don’t ask which.' },
  { id: 'stage', name: 'Stage light', cost: 35000, rate: 60, cellar: 5, desc: 'For the big number. The big number is lemons.' },
  { id: 'lens', name: 'Lighthouse lens', cost: 5e5, rate: 450, cellar: 6, desc: 'It turns. The cellar spins past you in stripes.' },
];
// Eyes: each rank costs light and lets the mole stand (and work in) a brighter cellar.
export const EYES = [
  { lux: 1, name: 'Matchlight', cost: 30, cellar: 3 },
  { lux: 10, name: 'Candle', cost: 300, cellar: 3 },
  { lux: 50, name: 'Oil lamp', cost: 2500, cellar: 4 },
  { lux: 150, name: 'Streetlamp', cost: 18000, cellar: 4 },
  { lux: 400, name: 'Parlor', cost: 110000, cellar: 5 },
  { lux: 1000, name: 'Office', cost: 6e5, cellar: 5 },
  { lux: 4000, name: 'Overcast day', cost: 3e6, cellar: 6 },
  { lux: 12000, name: 'Shade', cost: 1.4e7, cellar: 6 },
  { lux: 30000, name: 'Daylight', cost: 2e7, cellar: 7 },
  { lux: 100000, name: 'Noon', cost: 6e7, cellar: 7 },
];
export const EYE_MULT = 1.15;
// Every producer's rate is scaled by this: the knob for how long the whole game takes.
export let RATE_K = 0.45;
export const setRateK = k => { RATE_K = k; };

// Fitch's map: every tunnel marked UP. Each needs its scrap from the fruit machine first.
// `at`: the scrap can't drop until this many lemons have shipped, so the map paces the story.
export const CELLARS = [
  { name: 'Cellar No. 1', at: 0 },
  { name: 'Cellar No. 2: the Root Cellar', at: 1200, cost: { lemons: 1500 },
    fitch: '“Huh,” says Fitch. “More lemons.”' },
  { name: 'Cellar No. 3: the Cistern', at: 20000, cost: { lemons: 6000 },
    fitch: '“Would you look at that,” says Fitch. “Lemons.”' },
  { name: 'Cellar No. 4: the Vault', at: 5e5, cost: { lemons: 1.5e5, volts: 2000, light: 300 },
    fitch: 'Fitch looks at the map. He looks at the lemons. He looks at the map. “Lemons,” he says.' },
  { name: 'Cellar No. 5: the Deep Store', at: 6e6, cost: { lemons: 1.5e6, volts: 40000, light: 8000 },
    fitch: '“I’m as surprised as you are, kid.” He is not.' },
  { name: 'Cellar No. 6: the Catacombs', at: 5e7, cost: { lemons: 1e7, volts: 4e5, light: 1e5 },
    fitch: 'Fitch doesn’t say anything. He hands you a second apron.' },
  { name: 'Cellar No. 7: the Bottom', at: 2.5e8, cost: { lemons: 5e7, volts: 3e6, light: 1e6 },
    fitch: '“Fine,” says Fitch. “It’s a map of the cellars. It was always a map of the cellars. I wrote UP on it so you’d feel better.”' },
];
export const CELLAR_MULT = 1.25;

// ---------- One-offs ----------
// need(S): shows up when true (and you can nearly afford it). Silly ones do little but tell the story.
const T = (helper, n) => S => (S.owned[helper] || 0) >= n;
export const ONEOFFS = [
  // Rubbing
  { id: 'gloves', name: 'Fingerless gloves', cost: { lemons: 12 }, rub: 2, desc: 'Rub twice as many per rub. Keeps the oil on your paws, where you can read it.' },
  { id: 'apron', name: 'An apron with pockets', cost: { lemons: 70 }, rub: 2, desc: 'Two lemons in hand, two in the pockets.' },
  { id: 'fedora', silly: true, name: 'A fedora', cost: { lemons: 40 }, desc: 'Every night-shift mole needs one. It does nothing. It looks great.',
    log: 'You tilt the fedora. Nobody sees it. It’s dark. You know.' },
  { id: 'thimble', name: 'A thimble', cost: { lemons: 160 }, rub: 1.5, desc: 'For the thumb. Half again as many per rub.' },
  { id: 'stool', silly: true, name: 'A taller stool', cost: { lemons: 250 }, rub: 1.1, desc: 'You can reach the table now. A little more per rub.', log: 'From up here you can see the whole cellar. You can’t, actually. It’s dark. But you could.' },
  { id: 'nametag', silly: true, name: 'A name tag', cost: { lemons: 300 }, desc: 'It says MOLE. Fitch wrote it. He spelled it right, which he mentions.', log: '“M-O-L-E,” says Fitch, pinning it on. “First try.” Nobody down here can read it.' },
  { id: 'calluses', name: 'Calluses', cost: { lemons: 900 }, rub: 1.3, desc: 'Earned the hard way. A little more per rub.' },
  { id: 'wax', name: 'Paw wax', cost: { lemons: 400 }, rub: 2, desc: 'Smooth paws, quicker rubs.' },
  { id: 'nosework', name: 'Nose work', cost: { lemons: 1500 }, rub: 1.5, desc: 'Sniff while you rub. Half again the sorting, same mole.' },
  { id: 'grip', name: 'A second grip', cost: { lemons: 9000 }, pct: 0.02, desc: 'Each rub also sorts 2% of a second of the cellar’s work.', need: S => S.cellars >= 2 },
  { id: 'rhythm', name: 'Rub in time', cost: { lemons: 80000 }, pct: 0.04, desc: 'You rub on the off-beat. Each rub sorts another 4% of a second.', need: S => S.cellars >= 3 },
  { id: 'twopaws', name: 'Both paws', cost: { lemons: 2e6 }, rub: 4, pct: 0.06, desc: 'It took you this long. Four times the rub, plus 6% of a second.', need: S => S.cellars >= 4 },
  { id: 'lamplit', name: 'Rubbing by lamplight', cost: { lemons: 4e7, light: 5000 }, pct: 0.1, desc: 'You can see the lemon you’re rubbing. Rubs sort another 10% of a second.', need: S => S.eyes >= 5 },
  { id: 'zest', name: 'The zest touch', cost: { lemons: 8e8, light: 1e6 }, pct: 0.15, desc: 'You know a lemon before you touch it. Another 15%.', need: S => S.eyes >= 8 },

  // Helpers, in tiers
  { id: 'beetle1', name: 'Beetle headlamps', cost: { lemons: 2500 }, helper: 'beetle', mult: 1.5, need: T('beetle', 5), desc: 'Beetles sort half again as fast. They’re glowworms now, technically.' },
  { id: 'beetle2', name: 'Beetle union', cost: { lemons: 2e5 }, helper: 'beetle', mult: 1.5, need: T('beetle', 20), desc: 'Better hours, better sorting.' },
  { id: 'beetle3', name: 'Beetle pension', cost: { lemons: 6e7 }, helper: 'beetle', mult: 1.5, need: T('beetle', 40), desc: 'They’re sticking around.' },
  { id: 'vole1', name: 'Vole family reunion', cost: { lemons: 15000 }, helper: 'vole', mult: 1.5, need: T('vole', 5), desc: 'More cousins turned up.' },
  { id: 'vole2', name: 'Vole night school', cost: { lemons: 1.5e6 }, helper: 'vole', mult: 1.5, need: T('vole', 20), desc: 'They learned rubbing from a book.' },
  { id: 'vole3', name: 'Vole dynasty', cost: { lemons: 3e8 }, helper: 'vole', mult: 1.5, need: T('vole', 40), desc: 'Generations of sorting.' },
  { id: 'shrew1', name: 'A fourth shrew', cost: { lemons: 1.6e5 }, helper: 'shrew', mult: 1.5, need: T('shrew', 5), desc: 'Now there’s always one awake.' },
  { id: 'shrew2', name: 'Shrew espresso', cost: { lemons: 1.6e7 }, helper: 'shrew', mult: 1.5, need: T('shrew', 20), desc: 'A bad idea. It works.' },
  { id: 'badger1', name: 'Badger whistle', cost: { lemons: 1.9e6 }, helper: 'badger', mult: 1.5, need: T('badger', 5), desc: 'Blows it every hour. Nobody knows why it works.' },
  { id: 'badger2', name: 'Badger clipboard', cost: { lemons: 1.9e8 }, helper: 'badger', mult: 1.5, need: T('badger', 20), desc: 'There’s nothing on it.' },
  { id: 'star1', name: 'Nose rings', cost: { lemons: 2.4e7 }, helper: 'starnose', mult: 1.5, need: T('starnose', 5), desc: 'Twenty-two tiny rings.' },
  { id: 'star2', name: 'Braille labels', cost: { lemons: 5e8 }, helper: 'starnose', mult: 1.5, need: T('starnose', 15), desc: 'Every crate, labeled for noses.' },
  { id: 'belt1', name: 'Faster belt', cost: { lemons: 3e8, volts: 2e6 }, helper: 'belt', mult: 1.5, need: T('belt', 5), desc: 'More volts, more lemons going by.' },
  { id: 'nose1', name: 'Nose filter', cost: { lemons: 4e9, volts: 3e7 }, helper: 'nose', mult: 1.5, need: T('nose', 5), desc: 'It was smelling the cellar, not the lemons.' },

  // Batteries
  { id: 'nails', name: 'Copper and zinc nails', cost: { lemons: 20000 }, unlock: 'volts', need: S => S.cellars >= 3,
    desc: 'Stick both in a dud and it makes a little electricity. Duds have a future.', log: 'Fitch sells you a bag of nails. “Copper in one end, zinc in the other,” he says. “Don’t tell anybody where you heard it.”' },
  { id: 'wire1', name: 'Better wire', cost: { duds: 3000 }, bat: 2.5, need: S => (S.owned.cell || 0) >= 5, desc: 'Copper wire, from the same guy as the nails. Batteries make 2.5× the volts.' },
  { id: 'wire2', name: 'Salted duds', cost: { duds: 120000 }, bat: 3, need: S => (S.owned.stack || 0) >= 5, desc: 'A pinch of salt in every dud. Three times the volts. Don’t ask why.' },
  { id: 'wire3', name: 'Series and parallel', cost: { duds: 4e6 }, bat: 3, need: S => (S.owned.cratebat || 0) >= 5, desc: 'You read the back of the nail bag. Triple volts.' },
  { id: 'wire4', name: 'The big switch', cost: { duds: 1.2e8 }, bat: 4, need: S => (S.owned.barrel || 0) >= 5, desc: 'One switch for every battery in the place. Four times the volts.' },
  { id: 'radio', silly: true, name: 'A radio', cost: { volts: 150 }, need: S => S.unlocked.volts, desc: 'Gets one station. At three in the morning it plays dub for the night shift.',
    log: 'The radio warms up. One station: dub, with the echo turned all the way up. “Frost tonight up top,” says the man between records. You wouldn’t know.' },

  // Bulbs
  { id: 'socket', name: 'A light socket', cost: { volts: 400 }, unlock: 'light', need: S => S.unlocked.volts,
    desc: 'Somewhere to screw in a bulb. Volts become light, and light trains your eyes.', log: '“Eyes like yours,” says Fitch, “the sun’d blind you. Start small.” He hands you a bulb the size of a pea.' },
  { id: 'shade1', name: 'Frosted glass', cost: { volts: 6000 }, bulb: 2.5, need: S => (S.owned.penlight || 0) >= 5, desc: 'Softer light, easier on the eyes. Bulbs give 2.5× the light.' },
  { id: 'shade2', name: 'Mirrors', cost: { volts: 2.5e5 }, bulb: 3, need: S => (S.owned.desk || 0) >= 5, desc: 'Every bulb counts twice, and then once more. Triple light.' },
  { id: 'shade3', name: 'Whitewash the walls', cost: { volts: 8e6 }, bulb: 3, need: S => (S.owned.street || 0) >= 5, desc: 'Fitch hates it. Triple light.' },
  { id: 'shade4', name: 'The chandelier', cost: { volts: 2.4e8 }, bulb: 4, need: S => (S.owned.stage || 0) >= 5, desc: 'Made of lemon batteries and bulbs. Four times the light.' },
  { id: 'sunglasses', silly: true, name: 'Tiny sunglasses', cost: { light: 400 }, need: S => S.eyes >= 2, desc: 'For later.',
    log: 'You put on the tiny sunglasses. You take them off. For later.' },

  // Machine and story
  { id: 'lever', name: 'Fitch’s nephew', cost: { lemons: 2000 }, auto: 1 / 8, need: S => S.cellars >= 2,
    desc: 'Pulls the fruit machine for you every eight seconds, with his own duds. Says nothing.', log: 'Fitch’s nephew takes the stool by the machine. He has been waiting his whole life to be asked.' },
  { id: 'lever2', name: 'Oil the lever', cost: { lemons: 4e5 }, auto: 1 / 4, need: S => !!S.owned.lever, desc: 'The nephew pulls every four seconds now.' },
  { id: 'lever3', name: 'A second nephew', cost: { lemons: 5e7, volts: 1e5 }, auto: 1 / 2, need: S => !!S.owned.lever2, desc: 'Fitch has a lot of nephews. A pull every two seconds.' },
  { id: 'luck', name: 'Loaded reels', cost: { lemons: 50000 }, luck: 1.5, need: S => S.pulls >= 20, desc: 'Fitch fixes the machine so it pays a little better. For you. This once.' },
  { id: 'luck2', name: 'Fitch looks the other way', cost: { lemons: 2e7 }, luck: 1.6, need: S => !!S.owned.luck, desc: 'The machine pays out bigger. Fitch is reading the paper.' },
  { id: 'clock', silly: true, name: 'An alarm clock', cost: { lemons: 5000 }, need: S => S.cellars >= 2, desc: 'Set for six in the morning. You have never once been awake at six in the morning.',
    log: 'You set the clock for six. Fitch looks at it a long time. “Huh,” he says. Then he doesn’t say anything else.' },
  { id: 'dumbwaiter', silly: true, name: 'Grease the dumbwaiter', cost: { lemons: 3e5 }, need: S => S.cellars >= 3,
    desc: 'The crates ride it up every night. It could carry a mole, easy. Fitch says not to think about it.', log: 'The dumbwaiter goes up without a squeak. You stand there looking at it. Fitch clears his throat.' },
  { id: 'scarf', silly: true, name: 'A scarf', cost: { lemons: 1e7, volts: 5000 }, need: S => S.cellars >= 4, desc: 'The man on the radio keeps saying frost. You don’t know what frost is. You want to be ready.',
    log: 'You wind the scarf twice around. It smells like lemons. Everything does.' },
  { id: 'calendar', silly: true, name: 'A calendar', cost: { lemons: 1.5e8, light: 1e5 }, need: S => S.eyes >= 6, desc: 'Now that you can see, you can read one. It is late October. You had no idea.',
    log: 'Late October, the calendar says. Under the date somebody’s written “sunrise 6:47” in pencil. You don’t know who.' },
];

export const GROWTH = 1.17;
export const BY_ID = {};
for (const h of HELPERS) BY_ID[h.id] = { ...h, kind: 'helper', growth: GROWTH };
for (const b of BATTERIES) BY_ID[b.id] = { ...b, kind: 'battery', growth: GROWTH };
for (const b of BULBS) BY_ID[b.id] = { ...b, kind: 'bulb', growth: GROWTH };
for (const o of ONEOFFS) BY_ID[o.id] = { ...o, kind: 'one' };
BY_ID.eyes = { id: 'eyes', kind: 'eyes' };
BY_ID.dig = { id: 'dig', kind: 'dig' };

// ---------- Loot from the fruit machine ----------
export const TRINKETS = [
  { id: 'postcard', name: 'a postcard of a beach at noon', log: 'A postcard of a beach at noon. Everything on it is bright. You hold it to your nose. It smells like the machine.' },
  { id: 'sundial', name: 'a sundial', log: 'A sundial. You can’t read it down here. Nobody could. You keep it anyway.' },
  { id: 'matchbook', name: 'a matchbook from the Hotel Daybreak', log: 'A matchbook: Hotel Daybreak, Rooms by the Night. Two matches left. You don’t strike them. Not yet.' },
  { id: 'timetable', name: 'a bus timetable', log: 'A bus timetable. Somebody circled the 6:00 a.m. Somebody always circles the 6:00 a.m.' },
  { id: 'feather', name: 'a rooster feather', log: 'A feather from something called a rooster. Fitch says they yell at the sun every morning. You say that sounds like a lot of work. He says it isn’t.' },
  { id: 'photo', name: 'a photo of Fitch, squinting', log: 'A photo of Fitch, squinting, outdoors. On the back: “Me, 6 a.m.” He takes it back without a word.' },
  { id: 'seed', name: 'a lemon seed', log: 'A lemon seed. Somewhere up there, one of these turned into all of this.' },
  { id: 'leaf', name: 'a frosted leaf', log: 'A leaf, rimed white at the edges, cold as a coin. It came down the chute with the lemons. Frost, the radio called it.' },
];
export const RARES = [
  { id: 'meyer', name: 'a Meyer lemon', mult: 2, secs: 30, log: 'A Meyer lemon. Sweet as a lie. Everyone sorts twice as fast for a while.' },
  { id: 'buddha', name: 'a Buddha’s hand', mult: 4, secs: 12, log: 'A Buddha’s hand: a lemon with fingers. It rubs back. Four times the sorting, while it lasts.' },
];

// The map scraps come out of the machine one at a time, never before their cellar's moment, and
// more surely the longer you go without one.
export function scrapChance(S) {
  const next = S.scraps + 1;
  if (next >= CELLARS.length || S.shipped < CELLARS[next].at) return 0;
  return Math.min(1, 0.06 + S.dry * 0.06);
}

// One pull. rnd() is Math.random or a seeded generator. Returns what happened.
export function pull(S, rnd = Math.random) {
  if (S.duds < PULL_COST) return null;
  S.duds -= PULL_COST; S.pulls++;
  return payout(S, rnd);
}
export function payout(S, rnd = Math.random) {
  const st = stats(S);
  S.dry++;
  if (rnd() < scrapChance(S)) { S.scraps++; S.dry = 0; return { kind: 'scrap', reels: ['map', 'map', 'map'] }; }
  const r = rnd();
  const luck = st.luck;
  if (r < 0.06 && S.trinkets.length < TRINKETS.length) {
    const left = TRINKETS.filter(t => !S.trinkets.includes(t.id));
    const t = left[Math.floor(rnd() * left.length)];
    S.trinkets.push(t.id);
    return { kind: 'trinket', item: t, reels: ['bell', 'bell', 'bell'] };
  }
  if (r < 0.13) {
    const rare = rnd() < 0.75 ? RARES[0] : RARES[1];
    S.buffs.push({ mult: rare.mult, until: S.time + rare.secs });
    return { kind: 'rare', item: rare, reels: ['cherry', 'cherry', 'cherry'] };
  }
  if (r < 0.33) return { kind: 'lose', reels: ['lemon', 'lemon', 'lemon'] };
  // A windfall: some seconds of the cellar's lemons, or a few rubs' worth early on.
  const secs = (r < 0.75 ? 3 : 10) * luck;
  const got = Math.max(st.lemonRate * secs, st.perRub * 4 * luck);
  S.lemons += got; S.shipped += got;
  let volts = 0, light = 0;
  if (S.unlocked.volts && rnd() < 0.5) { volts = st.voltRate * secs + 5 * luck; S.volts += volts; }
  if (S.unlocked.light && rnd() < 0.5) { light = st.lightRate * secs + 5 * luck; S.light += light; }
  return { kind: r < 0.75 ? 'small' : 'big', lemons: got, volts, light, reels: r < 0.75 ? ['cherry', 'bar', 'cherry'] : ['bar', 'bar', 'bar'] };
}

// ---------- State ----------
export const defaults = () => ({
  lemons: 0, duds: 0, volts: 0, light: 0, shipped: 0,
  owned: {}, seen: {}, unlocked: {}, eyes: 0, cellars: 1, scraps: 0,
  pulls: 0, dry: 0, buffs: [], trinkets: [], rubs: 0,
  time: 0, ended: false, endedAt: 0, lastSeen: 0,
});

const count = (S, id) => S.owned[id] || 0;
export const has = (S, id) => count(S, id) > 0;

export function stats(S) {
  let rubMult = 1, pct = 0, luck = 1, auto = 0, bat = 1, bulb = 1;
  const hmult = {};
  for (const o of ONEOFFS) {
    if (!has(S, o.id)) continue;
    if (o.rub) rubMult *= o.rub;
    if (o.pct) pct += o.pct;
    if (o.luck) luck *= o.luck;
    if (o.auto) auto = Math.max(auto, o.auto);
    if (o.bat) bat *= o.bat;
    if (o.bulb) bulb *= o.bulb;
    if (o.helper) hmult[o.helper] = (hmult[o.helper] || 1) * o.mult;
  }
  let buff = 1;
  for (const b of S.buffs) if (b.until > S.time) buff = Math.max(buff, b.mult); // rare lemons don't stack
  const global = Math.pow(CELLAR_MULT, S.cellars - 1) * Math.pow(EYE_MULT, S.eyes);
  let helperRate = 0; const K = RATE_K;
  for (const h of HELPERS) helperRate += K * count(S, h.id) * h.rate * (hmult[h.id] || 1);
  const lemonRate = helperRate * global * buff;
  const perRub = (rubMult * global + pct * lemonRate / buff) * buff;
  let voltRate = 0;
  for (const b of BATTERIES) voltRate += K * count(S, b.id) * b.rate * bat;
  let lightRate = 0;
  for (const b of BULBS) lightRate += K * count(S, b.id) * b.rate * bulb;
  return { perRub, lemonRate, voltRate, lightRate, luck, auto, buff, global, hmult, bat, bulb };
}

// The core action: one finished rub sorts a handful. Good ones ship; duds go in the bin.
export function rub(S) {
  if (S.ended) return 0;
  const g = stats(S).perRub;
  S.lemons += g; S.shipped += g; S.duds += g * DUD_RATIO; S.rubs++;
  return g;
}

export function step(S, dt, rnd = Math.random) {
  if (S.ended) return [];
  S.time += dt;
  const st = stats(S);
  const made = st.lemonRate * dt;
  S.lemons += made; S.shipped += made; S.duds += made * DUD_RATIO;
  S.volts += st.voltRate * dt;
  S.light += st.lightRate * dt;
  if (S.buffs.length) S.buffs = S.buffs.filter(b => b.until > S.time);
  const events = [];
  if (st.auto) {
    S.autoT = (S.autoT || 0) + dt * st.auto;
    while (S.autoT >= 1) { S.autoT -= 1; S.pulls++; events.push(payout(S, rnd)); } // the nephew brings his own duds
  }
  if (S.shipped >= ORDER) { S.shipped = ORDER; S.ended = true; S.endedAt = S.time; events.push({ kind: 'end' }); }
  return events;
}

// Time away: the helpers keep working at half speed, up to eight hours. No buffs, no machine.
export function offline(S, secs) {
  if (S.ended || secs < 60) return null;
  const t = Math.min(secs, OFFLINE_CAP);
  const saved = S.buffs; S.buffs = [];
  const st = stats(S);
  S.buffs = saved;
  const k = t * OFFLINE_RATE;
  const room = ORDER * 0.999 - S.shipped; // never finish the order while away
  const lemons = Math.max(0, Math.min(st.lemonRate * k, room));
  const got = { secs: t, lemons, duds: lemons * DUD_RATIO, volts: st.voltRate * k, light: st.lightRate * k };
  S.lemons += lemons; S.shipped += lemons; S.duds += got.duds; S.volts += got.volts; S.light += got.light;
  return got;
}

// ---------- The shop ----------
export function costOf(S, id) {
  const u = BY_ID[id];
  if (u.kind === 'eyes') { const e = EYES[S.eyes]; return e ? { light: e.cost } : null; }
  if (u.kind === 'dig') { const c = CELLARS[S.cellars]; return c ? c.cost : null; }
  if (u.kind === 'one') return u.cost;
  const k = Math.pow(u.growth, count(S, id));
  const res = u.kind === 'helper' ? 'lemons' : u.kind === 'battery' ? 'duds' : 'volts';
  const c = { [res]: Math.ceil(u.cost * k) };
  if (u.volts) c.volts = Math.ceil(u.volts * k);
  return c;
}

function available(S, id) {
  const u = BY_ID[id];
  if (S.ended) return false;
  switch (u.kind) {
    case 'helper': return S.cellars >= u.cellar;
    case 'battery': return !!S.unlocked.volts && S.cellars >= u.cellar;
    case 'bulb': return !!S.unlocked.light && S.cellars >= u.cellar;
    case 'eyes': return !!S.unlocked.light && S.eyes < EYES.length && S.cellars >= EYES[S.eyes].cellar;
    case 'dig': return S.cellars < CELLARS.length && S.scraps >= S.cellars;
    case 'one': return !has(S, id) && (!u.need || u.need(S));
  }
  return false;
}

export const canAfford = (S, id) => { const c = costOf(S, id); return !!c && Object.entries(c).every(([r, v]) => S[r] >= v); };
export const canBuy = (S, id) => available(S, id) && canAfford(S, id);

// Shows when available and you have a third of the price. Once shown it stays until bought.
export function visible(S, id) {
  if (!available(S, id)) return false;
  if (S.seen[id] || count(S, id) > 0) return true;
  // A tunnel you have the map for, and the next pair of eyes, are goals: always on the board.
  if (id === 'dig' || id === 'eyes') return true;
  const c = costOf(S, id);
  return Object.entries(c).every(([r, v]) => S[r] >= v * 0.33);
}

export function buy(S, id) {
  if (!canBuy(S, id)) return false;
  for (const [r, v] of Object.entries(costOf(S, id))) S[r] -= v;
  const u = BY_ID[id];
  if (u.kind === 'eyes') S.eyes++;
  else if (u.kind === 'dig') { S.cellars++; delete S.seen.dig; }
  else S.owned[id] = count(S, id) + 1;
  if (u.unlock) S.unlocked[u.unlock] = true;
  if (u.kind === 'eyes') delete S.seen.eyes;
  return true;
}

export const SHOP_ORDER = ['dig', 'eyes', ...ONEOFFS.map(o => o.id), ...HELPERS.map(h => h.id), ...BATTERIES.map(b => b.id), ...BULBS.map(b => b.id)];

// Phase for music and the look: 1 cellar work, 2 volts, 3 light, 4 the deep cellars, 'up' the ending.
export function phase(S) {
  if (S.ended) return 'up';
  if (S.cellars >= 6) return 4;
  if (S.unlocked.light) return 3;
  if (S.unlocked.volts) return 2;
  return 1;
}

export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 10 && n % 1) return n.toFixed(1);
  n = Math.floor(n);
  if (n < 1e4) return n.toLocaleString('en-US');
  const units = [[1e12, ' trillion'], [1e9, ' billion'], [1e6, ' million'], [1e3, 'k']];
  for (const [v, s] of units) if (n >= v) { const x = n / v; return (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)) + s; }
  return String(n);
}
const UNITS = { lemons: 'lemons', duds: 'duds', volts: 'volts', light: 'light' };
export const fmtCost = c => Object.entries(c).map(([r, v]) => `${fmt(v)} ${UNITS[r]}`).join(' + ');
