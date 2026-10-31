// Phase arrangements of Consumption Nominal (slopwave r-42b0c32676f0), an 8-bit chiptune in
// A natural minor (A B C D E F G), the same scale as the game's sound effects (scale('minor', 57)).
// The 40-bar composition (80 s at 120 BPM) stays intact in every phase; phases change layers,
// tempo and tone, never key. NES-like voices: triangle bass, square arpeggio, pulse lead whose
// duty cycle changes from pass to pass, noise drums, and a soft triangle "telemetry" ping.
// Written pass-level cycles of 3, 4 and 5 passes run against each other, so the combined texture
// takes over an hour to repeat exactly. This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  rescue: { name: 'Rescue', bpm: 120 }, // drawing paths: bass, lead, telemetry, a light kick
  brine:  { name: 'Brine',  bpm: 120 }, // jars: the square arpeggio and the snare join
  supper: { name: 'Supper', bpm: 128 }, // nearly full: brighter, an octave echo, faster telemetry
  nap:    { name: 'Nap',    bpm: 84  }, // the Sun falls asleep: a triangle lullaby, a sleep monitor
  trick:  { name: 'Trick',  bpm: 132 }, // the Sun goes trick-or-treating: a bouncy spooky march
};

const BARS = 40;
// Sections of the score (see .slopwave/work/we-have-a-pickle/plan.json).
const INTRO = b => b < 4, A = b => b >= 4 && b < 20, B = b => b >= 20 && b < 28;
const BRIDGE = b => b >= 28 && b < 32, A3 = b => b >= 32;

// One mini-notation step per bar inside '<...>', aligned with the 40-bar pass. Passing several
// functions makes a sequence of whole passes (a mask that changes from one pass to the next).
const perBar = (...fns) => '<' + fns.flatMap(fn => Array.from({ length: BARS }, (_, b) => fn(b))).join(' ') + '>';
const bit = x => (x ? 1 : 0);
// Opening lead, three passes: everything; then A, B and A'' (resting through A'); then only the
// first two bars of each A phrase and the first half of B. The bridge run and A'' always play,
// so each pass still ends on the full motif before the return.
const rescueLead = perBar(
  () => 1,
  b => bit(b >= 4 && b < 12 || B(b) || b === 31 || A3(b)),
  b => bit(A(b) && b % 4 < 2 || b >= 20 && b < 24 || b === 31 || A3(b)),
);
const echoMask = perBar(b => bit(B(b) || A3(b)));        // supper's octave echo
const harmonyMask = perBar(b => bit(A(b) || A3(b)));     // trick's harmony under the motif
// Telemetry: pings on beats 1 and 3, a double ping closing each four-bar phrase.
const telemetry = perBar(b => (b % 4 === 3 ? '[e6 ~ a5 [a5 a5]]' : '[e6 ~ a5 ~]'));
// A diatonic third below, staying in A natural minor: A->F, B->G, C->A, D->B, E->C, F->D, G->E.
const BELOW = { 9: -4, 11: -4, 0: -3, 2: -3, 4: -4, 5: -3, 7: -3 };

export function createSoundtrack(S) {
  const [bass, arp, lead, kick, snare, hat] = createParts(S);
  const cache = new Map();
  const midi = value => (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note));
  const shift = (pattern, semitones) => pattern.fmap(value => ({ ...value, note: midi(value) + semitones }));
  const below = pattern => pattern.fmap(value => {
    const n = midi(value);
    return { ...value, note: n + (BELOW[((n % 12) + 12) % 12] ?? -12) };
  });
  const echo = (bpm, amount = 0.2, beats = 0.75) => p =>
    p.delay(amount).delaytime(+(60 / bpm * beats).toFixed(4)).delayfeedback(0.3);

  // One step per complete 40-bar pass ('/40'): cycles of 3, 4 and 5 never line up quickly.
  const pulseLead = (duty = '<0.25 0.125 0.25 0.5>/40', g = '<1 0.86 0.94 0.8>/40', lpf = 2400) =>
    lead.s('pulse').pw(duty).lpf(lpf).mul(S.gain(0.75)).mul(S.gain(g));
  const squareArp = (f = 1, g = 1) => arp.s('square')
    .lpf(`<${[1500, 1300, 1700, 1400, 1200].map(v => Math.round(v * f)).join(' ')}>/40`)
    .mul(S.gain(0.6 * g));
  const triBass = (g = 1) => bass.mul(S.gain(`<${g} ${+(g * 0.9).toFixed(3)} ${+(g * 0.96).toFixed(3)}>/40`));
  const softSnare = snare.lpf(4200);
  const ping = (pattern, level) => S.note(pattern).s('triangle')
    .attack(0.002).decay(0.07).sustain(0).release(0.06).pan(0.7).room(0.2)
    .mul(S.gain(`<${level} ${level * 0.8} ${level * 0.92} ${level * 0.7} ${level * 0.86}>/40`));

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'rescue';
    if (cache.has(key)) return cache.get(key);
    const { bpm } = phases[key];
    let layers;
    if (key === 'rescue') {
      // Drawing the first trajectories: lots of room for chalk and pickle blips.
      layers = [
        triBass(0.92),
        pulseLead().mask(rescueLead).mul(S.gain(0.9)),
        kick.mask('1 0').mul(S.gain(0.8)),
        hat.mul(S.gain(0.7)),
        ping(telemetry, 0.05),
      ];
    } else if (key === 'brine') {
      // The jars start bubbling: square arpeggios and a snare on two and four.
      layers = [
        triBass(),
        squareArp(),
        pulseLead(),
        kick,
        softSnare.mul(S.gain(0.9)),
        hat,
        ping(telemetry, 0.045),
      ];
    } else if (key === 'supper') {
      // Nearly full: a touch faster and brighter, a soft triangle echo an octave up in B and A'',
      // and the telemetry pinging every beat.
      layers = [
        triBass(1.05),
        squareArp(1.15, 1.05),
        pulseLead('<0.25 0.5 0.125 0.25>/40', '<1 0.9 0.96 0.86>/40', 2600),
        echo(bpm, 0.18)(shift(lead, 12).s('triangle').lpf(2600).attack(0.01).release(0.15).pan(0.3))
          .mask(echoMask).mul(S.gain('<0.3 0.24 0.27>/40')),
        kick,
        softSnare,
        hat.mul(S.gain(1.1)),
        ping(perBar(b => (b % 4 === 3 ? '[e6 a5 e6 [a5 a5]]' : '[e6 a5 e6 a5]')), 0.04),
      ];
    } else if (key === 'nap') {
      // The Sun falls asleep: a triangle lullaby with an echo, a music-box arpeggio an octave up on
      // the beats, roots only in the bass, no drums, and a sleep monitor pinging every two bars.
      layers = [
        bass.mask('[1 0 0 0]*2').release(0.5).mul(S.gain(0.8)),
        shift(arp.mask('[1 0 0 0]*4'), 12).s('triangle').lpf(2200).attack(0.003).decay(0.35).sustain(0)
          .release(0.5).pan(0.35).room(0.5).mul(S.gain('<0.55 0.45 0.5 0.4 0.48>/40')),
        echo(bpm, 0.28)(lead.s('triangle').lpf(1600).attack(0.03).release(0.45).room(0.45))
          .mul(S.gain('<0.85 0.75 0.8 0.7>/40')),
        S.note('<[e6 ~ ~ ~] ~>').s('triangle').attack(0.002).decay(0.25).sustain(0).release(0.3)
          .pan(0.7).room(0.5).mul(S.gain('<0.04 0.03 0.036>/40')),
      ];
    } else {
      // The Sun in a pickle costume, trick-or-treating: a march kick on every beat, a bold square
      // lead with a pulse harmony a third below in the A sections, everything in.
      layers = [
        triBass(1.05),
        squareArp(1.1),
        pulseLead('<0.5 0.25 0.5 0.125>/40', '<1 0.92 0.97 0.88>/40', 2600),
        below(lead).s('pulse').pw(0.25).lpf(1800).pan(0.32).mask(harmonyMask)
          .mul(S.gain('<0.3 0.25 0.28>/40')),
        S.s('sine*4').freq(65).penv(18).pdecay(0.045).decay(0.12).sustain(0).mul(S.gain(0.3)),
        snare,
        hat.mul(S.gain(1.1)),
        ping(telemetry, 0.04),
      ];
    }
    const result = [key, S.stack(...layers), bpm / 240];
    cache.set(key, result);
    return result;
  };
}
