// Squeak Shift: the rules. index.html draws them; sim.mjs plays them headless.
//
// Nurse Hoo tunes rubber ducks on a tongue-depressor slingshot and hides them in pranks around
// Bramble Ward. A duck is tuned by how far its reed is stretched: pitch is a number of semitones
// above C (0..11). The six whole-tone lines (C D E F# G# A#) are the notes; exactly between two
// lines a duck honks one of the other six (the hidden mechanic). Each prank (a blueprint sheet)
// needs ducks on given notes. The first half runs on pennies and Hoo's clipboard (a priority queue
// of chores); Matron's Budget Review stops the money, and the night staff volunteer for favours.

export const NIGHT = 150;                 // seconds per night shift (for the count and the Toy Fund)
export const TOY_FUND = 3;                // pence a night, until the Budget Review
export const OFFLINE_CAP = 3 * 3600, OFFLINE_RATE = 0.1;
export const WAKE_AT = 26;                // seconds a bell rings before the child wakes up
export const HUSH_MAX = 3;
export const MATRON_ROUND = 22;
export const MAX_STAFF = 12;
export const GIVE_FAVOURS = 40;           // the last purchase also needs this many favours (it takes them all)
// Tunables (the sim can override them with --T='{...}').
export const T = {
  chair: [24, 20, 16.5, 14, 12, 10], bellGap: 70, cover: [55, 44, 35, 28], lost: 65, tune: [10, 7.5, 5.5],
  scrounge: 340, staffTune: 65, staffCover: 160, smile: 240, favDuck: 2, drift: 560,
  recruit: 4, recruitStep: 3, grow: 1, fgrow: 1,
  fit: [0, 5, 12, 24, 40, 14, 18, 22, 26, 30, 32],
};
export const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const isHonk = n => n % 2 === 1;

// The pranks, in order. Odd notes are honks: the hidden half of the gauge.
export const PLANS = [
  { id: 'door', name: 'The Ward Door', notes: [0, 4], gag: 'The ward door now goes “shh-boop” when it opens. The night porter has opened it nine times.' },
  { id: 'trolley', name: 'The Tea Trolley', notes: [0, 4, 8], gag: 'The tea trolley plays a chord, but only when it is carrying biscuits. Everyone now knows when there are biscuits.' },
  { id: 'lift', name: 'The Lift', notes: [0, 2, 4, 6, 8], gag: 'The lift politely plays “going up” all the way down to the basement.' },
  { id: 'chute', name: 'The Linen Chute', notes: [10, 8, 6, 4, 2, 0, 2], gag: 'Every sheet that goes down the linen chute slides down a scale and lands on a little “ta-da”.' },
  { id: 'chair', name: "Matron's Chair", notes: [0, 4, 8, 10, 8, 4, 0, 6, 2], gag: 'Six o’clock handover. Matron Bramble sits down. Her chair plays a polka, all of it, in front of the entire day shift.' },
  { id: 'clock', name: "The Porters' Clock", notes: [0, 4, 7, 4, 0, 7, 2, 4], gag: 'The porters’ clock strikes the hour with a squeak, a honk and a sort of bow.' },
  { id: 'hatch', name: 'The Pharmacy Hatch', notes: [2, 6, 9, 6, 2, 9, 5, 2, 6, 10], gag: 'The pharmacy hatch sings “one moment please” in a voice like a small brass band.' },
  { id: 'barrier', name: 'The Car Park Barrier', notes: [0, 2, 4, 5, 7, 9, 11, 10, 8, 6, 4, 0], gag: 'The car park barrier lifts with a fanfare and comes down with a sigh. Ambulance drivers wave at it.' },
  { id: 'stairs', name: 'The Fire Stairs', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 2], gag: 'Every step of the fire stairs is a note. The fire drill becomes a scale. Nobody walks; everyone hops.' },
  { id: 'office', name: "Matron's Office", notes: [0, 4, 8, 4, 0, 3, 7, 11, 7, 3, 2, 6, 10, 6, 2, 0], gag: 'Matron Bramble opens her office door and the whole room plays the polka, from the filing cabinet to the kettle. She stands there for a long time. Then she shuts the door, very quietly, and hums it.' },
  { id: 'pool', name: 'The Dawn Polka', notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], gag: 'At dawn, the hydrotherapy pool plays the polka on its own, every note on the gauge, both scales at once. Bramble Ward wakes up laughing.' },
];
export const TOTAL_DUCKS = PLANS.reduce((n, p) => n + p.notes.length, 0); // 98
export const REVIEW_AT = 5;               // the Budget Review follows plan 5 (Matron's chair)

// Hoo's clipboard: chores she does by herself, first ticked one that can be done wins.
export const TASKS = {
  bell:   { name: 'Answer call bells', icon: '🛎' },
  chairs: { name: 'Return wheelchairs', icon: '♿' },
  buy:    { name: 'Buy ducks', icon: '🦆' },
  tune:   { name: 'Tune ducks by feel', icon: '🎚' },
  lost:   { name: 'Check lost property', icon: '🧺' },
  cover:  { name: 'Cover a break', icon: '☕' },
};
export const JOBS = {
  scrounge: { name: 'Scrounge', icon: '🦆', desc: 'find ducks in cupboards, bath bags and drains' },
  tune:     { name: 'Tune', icon: '🎚', desc: 'tune ducks by ear for the current sheet' },
  hush:     { name: 'Hush', icon: '🤫', desc: 'answer call bells before anyone wakes' },
  cover:    { name: 'Cover', icon: '☕', desc: 'cover each other’s breaks for favours' },
};

export function newState() {
  return {
    t: 0, night: 1, nightT: 0,
    pence: 3, favours: 0, raw: 2, rack: Array(12).fill(0),
    plan: 0, slots: [], stars: 0, installed: 0, perfect: 0, tuned: 0, honks: 0, wheels: 0, bellsAnswered: 0,
    lv: {},
    queue: [{ id: 'bell', on: true }, { id: 'chairs', on: true, upto: 20 }, { id: 'buy', on: true, stock: 2 }],
    qTask: null, qProg: 0,
    bells: [], bellT: 20, hush: HUSH_MAX, hushT: 0, matron: 0, rounds: 0,
    review: false, staff: 0, jobs: { scrounge: 0, tune: 0, hush: 0, cover: 0 }, jobProg: { scrounge: 0, tune: 0, hush: 0, cover: 0 },
    honk: false, honkWait: 0, pipAsked: 0,
    ready: false, fitting: false, flats: [], flatT: 0, repaired: 0,
    ended: false, given: null, seen: [], shopTab: 'p', lastSeen: Date.now(),
  };
}
export function load(raw) {
  const S = Object.assign(newState(), raw || {});
  S.rack = Array.from({ length: 12 }, (_, i) => (raw && raw.rack && raw.rack[i]) || 0);
  S.lv = S.lv || {};
  S.jobs = Object.assign({ scrounge: 0, tune: 0, hush: 0, cover: 0 }, S.jobs || {});
  S.jobProg = Object.assign({ scrounge: 0, tune: 0, hush: 0, cover: 0 }, S.jobProg || {});
  S.bells = Array.isArray(S.bells) ? S.bells : [];
  S.flats = Array.isArray(S.flats) ? S.flats : [];
  if (!Array.isArray(S.queue)) S.queue = newState().queue;
  for (const id of knownTasks(S)) if (!S.queue.some(q => q.id === id)) S.queue.push({ id, on: false, stock: id === 'buy' ? 2 : undefined });
  if (S.ended) { S.plan = PLANS.length; S.installed = TOTAL_DUCKS; S.review = true; }
  if (S.plan >= REVIEW_AT) S.review = true;
  if (S.plan < PLANS.length && S.slots.length !== PLANS[S.plan].notes.length) S.slots = PLANS[S.plan].notes.map(() => 0);
  return S;
}

export const L = (S, id) => S.lv[id] || 0;
export function phase(S) { return S.ended ? 4 : S.plan >= PLANS.length - 1 ? 3 : S.review ? 2 : 1; }
export const plan = S => PLANS[S.plan] || null;

// ---------- Derived numbers ----------
export function stats(S) {
  const fork = L(S, 'fork');
  return {
    lines: 2 + L(S, 'clip'),
    chairTime: T.chair[L(S, 'oil')],
    deposit: 1 + L(S, 'spanner'),
    fund: TOY_FUND + L(S, 'memo'),
    smile: T.smile / (1 + 0.25 * L(S, 'polish') + 0.3 * L(S, 'cushion')),
    giftChance: 0.22 + 0.1 * L(S, 'pull'),
    price: S.review ? T.favDuck : L(S, 'card') ? 2 : 3,
    tuneTime: T.tune[L(S, 'quick')],
    ear: Math.min(0.92, 0.5 + 0.14 * L(S, 'ear')),
    lostTime: T.lost, coverTime: T.cover[L(S, 'kettle')],
    noteTol: [0.3, 0.37, 0.42, 0.46][fork],
    perfectTol: 0.1 + 0.035 * fork,
    honkTol: L(S, 'whistle') ? 0.24 : 0.13,
    bellGap: T.bellGap * Math.pow(1.4, L(S, 'lamp')),
    wakeAt: WAKE_AT + (L(S, 'slippers') ? 14 : 0),
    // Night staff
    scroungeRate: (1 / T.scrounge) * Math.pow(1.35, L(S, 'bags')) * Math.pow(1.3, L(S, 'torch')) * (L(S, 'map') ? 1.5 : 1),
    staffTune: (1 / T.staffTune) * Math.pow(1.3, L(S, 'sonar')),
    staffEar: Math.min(0.95, 0.6 + 0.08 * L(S, 'sonar')),
    coverRate: (1 / T.staffCover) * Math.pow(1.35, L(S, 'biscuits')),
    staffHonk: L(S, 'lessons') > 0,
  };
}
export const knownTasks = S => ['bell', 'chairs', 'buy', ...(L(S, 'feel') ? ['tune'] : []), ...(L(S, 'lostkey') ? ['lost'] : []), ...(S.review ? ['cover'] : [])];
export function taskTime(S, id) {
  const st = stats(S);
  return { bell: 3, chairs: st.chairTime, buy: 2, tune: st.tuneTime, lost: st.lostTime, cover: st.coverTime }[id];
}
// Why a ticked chore can't run right now (null when it can).
export function taskBlock(S, q) {
  const st = stats(S);
  switch (q.id) {
    case 'bell': return S.bells.length ? null : 'no bells';
    case 'chairs': return S.review ? 'no coin locks' : S.pence >= (q.upto ?? 20) ? `have ${q.upto ?? 20}p` : null;
    case 'buy': return S.raw >= (q.stock ?? 2) ? `have ${q.stock ?? 2}` : have(S, duckCur(S)) < st.price ? (S.review ? 'no favours' : 'no pennies') : null;
    case 'tune': return S.matron > 0 ? 'Matron' : S.raw < 1 ? 'no ducks' : autoNote(S, false) == null ? 'nothing to tune' : null;
    case 'lost': return null;
    case 'cover': return S.review ? null : 'no favours yet';
  }
  return 'unknown';
}
// Notes still wanted: open slots on this sheet and the next, minus ducks already on the rack.
export function wanted(S) {
  const want = Array(12).fill(0);
  for (let k = S.plan; k < Math.min(PLANS.length, S.plan + 2); k++) {
    PLANS[k].notes.forEach((n, i) => { if (!(k === S.plan && S.slots[i])) want[n]++; });
  }
  for (const [k, i] of S.flats) want[PLANS[k].notes[i]]++;
  for (let n = 0; n < 12; n++) want[n] = Math.max(0, want[n] - S.rack[n]);
  return want;
}
// The note an automatic tuner goes for: the most wanted one it can make.
export function autoNote(S, canHonk) {
  const want = wanted(S);
  let best = null;
  for (let n = 0; n < 12; n++) if ((canHonk || !isHonk(n)) && want[n] > 0 && (best == null || want[n] > want[best])) best = n;
  return best;
}

// ---------- Ducks ----------
// Where a tuned duck goes: into an open slot on the sheet if one wants that note, else the rack.
function place(S, note, perfect, out) {
  S.tuned++; if (isHonk(note)) S.honks++;
  const p = plan(S);
  const i = p ? p.notes.findIndex((n, k) => n === note && !S.slots[k]) : -1;
  if (i >= 0) {
    S.slots[i] = perfect ? 2 : 1; S.installed++; if (perfect) S.stars++;
    out.push({ type: 'slot', note, i, perfect });
    checkPlan(S, out);
  } else {
    // A flat duck in a fitted prank wants this note: swap it for the fresh one.
    const f = S.flats.findIndex(([k, j]) => PLANS[k].notes[j] === note);
    if (f >= 0) { const [k, j] = S.flats.splice(f, 1)[0]; S.repaired++; out.push({ type: 'repair', plan: k, i: j, note }); }
    else { S.rack[note]++; out.push({ type: 'rack', note, perfect }); }
  }
}
// After the Budget Review nothing gets replaced, and old rubber goes flat.
export const flatPlans = S => new Set(S.flats.map(f => f[0]));
function drift(S, dt, out) {
  const fitted = Math.min(S.plan, PLANS.length);
  S.flatT += dt * fitted / T.drift;
  while (S.flatT >= 1) {
    S.flatT--;
    const k = Math.floor(Math.random() * fitted), i = Math.floor(Math.random() * PLANS[k].notes.length);
    if (S.flats.some(f => f[0] === k && f[1] === i)) continue;
    S.flats.push([k, i]); out.push({ type: 'flat', plan: k, i, note: PLANS[k].notes[i] });
    // A rack duck on the same note goes straight in.
    const n = PLANS[k].notes[i];
    if (S.rack[n] > 0) { S.rack[n]--; S.flats.pop(); S.repaired++; out.push({ type: 'repair', plan: k, i, note: n, fromRack: true }); }
  }
}
function fillFromRack(S, out) {
  const p = plan(S); if (!p) return;
  p.notes.forEach((n, i) => { if (!S.slots[i] && S.rack[n] > 0) { S.rack[n]--; S.slots[i] = 1; S.installed++; out.push({ type: 'slot', note: n, i, fromRack: true }); } });
  checkPlan(S, out);
}
function checkPlan(S, out) {
  const p = plan(S);
  if (!p || S.slots.some(x => !x)) return;
  if (fitCost(S) > 0 && !S.fitting) { if (!S.ready) { S.ready = true; out.push({ type: 'ready', plan: S.plan }); } return; }
  S.ready = false; S.fitting = false;
  const k = S.plan, stars = S.stars;
  const bonus = S.review || k + 1 >= REVIEW_AT ? 0 : 3 + stars;
  const fav = S.review ? 4 + stars : 0;
  S.pence += bonus; S.favours += fav;
  S.plan++; S.stars = 0;
  out.push({ type: 'prank', plan: k, stars, pence: bonus, favours: fav });
  if (S.plan === REVIEW_AT && !S.review) budgetReview(S, out);
  if (S.plan < PLANS.length) { S.slots = PLANS[S.plan].notes.map(() => 0); fillFromRack(S, out); }
  else S.slots = [];
}
// Fitting a finished sheet costs tape and screws (pence), later favours: a goal on the meter.
export const fitCost = S => S.plan < PLANS.length ? T.fit[S.plan] : 0;
export const fitCur = S => S.plan >= REVIEW_AT ? 'f' : 'p';
export const canFit = S => !!S.ready && have(S, fitCur(S)) >= fitCost(S);
export function fit(S, out = []) {
  if (!canFit(S)) return false;
  if (fitCur(S) === 'p') S.pence -= fitCost(S); else S.favours -= fitCost(S);
  S.fitting = true; checkPlan(S, out);
  return true;
}
// The rule change: no more money. The staff were at handover too.
function budgetReview(S, out) {
  S.review = true; S.staff = 3; S.jobs = { scrounge: 1, tune: 1, hush: 0, cover: 1 }; S.favours += 15;
  // The wheelchair line is no use now; covering breaks takes its place on the clipboard.
  const ch = S.queue.find(q => q.id === 'chairs'); if (ch) ch.on = false;
  if (!S.queue.some(q => q.id === 'cover')) S.queue.splice(Math.max(0, S.queue.indexOf(ch)), 0, { id: 'cover', on: true });
  S.shopTab = 'f';
  out.push({ type: 'review' });
}

// Manual tuning: the slingshot lets go at `pitch` semitones above C.
export function judge(S, pitch) {
  const st = stats(S);
  const n = Math.round(pitch), d = Math.abs(pitch - n), note = ((n % 12) + 12) % 12;
  if (!isHonk(note)) {
    if (d <= st.noteTol) return { kind: 'note', note, perfect: d <= st.perfectTol, d };
    return { kind: 'off', note, d };
  }
  if (d <= st.honkTol) return { kind: 'honk', note, perfect: d <= st.honkTol * 0.5, d };
  return { kind: 'off', note, d };
}
export function tune(S, pitch, out = []) {
  if (S.raw < 1 || S.matron > 0 || S.ended) return null;
  const r = judge(S, pitch);
  if (r.kind === 'off') { out.push({ type: 'off', ...r }); return r; }
  S.raw--;
  if (r.perfect) S.perfect++;
  if (r.kind === 'honk' && !S.honk) { S.honk = true; out.push({ type: 'discover' }); }
  place(S, r.note, r.perfect, out);
  return r;
}
export function answerBell(S, i = 0, out = []) {
  const b = S.bells.splice(i, 1)[0];
  if (!b) return null;
  S.bellsAnswered++;
  // Sleepy children sometimes hand over a duck from their wash bag. Pip in Bed 4 only ever asks.
  const gift = b.bed !== 4 && b.seed < stats(S).giftChance;
  if (gift) S.raw++;
  if (b.bed === 4) S.pipAsked++;
  out.push({ type: 'answer', bed: b.bed, gift, pip: b.bed === 4 });
  return b;
}
export const duckCur = S => S.review ? 'f' : 'p';
export function buyDuck(S, out = []) {
  const st = stats(S);
  if (have(S, duckCur(S)) < st.price) return false;
  if (S.review) S.favours -= st.price; else S.pence -= st.price;
  S.raw++; out.push({ type: 'buyduck' });
  return true;
}

// ---------- The shop ----------
// cur 'p' pence, 'f' favours. After the Budget Review, anything still unbought for pence costs
// favours instead (the porters chip in), so nothing that has shown up ever disappears.
const ITEMS = [
  { id: 'glasses', name: 'Reading Glasses', cur: 'p', cost: 4, at: 1, kind: 'odd', desc: 'Half-moon reading glasses for Hoo. Owls can see in the dark. Hoo just thinks they look professional.' },
  { id: 'oil', name: 'Wheel Oil', cur: 'p', cost: 5, grow: 1.6, max: 5, at: 1, desc: 'Oiled wheelchairs roll back to the bay quicker, so Hoo returns them faster.' },
  { id: 'clip', name: 'Bigger Clipboard', cur: 'p', cost: 7, grow: 2, max: 4, at: 1, desc: 'Room for one more ticked chore on Hoo’s clipboard.' },
  { id: 'lamp', name: 'Night Lights', cur: 'p', cost: 8, grow: 2, max: 3, at: 2, desc: 'Little lights by every bed. Fewer children wake up wanting something, so call bells ring less often.' },
  { id: 'feel', name: 'Tune by Feel', cur: 'p', cost: 10, at: 3, kind: 'one', desc: 'Adds “Tune ducks by feel” to the clipboard: Hoo tunes ducks by herself for the current sheet. Slower than your hands, and she misses.' },
  { id: 'lostkey', name: 'Lost Property Key', cur: 'p', cost: 9, at: 3, kind: 'one', desc: 'Adds “Check lost property” to the clipboard. A free duck every time, if you don’t mind the wait.' },
  { id: 'fork', name: 'Tuning Fork', cur: 'p', cost: 9, grow: 1.8, max: 3, at: 2, desc: 'Each level widens the lines on the gauge, so near enough counts more often, and dead-on (★) is easier.' },
  { id: 'tag', name: 'Name-Tag Gun', cur: 'p', cost: 8, at: 2, kind: 'odd', desc: 'Prints tiny name tags. Hoo labels every duck with a child’s name. For inventory, she says.' },
  { id: 'slippers', name: 'Quiet Slippers', cur: 'p', cost: 11, at: 3, kind: 'one', desc: 'Hoo pads about without a sound, so a ringing bell takes longer to wake its child.' },
  { id: 'ear', name: 'A Good Ear', cur: 'p', cost: 12, grow: 1.7, max: 3, at: 3, req: 'feel', desc: 'Hoo’s tuning by feel hits the note more often.' },
  { id: 'quick', name: 'Quick Talons', cur: 'p', cost: 14, grow: 1.9, max: 2, at: 3, req: 'feel', desc: 'Hoo tunes ducks by feel faster.' },
  { id: 'chart', name: 'Bed Chart of Notes', cur: 'p', cost: 12, at: 4, kind: 'odd', desc: 'Hoo writes each child’s favourite note at the foot of their bed, beside their temperature. Nobody asked her to.' },
  { id: 'card', name: 'Gift Shop Loyalty Card', cur: 'p', cost: 20, at: 4, kind: 'one', desc: 'Ducks cost 2p instead of 3p. The tenth stamp is a free stamp.' },
  { id: 'spanner', name: 'Coin-Lock Spanner', cur: 'p', cost: 18, grow: 2.3, max: 2, at: 4, desc: 'Some wheelchairs take two pence. Then three. Hoo knows which ones now.' },
  { id: 'memo', name: 'A Strongly Worded Memo', cur: 'p', cost: 10, grow: 2.2, max: 3, at: 2, desc: 'Hoo writes to Matron Bramble asking for a bigger Toy Fund. Each memo gets one more penny a night. Matron underlines things.' },
  { id: 'pull', name: 'Longer Bell Pulls', cur: 'p', cost: 13, grow: 2, max: 2, at: 4, desc: 'Children can reach the bell without sitting up, so they’re half asleep when Hoo comes, and more likely to hand over a duck from their wash bag.' },
  { id: 'polish', name: 'Duck Polish', cur: 'p', cost: 15, grow: 1.8, max: 4, at: 4, desc: 'Shiny ducks squeak brighter, and every fitted prank makes people smile more often.' },
  { id: 'kazoo', name: 'Hospital Radio Request', cur: 'p', cost: 6, at: 3, kind: 'odd', desc: 'Hoo phones in a request for “anything with a tuba in it”. They play the shipping forecast.' },
  { id: 'wrap', name: 'Gift Wrap, Just in Case', cur: 'p', cost: 16, at: 4, kind: 'odd', desc: 'A roll of paper with ducks on it. Hoo is not planning anything. It was on offer.' },
  { id: 'accordion', name: 'A Very Small Accordion', cur: 'p', cost: 22, at: 4, kind: 'odd', desc: 'It has four buttons and plays one chord. Hoo practises in the sluice room.' },
  // After the Budget Review: favours.
  { id: 'recruit', name: 'Recruit a Volunteer', cur: 'f', cost: 5, at: REVIEW_AT, kind: 'staff', desc: 'Another night-shift volunteer joins the plan. Assign them a job under the clipboard.' },
  { id: 'bags', name: 'Laundry Bags', cur: 'f', cost: 6, grow: 1.5, max: 5, at: REVIEW_AT, desc: 'Scroungers carry more: each level finds ducks half as fast again.' },
  { id: 'sonar', name: 'Bat Sonar', cur: 'f', cost: 8, grow: 1.5, max: 5, at: REVIEW_AT, desc: 'Staff on Tune work faster and miss less. Bats hear squeaks you can’t.' },
  { id: 'biscuits', name: 'Staff Room Biscuits', cur: 'f', cost: 6, grow: 1.5, max: 5, at: REVIEW_AT, desc: 'Breaks are longer and better, so staff on Cover earn favours faster.' },
  { id: 'kettle', name: 'A Bigger Kettle', cur: 'f', cost: 6, grow: 1.6, max: 3, at: REVIEW_AT, desc: 'Hoo covers breaks faster: the tea is ready before anyone has finished saying “I’ll just pop the kettle on”.' },
  { id: 'map', name: 'Map of Every Cupboard', cur: 'f', cost: 12, at: REVIEW_AT + 1, kind: 'one', desc: 'The porters draw Hoo a map of every cupboard in the building. Scroungers find ducks half as fast again.' },
  { id: 'hat', name: "The Night Porter's Hat", cur: 'f', cost: 4, at: REVIEW_AT + 1, kind: 'odd', desc: 'He lends it to Hoo for luck. It is much too big. It has a small squeaky duck sewn inside the brim, from a previous night shift, long ago.' },
  { id: 'rota', name: 'A Polka Rota', cur: 'f', cost: 5, at: REVIEW_AT, kind: 'odd', desc: 'The night staff now take their breaks in two-four time.' },
  { id: 'whistle', name: 'Honk Whistle', cur: 'f', cost: 7, at: REVIEW_AT, kind: 'one', reqHonk: true, desc: 'Widens the gap between the lines where a duck honks, so honks are easier to hit.' },
  { id: 'lessons', name: 'Honking Lessons', cur: 'f', cost: 14, at: REVIEW_AT + 1, kind: 'one', reqHonk: true, desc: 'Staff on Tune learn to honk, so they can fill the “?” slots too.' },
  { id: 'torch', name: 'Head Torches', cur: 'f', cost: 9, grow: 1.6, max: 3, at: REVIEW_AT + 1, desc: 'Scroungers can see under the radiators now. More ducks than you’d think live under radiators.' },
  { id: 'cushion', name: 'Squeak Cushions', cur: 'f', cost: 10, grow: 1.6, max: 3, at: REVIEW_AT + 2, desc: 'Little cushions under every prank so they squeak warmer. Fitted pranks make people smile more often.' },
  { id: 'specs', name: "Matron's Spare Glasses", cur: 'f', cost: 9, at: REVIEW_AT + 2, kind: 'odd', desc: 'Found in the lift. Hoo hands them in. Matron says thank you, which she has never said before.' },
  { id: 'drawing', name: "Pip's Drawing", cur: 'f', cost: 3, at: REVIEW_AT + 2, kind: 'odd', desc: 'Pip in Bed 4 drew a duck and wrote “PIP’S” on it. Hoo pins it to the clipboard.' },
  { id: 'ribbon', name: 'A Lot of Ribbon', cur: 'f', cost: 18, at: REVIEW_AT + 4, kind: 'odd', desc: 'Ninety-eight lengths of ribbon, all the same, all curled. Hoo says it’s for the pool.' },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const staffCost = S => T.recruit + T.recruitStep * Math.max(0, S.staff - 3);

function itemView(S, it) {
  const l = L(S, it.id);
  let cost = it.id === 'recruit' ? staffCost(S) : Math.round(it.cost * (it.cur === 'p' ? T.grow : T.fgrow) * Math.pow(it.grow || 1, l));
  let cur = it.cur;
  if (cur === 'p' && S.review) { cur = 'f'; cost = Math.max(2, Math.ceil(cost / 3)); }
  return { ...it, l, cost, cur };
}
export function items(S) {
  if (S.ended) return [];
  return ITEMS.filter(it => {
    if (it.at > S.plan && !S.seen.includes(it.id)) return false;
    if (it.req && !L(S, it.req) && !S.seen.includes(it.id)) return false;
    if (it.reqHonk && !S.honk && !S.seen.includes(it.id)) return false;
    if (it.kind === 'staff') return S.staff < MAX_STAFF;
    return L(S, it.id) < (it.max || 1);
  }).map(it => itemView(S, it));
}
export function bought(S) {
  return ITEMS.filter(it => it.kind !== 'staff' && L(S, it.id) >= (it.max || 1)).map(it => itemView(S, it));
}
export const have = (S, cur) => cur === 'p' ? S.pence : S.favours;
export function buy(S, id, out = []) {
  const it = items(S).find(i => i.id === id);
  if (!it || have(S, it.cur) < it.cost) return false;
  if (it.cur === 'p') S.pence -= it.cost; else S.favours -= it.cost;
  if (it.kind === 'staff') { S.staff++; S.jobs.scrounge++; }
  else S.lv[id] = L(S, id) + 1;
  if (id === 'feel' && !S.queue.some(q => q.id === 'tune')) S.queue.push({ id: 'tune', on: false });
  if (id === 'lostkey' && !S.queue.some(q => q.id === 'lost')) S.queue.push({ id: 'lost', on: false });
  out.push({ type: 'buy', id, name: it.name, kind: it.kind });
  return true;
}

// ---------- The last purchase ----------
export const canGive = S => !S.ended && S.plan >= PLANS.length && S.favours >= GIVE_FAVOURS;
export function giveAway(S) {
  if (!canGive(S)) return null;
  const g = { ducks: TOTAL_DUCKS + S.raw + S.rack.reduce((a, b) => a + b, 0), favours: S.favours, pence: S.pence };
  S.given = g; S.favours = 0; S.pence = 0; S.raw = 0; S.rack = Array(12).fill(0); S.ended = true;
  return g;
}

// ---------- Time ----------
const ticked = S => { const n = stats(S).lines; return S.queue.filter(q => q.on).slice(0, n); };
export const activeLines = ticked;
function startTask(S) {
  for (const q of ticked(S)) if (!taskBlock(S, q)) { S.qTask = q.id; S.qProg = 0; return; }
  S.qTask = null;
}
function finishTask(S, id, out) {
  const st = stats(S);
  switch (id) {
    case 'bell': if (S.bells.length) answerBell(S, 0, out); break;
    case 'chairs': if (!S.review) { S.pence += st.deposit; S.wheels++; out.push({ type: 'wheel', pence: st.deposit }); } break;
    case 'buy': { const q = S.queue.find(x => x.id === 'buy'); if (S.raw < (q?.stock ?? 2)) buyDuck(S, out); break; }
    case 'tune': if (S.raw > 0 && S.matron <= 0) {
      const n = autoNote(S, false);
      if (n != null) {
        if (Math.random() < st.ear) { S.raw--; place(S, n, false, out); out.push({ type: 'autotune', who: 'hoo', note: n }); }
        else out.push({ type: 'automiss', who: 'hoo' });
      }
      break;
    }
    case 'lost': S.raw++; out.push({ type: 'lost' }); break;
    case 'cover': if (S.review) { S.favours++; out.push({ type: 'cover', who: 'hoo' }); } break;
  }
}
export function step(S, dt, out = [], { offline = false } = {}) {
  if (S.ended) return out;
  const st = stats(S);
  S.t += dt;
  S.nightT += dt;
  if (S.nightT >= NIGHT) {
    S.nightT -= NIGHT; S.night++;
    if (!S.review) S.pence += st.fund;
    out.push({ type: 'night', n: S.night, fund: !S.review });
  }
  // Matron's round: no tuning while she's looking.
  if (S.matron > 0) { S.matron -= dt; if (S.matron <= 0) { S.matron = 0; S.hush = HUSH_MAX; out.push({ type: 'matronEnd' }); } }
  // Call bells (not while you're away: the ward sleeps through).
  if (!offline) {
    S.bellT -= dt;
    if (S.bellT <= 0) {
      S.bellT = st.bellGap * (0.7 + Math.random() * 0.6);
      const free = [1, 2, 3, 4, 5, 6, 7, 8].filter(b => !S.bells.some(x => x.bed === b));
      if (free.length && S.bells.length < 3) { const bed = free[Math.floor(Math.random() * free.length)]; S.bells.push({ bed, age: 0, seed: Math.random() }); out.push({ type: 'bell', bed }); }
    }
    for (let i = S.bells.length - 1; i >= 0; i--) {
      const b = S.bells[i]; b.age += dt;
      if (b.age >= st.wakeAt) {
        S.bells.splice(i, 1); S.hush--;
        out.push({ type: 'wake', bed: b.bed });
        if (S.hush <= 0 && S.matron <= 0) { S.matron = MATRON_ROUND; S.rounds++; out.push({ type: 'matron' }); }
      }
    }
    if (S.hush < HUSH_MAX && !S.bells.length) { S.hushT += dt; if (S.hushT > 60) { S.hushT = 0; S.hush++; } } else S.hushT = 0;
  } else S.bells = [];
  // Fitted pranks make people smile: pennies in the lift, later favours.
  const fitted = Math.min(S.plan, PLANS.length) - flatPlans(S).size;
  if (S.review) drift(S, dt, out);
  if (fitted > 0) {
    S.smileT = (S.smileT || 0) + dt * fitted / st.smile;
    while (S.smileT >= 1) { S.smileT--; if (S.review) S.favours++; else S.pence++; out.push({ type: 'smile' }); }
  }
  // Hoo's clipboard.
  if (S.qTask && taskBlock(S, S.queue.find(q => q.id === S.qTask) || { id: S.qTask }) && S.qTask !== 'bell') S.qTask = null;
  if (!S.qTask) startTask(S);
  if (S.qTask) {
    S.qProg += dt / taskTime(S, S.qTask);
    if (S.qProg >= 1) { const id = S.qTask; S.qTask = null; S.qProg = 0; finishTask(S, id, out); startTask(S); }
  }
  // The night staff.
  if (S.review) {
    const J = S.jobs, P = S.jobProg;
    P.scrounge += J.scrounge * st.scroungeRate * dt;
    while (P.scrounge >= 1) { P.scrounge--; S.raw++; out.push({ type: 'scrounge' }); }
    P.cover += J.cover * st.coverRate * dt;
    while (P.cover >= 1) { P.cover--; S.favours++; out.push({ type: 'cover', who: 'staff' }); }
    if (S.matron <= 0) {
      P.tune += J.tune * st.staffTune * dt;
      while (P.tune >= 1) {
        const n = autoNote(S, st.staffHonk);
        if (S.raw < 1 || n == null) { P.tune = Math.min(P.tune, 1); break; }
        P.tune--;
        if (Math.random() < st.staffEar) { S.raw--; place(S, n, false, out); out.push({ type: 'autotune', who: 'staff', note: n }); }
        else out.push({ type: 'automiss', who: 'staff' });
      }
    }
    if (J.hush > 0 && S.bells.length) {
      P.hush += dt * J.hush / 4;
      while (P.hush >= 1 && S.bells.length) { P.hush--; answerBell(S, 0, out); }
    } else P.hush = 0;
  }
  // The hidden mechanic, if nobody's found it: the “?” slots sit between the lines.
  const p = plan(S);
  if (!S.honk && p && p.notes.some((n, i) => isHonk(n) && !S.slots[i])) {
    S.honkWait += dt;
    if (S.honkWait > 90 && !S.honkHinted) { S.honkHinted = true; out.push({ type: 'honkhint' }); }
  }
  return out;
}
// Assign one staff member to a job (+1) or take one off (-1); spare staff sit in the staff room.
export const idle = S => S.staff - Object.values(S.jobs).reduce((a, b) => a + b, 0);
export function assign(S, job, d) {
  if (d > 0 && idle(S) < 1) return false;
  if (d < 0 && S.jobs[job] < 1) return false;
  S.jobs[job] += d; return true;
}

// While you were away: the clipboard and the staff keep going, at a gentler pace, with no bells.
export function offline(S, secs) {
  if (S.ended || secs < 60) return null;
  const credit = Math.min(secs, OFFLINE_CAP) * OFFLINE_RATE;
  const before = { pence: S.pence, favours: S.favours, raw: S.raw, installed: S.installed, plan: S.plan };
  const out = [];
  const keepBells = S.bells; S.bells = [];
  for (let t = 0; t < credit; t += 1) step(S, 1, out, { offline: true });
  S.bells = [];
  void keepBells;
  return {
    secs: credit, pence: S.pence - before.pence, favours: S.favours - before.favours, raw: S.raw - before.raw,
    installed: S.installed - before.installed, pranks: S.plan - before.plan, review: out.some(e => e.type === 'review'),
  };
}
