// Very Bright, Actually: the rules. index.html draws them; sim.mjs plays them headless.
//
// Comets fall at night. Catch them (by hand, later the Wool Folk), and they go down to the cellar
// frozen. By day the sun thaws the cellar unless it's kept cold. The lamp thaws comets on purpose
// at night and turns them into Shine; Shine buys lenses. Peak brightness earns Almanac stars.

export const CYCLE = 120;                 // seconds per night + day
export const STAR_AT = [0, 5, 800, 2e5, 5e8, 5e11]; // peak brightness (Shine/s) for each star
export const THAW_GOAL = 2e10;             // comets in the cellar for the Great Thaw
export const OFFLINE_CAP = 4 * 3600, OFFLINE_RATE = 0.06;
export const PLACES = ['nowhere', 'the jetty', 'Gull Rock', 'Port Mallow', 'the cliffs of Ord', 'the Almanac office'];

export function newState() {
  return {
    comets: 0, shine: 0, caught: 0, shone: 0, t: 0, clock: 4, night: 1,
    lv: {}, odd: {}, lens: {}, folk: 0, rota: false, knit: false,
    split: { night: 0.3, day: 0.5 }, // share of crew on the Lamp at night / on the Beach by day
    shift: 'night', washed: 0, lumps: 0, wasted: 0, peak: 0, stars: 0,
    surveyor: false, asked: false, ended: false, pleas: 0, thawed: 0,
    seen: [], shopTab: 'comets', lastSeen: Date.now(), bells: 0,
  };
}
export function load(raw) {
  const S = Object.assign(newState(), raw || {});
  S.split = Object.assign({ night: 0.3, day: 0.5 }, S.split || {});
  for (const k of ['lv', 'odd', 'lens']) S[k] = S[k] || {};
  if (S.ended) { S.surveyor = true; S.stars = 5; }
  return S;
}

const L = (S, id) => S.lv[id] || 0;
export const lvl = L;
export const nightLen = S => CYCLE * (S.lens[6] === 'a' ? 0.8 : 0.68);
export const isNight = S => S.clock < nightLen(S);
export function phase(S) { return S.ended ? 5 : S.surveyor ? 4 : S.knit ? 3 : S.rota ? 2 : 1; }

// ---------- Derived numbers ----------
export function stats(S) {
  const lens = r => S.lens[r];
  const call = 1 + 0.5 * L(S, 'call');
  const V = call * Math.pow(2, Math.min(5, L(S, 'felt'))) * Math.pow(1.6, Math.max(0, L(S, 'felt') - 5)) * (lens(3) === 'b' ? 1.6 : 1) * (lens(7) === 'b' ? 2 : 1);
  const spawn = 1.0 * Math.pow(1.2, L(S, 'whistle')) * (lens(1) === 'b' ? 1.4 : 1);
  const hit = Math.min(0.95, 0.55 + 0.06 * L(S, 'net') + (lens(1) === 'a' ? 0.15 : 0));
  const polish = Math.pow(1.5, L(S, 'polish')) * (lens(7) === 'a' ? 3 : lens(7) === 'b' ? 1.5 : 1);
  const tail = 0.6 * Math.pow(1.6, L(S, 'tails')) * (lens(3) === 'a' ? 3 : 1);
  // Crew: before the Rota Board every Wool Folk nets at night and dozes by day.
  const onShift = S.rota ? S.shift : 'night';
  const night = onShift === 'night', crew = S.folk;
  const lampFolk = S.rota && night ? Math.round(crew * S.split.night) : 0;
  const netFolk = night ? crew - lampFolk : 0;
  const beachFolk = S.rota && !night ? Math.round(crew * S.split.day) : 0;
  const cellarFolk = S.rota && !night ? crew - beachFolk : 0;
  const netPow = 0.35 * V * Math.pow(1.8, L(S, 'needles')) * (lens(4) === 'a' ? 2 : 1);
  const lampPow = 0.2 * V * Math.pow(1.7, L(S, 'wicks')) * (lens(5) === 'b' ? 2.5 : 1);
  const lumen = 3 * Math.pow(1.4, L(S, 'mirror')) * (lens(5) === 'a' ? 2 : 1);
  const beachPow = 0.8 * V * Math.pow(1.8, L(S, 'buckets')) * (lens(4) === 'b' ? 3 : 1);
  const cold = 1.5 * L(S, 'door') + cellarFolk * Math.pow(2, L(S, 'socks')) * 0.5;
  const thaw = 0.006 * 3 / (3 + cold) * (lens(2) === 'a' ? 0.5 : 1) * (lens(6) === 'b' ? 0.25 : 1);
  return { V, call, spawn, hit, tail, polish, netPow, lampPow, lumen, beachPow, cold, thaw, lampFolk, netFolk, beachFolk, cellarFolk,
    hand: !S.rota, onShift };
}

// Rates right now, for the HUD (per second).
export function rates(S) {
  const st = stats(S), n = isNight(S) && !S.ended;
  const crewNight = S.rota ? S.shift === 'night' : true;
  const net = n && crewNight ? st.netFolk * st.netPow : 0;
  const burn = n && crewNight ? Math.min(st.lampFolk * st.lampPow, S.comets / 1 + net) : 0;
  const hand = n && st.hand ? st.spawn * st.hit * st.V : 0;
  const beach = !n && !crewNight ? Math.min(st.beachFolk * st.beachPow, S.washed) : 0;
  const thaw = !n ? S.comets * st.thaw : 0;
  const bright = (burn * st.lumen + (n && st.hand ? st.spawn * st.hit * st.V * st.tail : 0)) * st.polish;
  return { net, burn, hand, beach, thaw, bright, comets: net + hand + beach - burn - thaw, shine: burn * st.lumen };
}

// ---------- Time ----------
// One step of the world. Hand catches come from the page (or the sim) via catchOne().
export function step(S, dt, out = []) {
  if (S.ended) return out;
  const st = stats(S);
  const wasNight = isNight(S);
  S.t += dt; S.clock += dt;
  if (S.clock >= CYCLE) { S.clock -= CYCLE; S.night++; out.push({ type: 'dusk' }); }
  const night = isNight(S);
  if (wasNight && !night) {
    // Dawn: the misses wash up on the shore, still cold from the sea.
    S.lumps = S.rota ? 0 : Math.min(8, Math.max(2, Math.round(S.washed / Math.max(1, st.V) / 3)));
    S.wasted = 0;
    out.push({ type: 'dawn', washed: S.washed });
  }
  if (!wasNight && night) { S.washed = 0; S.lumps = 0; }
  if (S.knit) {
    const want = night ? 'night' : 'day';
    if (S.shift !== want) { S.shift = want; out.push({ type: 'shift', auto: true }); }
  }
  const crewNight = S.rota ? S.shift === 'night' : true;
  if (night) {
    // The shower: most of it falls in the sea, and some of that washes up by morning.
    S.washed += st.spawn * st.V * dt * (st.hand ? (1 - st.hit) * 2.5 : 2);
    if (crewNight) {
      const net = st.netFolk * st.netPow * dt;
      S.comets += net; S.caught += net;
      const burn = Math.min(st.lampFolk * st.lampPow * dt, S.comets);
      S.comets -= burn;
      const light = burn * st.lumen;
      S.shine += light; S.shone += light;
      noteBright(S, (light / dt + (st.hand ? st.spawn * st.hit * st.V * st.tail : 0)) * st.polish, out);
    }
  } else {
    // Day: the sun thaws the cellar. The glow is wasted (unless the Glow Lens catches it).
    const lost = S.comets * st.thaw * dt;
    S.comets -= lost; S.wasted += lost;
    if (S.lens[2] === 'b') { const l = lost * st.lumen * 0.5; S.shine += l; S.shone += l; }
    if (!crewNight) {
      const got = Math.min(st.beachFolk * st.beachPow * dt, S.washed);
      S.washed -= got; S.comets += got; S.caught += got;
    }
  }
  checkSurveyor(S, out);
  return out;
}

function noteBright(S, b, out) {
  if (b <= S.peak) return;
  S.peak = b;
  while (S.stars < 5 && S.peak >= STAR_AT[S.stars + 1]) { S.stars++; out.push({ type: 'star', stars: S.stars }); }
}
function checkSurveyor(S, out) {
  if (!S.surveyor && S.stars >= 5) { S.surveyor = true; out.push({ type: 'surveyor' }); }
}

// A hand catch: one felt comet into the net.
export function catchOne(S, out = []) {
  const st = stats(S);
  if (!st.hand || S.ended) return out;
  S.comets += st.V; S.caught += st.V;
  const light = st.V * st.tail;
  S.shine += light; S.shone += light;
  noteBright(S, st.spawn * st.hit * st.V * st.tail * st.polish, out);
  checkSurveyor(S, out);
  out.push({ type: 'catch', n: st.V, shine: light });
  return out;
}
// Gather one washed-up lump from the shore by day.
export function gather(S, out = []) {
  if (S.lumps <= 0 || S.washed <= 0) return out;
  const n = S.washed / S.lumps;
  S.washed -= n; S.lumps--; S.comets += n; S.caught += n;
  out.push({ type: 'gather', n });
  return out;
}
// The shift bell: the crew swap to the plan for the time of day.
export function ringBell(S, out = []) {
  if (!S.rota) return out;
  const want = isNight(S) ? 'night' : 'day';
  if (S.shift === want) { out.push({ type: 'bellEarly' }); return out; }
  S.shift = want; S.bells++;
  out.push({ type: 'shift', auto: false });
  return out;
}
export const bellNeeded = S => S.rota && !S.knit && S.shift !== (isNight(S) ? 'night' : 'day');

// ---------- Offline: the Wool Folk work best when nobody is looking ----------
export function offline(S, secs) {
  if (S.ended || secs < 60 || S.folk <= 0) return null;
  const t = Math.min(secs, OFFLINE_CAP), k = t * OFFLINE_RATE;
  const st0 = stats(S);
  const nf = nightLen(S) / CYCLE;
  // Average a night shift and a day shift with the current plans.
  const sv = S.shift; S.shift = 'night';
  const sn = stats(S); S.shift = 'day';
  const sd = stats(S); S.shift = sv;
  const net = sn.netFolk * sn.netPow, burn = Math.min(sn.lampFolk * sn.lampPow, net * 0.9);
  const beach = S.rota ? Math.min(sd.beachFolk * sd.beachPow, st0.spawn * st0.V * 2 * nf / (1 - nf)) : 0;
  const comets = Math.max(0, (net - burn) * nf + beach * (1 - nf)) * k;
  const shine = burn * sn.lumen * nf * k;
  const room = S.surveyor ? Math.max(0, THAW_GOAL * 0.98 - S.comets) : Infinity; // never finish while away
  const got = { secs: t, comets: Math.min(comets, room), shine };
  S.comets += got.comets; S.caught += got.comets; S.shine += shine; S.shone += shine;
  return got;
}

// ---------- The shop ----------
// Comets buy the lighthouse and its crew; Shine buys lenses. Lens rings are either/or.
// Tuning knobs (sim.mjs --scan varies them).
export const T = { feltP: 1.2, needG: 3.3, needP: 1.1, folkG: 1.19, callG: 6, rota: 2e6, folkBase: 2500, knit: 3e8 };
const geo = (base, g, p = 1) => l => Math.ceil(base * Math.pow(g, Math.pow(l, p)));
export const UPGRADES = [
  { id: 'net', name: 'Bigger Net', max: 5, cost: geo(8, 2.5), show: S => S.caught >= 3,
    desc: 'Another round of knitting on the net. Easier to get under a comet.' },
  { id: 'felt', name: 'Felt Them Together', max: 30, cost: l => geo(15, 2.5, T.feltP)(l), show: S => S.caught >= 8,
    desc: 'Felting needles in the net. Each comet you catch comes matted up with more: ×1.6 comets per catch, for everyone.' },
  { id: 'whistle', name: 'Comet Whistle', max: 6, cost: geo(30, 2.8), show: S => S.caught >= 20,
    desc: 'A whistle only comets can hear. More of them fall this way: +20% comets in the sky.' },
  { id: 'tails', name: 'Brighter Tails', max: 8, cost: geo(30, 3), show: S => S.caught >= 15 && !S.rota,
    desc: 'Comb the tails as they come in. Every comet you catch by hand shines brighter on the way down: ×1.6 Shine.' },
  { id: 'door', name: 'Cellar Door', max: 6, cost: geo(80, 3.4), show: S => S.night >= 2 || S.caught >= 80,
    desc: 'A thicker felt door for the cellar. Keeps the sun off the frozen comets by day.' },
  { id: 'folk', name: 'Wool Folk', max: 999, cost: l => geo(T.folkBase, T.folkG)(l), show: S => S.caught >= T.folkBase * 2,
    desc: 'Unpick one more row of the keeper\'s old jumper and knit a little helper. Wool Folk catch comets at night, and work hardest when nobody\'s looking.' },
  { id: 'needles', name: 'Knitting Needles', max: 12, cost: l => geo(900, T.needG, T.needP)(l), show: S => S.folk >= 2,
    desc: 'Better needles, tighter nets. Each Wool Folk on the nets catches ×1.8.' },
  { id: 'rota', name: 'The Rota Board', max: 1, cost: () => T.rota, show: S => S.folk >= 6,
    desc: 'A felt board with every Wool Folk\'s name. Sallow retires its own net and starts running shifts: Nets or Lamp at night, Cellar or Beach by day.' },
  { id: 'wicks', name: 'Wool Wicks', max: 12, cost: geo(9000, 3, 1.1), show: S => S.rota,
    desc: 'Woollen wicks for the lamp. Lamp crew thaw ×1.7 comets a night, for ×1.7 the light.' },
  { id: 'buckets', name: 'Beach Buckets', max: 10, cost: geo(7000, 3, 1.1), show: S => S.rota,
    desc: 'Little felt buckets. Each Wool Folk on the beach gathers ×1.8 of what washed up.' },
  { id: 'socks', name: 'Thermal Socks', max: 10, cost: geo(12000, 3.6, 1.1), show: S => S.rota,
    desc: 'Socks for the cellar crew, who stand on ice all day. Each one keeps ×2 the cold.' },
  { id: 'knit', name: 'A Knitted Rota', max: 1, cost: () => T.knit, show: S => S.rota && S.bells >= 6,
    desc: 'The Wool Folk knit their own rota and change shifts at dawn and dusk without the bell. Nobody taught them that.' },
];
export const ONEOFFS = [
  { id: 'plate', name: 'A Name Plate', cost: 60, show: S => S.caught >= 40,
    desc: 'Brass. SALLOW POINT LIGHT. Under it, smaller, engraved by Sallow: “very bright, actually.”' },
  { id: 'count', name: 'Count the Comets', cost: 2500, show: S => S.folk >= 1,
    desc: 'Sallow counts the cellar every night, to be sure. There is always one more comet than there should be.' },
  { id: 'chair', name: 'The Keeper\'s Armchair', cost: 4e5, show: S => S.rota,
    desc: 'Reupholstered in felt. The keeper went for a walk in 1911. The chair is still warm.' },
  { id: 'sixth', name: 'Ask About a Sixth Star', cost: 3e7, show: S => S.stars >= 3,
    desc: 'Write to the Almanac and ask, purely out of interest, whether there is a sixth star.' },
  { id: 'permit', name: 'Fireworks Permit', cost: 4e8, show: S => S.stars >= 4,
    desc: 'Permit to cause one (1) large light, once. Sallow has no plans. Sallow would just like to have it.' },
];
// Lens Workshop: seven rings, each holds one lens. Paid in Shine.
export const RINGS = [
  null,
  { cost: 25, show: S => S.shone >= 8, a: ['Lure Lens', 'The beam bends comets toward the net. Much easier to catch.'], b: ['Twin Lens', 'Two beams. Twice the comets notice you: +40% comets in the sky.'] },
  { cost: 300, show: S => S.night >= 3 || S.shone >= 150, a: ['Frost Lens', 'A cold beam down the cellar stairs. Day thaw is halved.'], b: ['Glow Lens', 'A lens in the cellar floor. When the sun thaws a comet, half its glow is caught as Shine instead of wasted.'] },
  { cost: 3500, show: S => S.shone >= 1500, a: ['Long Lens', 'Long tails: hand-caught comets give ×3 Shine.'], b: ['Fat Lens', 'Heavy heads: every comet is ×1.6 bigger, for everyone, forever.'] },
  { cost: 6e4, show: S => S.rota, a: ['Owl Lens', 'The night crew can see in the dark. Nets catch ×2.'], b: ['Tide Lens', 'The beach crew read the tide. They gather ×3 by day.'] },
  { cost: 1.5e6, show: S => S.rota && S.shone >= 3e5, a: ['Slow Lens', 'The lamp focuses better: each thawed comet gives ×2 light.'], b: ['Wide Lens', 'Open the lamp up. Lamp crew thaw ×2.5 comets.'] },
  { cost: 6e7, show: S => S.knit || S.shone >= 1.5e7, a: ['Polar Lens', 'Bends the dark. Nights last longer (80% of the day).'], b: ['Cold-Sun Lens', 'Turns the sun\'s heat aside. Day thaw ×¼.'] },
  { cost: 3e9, show: S => S.stars >= 4, a: ['Crown Lens', 'The great lens. All light ×3.'], b: ['Twin Crown', 'All light ×1.5 and every comet ×2.'] },
];
export const LENS_POLISH = { id: 'polish', name: 'Polish the Lens', max: 30, cost: geo(40, 4.2, 1.1), show: S => S.shone >= 25,
  desc: 'A felt cloth and patience. Sallow looks ×1.5 brighter from far away (brightness, not Shine).' };
export const MIRROR = { id: 'mirror', name: 'Mirror Backing', max: 20, cost: geo(4e4, 4.5, 1.1), show: S => S.rota,
  desc: 'Silvered felt behind the lamp. Each thawed comet in the lamp gives ×1.4 light.' };

export const CALL = { id: 'call', name: 'Beacon Call', max: 30, cost: l => geo(3e3, T.callG, 1.15)(l), show: S => S.shone >= 3000,
  desc: 'Comets are drawn to bright things. Flash a long-short-long and they come down in bigger clumps: +50% comets per catch (adds up).' };
export const BY_ID = Object.fromEntries([...UPGRADES, ...ONEOFFS, LENS_POLISH, MIRROR, CALL].map(u => [u.id, u]));

// Everything the column could show: [{ id, name, desc, cost, cur, kind, l, max }]
export function items(S) {
  const out = [];
  if (S.ended) return out;
  const seen = id => S.seen.includes(id);
  for (const u of UPGRADES) {
    const l = L(S, u.id);
    if (l >= u.max || (u.id === 'rota' && S.rota) || (u.id === 'knit' && S.knit)) continue;
    if (!(u.show(S) || seen(u.id))) continue;
    out.push({ id: u.id, name: u.name, desc: u.desc, cost: u.cost(l), cur: 'comets', kind: u.max > 1 ? 'lvl' : 'one', l, max: u.max });
  }
  for (const o of ONEOFFS) if (!S.odd[o.id] && (o.show(S) || seen(o.id))) out.push({ id: o.id, name: o.name, desc: o.desc, cost: o.cost, cur: 'comets', kind: 'odd' });
  for (const u of [LENS_POLISH, CALL, MIRROR]) {
    const l = L(S, u.id);
    if (l < u.max && (u.show(S) || seen(u.id))) out.push({ id: u.id, name: u.name, desc: u.desc, cost: u.cost(l), cur: 'shine', kind: 'lvl', l, max: u.max });
  }
  for (let r = 1; r < RINGS.length; r++) {
    const R = RINGS[r];
    if (S.lens[r] || !(R.show(S) || seen('r' + r + 'a'))) continue;
    for (const side of ['a', 'b']) out.push({ id: `r${r}${side}`, name: R[side][0], desc: R[side][1], cost: R.cost, cur: 'shine', kind: 'lens', ring: r, side });
  }
  return out;
}

// The Bought shelf: everything that has left the shop for good, in the order the shop lists it.
// Nothing here ever resets, so it only grows. [{ id, name, desc, kind, l?, max?, ring?, side? }]
export function bought(S) {
  const out = [];
  for (const u of [...UPGRADES, LENS_POLISH, CALL, MIRROR]) {
    const l = L(S, u.id);
    const done = l >= u.max || (u.id === 'rota' && S.rota) || (u.id === 'knit' && S.knit);
    if (done) out.push({ id: u.id, name: u.name, desc: u.desc, kind: u.max > 1 ? 'lvl' : 'one', l: Math.max(l, 1), max: u.max });
  }
  for (const o of ONEOFFS) if (S.odd[o.id]) out.push({ id: o.id, name: o.name, desc: o.desc, kind: 'odd' });
  for (let r = 1; r < RINGS.length; r++) {
    const side = S.lens[r];
    if (side !== 'a' && side !== 'b') continue;
    out.push({ id: `r${r}${side}`, name: RINGS[r][side][0], desc: RINGS[r][side][1], kind: 'lens', ring: r, side });
  }
  return out;
}

export function buy(S, id, out = []) {
  const it = items(S).find(i => i.id === id);
  if (!it) return false;
  const have = it.cur === 'comets' ? S.comets : S.shine;
  if (have < it.cost) return false;
  if (it.cur === 'comets') S.comets -= it.cost; else S.shine -= it.cost;
  if (it.kind === 'lens') S.lens[it.ring] = it.side;
  else if (it.kind === 'odd') S.odd[id] = 1;
  else if (id === 'folk') { S.lv.folk = L(S, 'folk') + 1; S.folk++; }
  else if (id === 'rota') { S.rota = true; S.shift = isNight(S) ? 'night' : 'day'; }
  else if (id === 'knit') { S.knit = true; }
  else S.lv[id] = L(S, id) + 1;
  if (id === 'sixth') S.asked = true;
  out.push({ type: 'buy', id, name: it.name, kind: it.kind });
  return true;
}

// ---------- The Great Thaw ----------
export const canThaw = S => S.surveyor && !S.ended && S.comets >= THAW_GOAL;
export function thaw(S, out = []) {
  if (!canThaw(S)) return false;
  S.thawed = S.comets; S.comets = 0; S.ended = true;
  out.push({ type: 'end', thawed: S.thawed });
  return true;
}

export function fmt(n) {
  n = Math.max(0, n);
  for (const [v, name] of [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']]) {
    if (n >= v) { const x = n / v; return `${x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)} ${name}`; }
  }
  return Math.floor(n).toLocaleString('en-US');
}
