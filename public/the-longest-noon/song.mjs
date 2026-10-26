// Adapted from slopwave r-1f37760c99a2; expose stems without changing notes or envelopes.
// Sampled audition of r-1f37760c99a2; same notes/timing, local VCSL marimba.
// slopwave score SHA-256: 0c6af9778017fda8ed1568353902f8d3c4cac4a0d1c918c4cfe3325c36ac8bcd
export const bpm = 96;
export const beats = 64;
export const cps = bpm / 240;
export function createParts(S) {
const {stack, cat, timecat, silence, note, gain} = S;
const BPM = 96.000000;
const BEATS = 64.00000000; // authored composition; repeats from the beginning

// Mix controls: set a part to 0 to mute it.
const mix = { low: 0.6, middle: 0.8, high: 0.75, drums: 0 };

// Events: [start beat, duration in beats, note name/MIDI, relative level].
// Explicit authored timing, including rests and offbeat answers.
// Schedule only the current bar so fast phrases do not lose note attacks.
const phrase = events => {
  const ticks = 100000;
  const bars = Array.from({ length: Math.ceil(BEATS / 4) }, () => []);
  const widths = bars.map((_, bar) => Math.round(Math.min(4, BEATS - bar * 4) * ticks));
  for (const [at, len, pitch, level] of events) {
    const bar = Math.floor(at / 4);
    const start = Math.round((at - bar * 4) * ticks);
    const duration = Math.round(Math.min(len, BEATS - at) * ticks);
    const span = Math.min(duration, widths[bar] - start);
    if (span <= 0) continue;
    bars[bar].push(timecat(...[
      [start, silence],
      [span, note(pitch).gain(level).legato(duration / span)],
      [widths[bar] - start - span, silence]
    ].filter(([length]) => length > 0)));
  }
  const patterns = bars.map(events => events.length ? stack(...events) : silence);
  if (BEATS % 4 === 0) return cat(...patterns);
  const padded = patterns.map((pattern, bar) => widths[bar] === 4 * ticks
    ? pattern : pattern.compress(0, widths[bar] / (4 * ticks)));
  return cat(...padded).fast(padded.length)
    .zoom(0, BEATS / (4 * padded.length)).slow(BEATS / 4);
};

const low = [
  [0,0.65,"d3",0.46], [4,0.4,"a3",0.28], [8,0.65,"b2",0.46], [12,0.4,"fs3",0.28],
  [16,0.65,"e3",0.46], [20,0.4,"b3",0.28], [24,0.65,"a2",0.46], [28,0.4,"e3",0.28],
  [32,0.65,"d3",0.46], [36,0.4,"a3",0.28], [40,0.65,"b2",0.46], [44,0.4,"fs3",0.28],
  [48,0.65,"e3",0.46], [52,0.4,"b3",0.28], [56,0.65,"a2",0.46], [60,0.4,"e3",0.28]
];

const middle = [
  [0.75,0.24,"a3",0.26], [2.75,0.24,"d4",0.3], [5.25,0.24,"fs4",0.23], [8.75,0.24,"fs3",0.26],
  [10.75,0.24,"b3",0.3], [13.25,0.24,"d4",0.23], [16.75,0.24,"b3",0.26], [18.75,0.24,"e4",0.3],
  [20.75,0.24,"b3",0.21], [21.25,0.24,"fs4",0.23], [23.25,0.24,"e4",0.25], [24.75,0.24,"e3",0.26],
  [26.75,0.24,"a3",0.3], [28.75,0.24,"e3",0.21], [29.25,0.24,"e4",0.23], [31.25,0.24,"a3",0.25],
  [32.75,0.24,"a3",0.26], [34.75,0.24,"d4",0.3], [36.75,0.24,"a3",0.21], [37.25,0.24,"fs4",0.23],
  [39.25,0.24,"d4",0.25], [40.75,0.24,"fs3",0.26], [42.75,0.24,"b3",0.3], [44.75,0.24,"fs3",0.21],
  [45.25,0.24,"d4",0.23], [47.25,0.24,"b3",0.25], [48.75,0.24,"b3",0.26], [50.75,0.24,"e4",0.3],
  [53.25,0.24,"fs4",0.23], [56.75,0.24,"e3",0.26], [58.75,0.24,"a3",0.3], [61.25,0.24,"e4",0.23]
];

const high = [
  [0,0.3,"d4",0.66], [1.5,0.22,"a4",0.47], [2,0.3,"fs4",0.56], [3.5,0.24,"e4",0.43],
  [4.5,0.35,"fs4",0.53], [6,0.4,"d4",0.55], [8,0.3,"d4",0.6], [9.5,0.22,"a4",0.44],
  [10,0.3,"fs4",0.52], [11.5,0.24,"e4",0.42], [13,0.3,"d4",0.5], [14.5,0.45,"b3",0.48],
  [16,0.3,"d4",0.62], [17.5,0.22,"a4",0.45], [18,0.3,"fs4",0.54], [19.5,0.24,"e4",0.43],
  [20.5,0.3,"fs4",0.5], [21.5,0.24,"a4",0.43], [22.5,0.35,"e4",0.48], [24,0.3,"e4",0.56],
  [25.5,0.22,"a4",0.44], [26,0.3,"fs4",0.52], [27.5,0.24,"e4",0.4], [29,0.3,"d4",0.48],
  [30.5,0.35,"e4",0.43], [32,0.3,"d4",0.63], [33.5,0.22,"a4",0.46], [34,0.3,"b4",0.49],
  [35.5,0.24,"a4",0.43], [36.5,0.3,"fs4",0.54], [38,0.4,"d4",0.53], [40,0.3,"d4",0.59],
  [41.5,0.22,"fs4",0.45], [42,0.3,"a4",0.52], [43.5,0.24,"b4",0.44], [45,0.3,"a4",0.49],
  [46.5,0.45,"fs4",0.46], [48,0.3,"e4",0.56], [49.5,0.22,"a4",0.42], [50,0.3,"fs4",0.5],
  [51.5,0.24,"e4",0.4], [52.5,0.3,"d4",0.48], [54,0.35,"e4",0.43], [56,0.3,"a3",0.53],
  [57.5,0.22,"d4",0.42], [58,0.3,"fs4",0.49], [59.5,0.24,"e4",0.39], [61,0.25,"e4",0.4],
  [62.5,0.4,"d4",0.5]
];

const kick = [

];

const snare = [

];

const hat = [

];

return [
  phrase(low).s("marimba").attack(0.002).release(0.3).pan(0.5).room(0.12).mul(gain(mix.low)),
  phrase(middle).s("marimba").attack(0.002).release(0.18).pan(0.65).room(0.12).mul(gain(mix.middle)),
  phrase(high).s("marimba").attack(0.002).release(0.22).pan(0.35).room(0.12).mul(gain(mix.high)),
  phrase(kick).s("sine").freq(65).penv(18).pdecay(0.045)
    .decay(0.12).sustain(0).mul(gain(mix.drums)),
  phrase(snare).s("white").hpf(900).lpf(5500)
    .decay(0.085).sustain(0).mul(gain(mix.drums * 0.45)),
  phrase(hat).s("white").hpf(6500)
    .decay(0.025).sustain(0).mul(gain(mix.drums * 0.20))
];
}

// The reviewed composition; phase arrangements can reuse its six stems.
export function createPattern(S) { return S.stack(...createParts(S)); }
