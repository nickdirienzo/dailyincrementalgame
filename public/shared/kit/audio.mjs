// Sound and music for Daily Incremental games, synthesized with Web Audio (no audio files).
//
//   import { createAudio, scale } from '/shared/kit/audio.mjs';
//   const A = createAudio({ sfxTrim: 1, musicTrim: 1 }); // unlocks on the first pointerdown/keydown
//   const notes = scale('harmonic minor', 57);     // notes(degree) -> Hz, degrees past the scale go up octaves
//   A.tone({ type: 'square', freq: notes(4), dur: 0.12 });   // a sound effect on the sfx bus
//
// Volume is the player's, set in the site's Sound panel (daily.js) and shared by every game:
// di:volume-sfx and di:volume-music (0..1) and di:sound-muted. Games don't draw their own sound
// buttons. Trims balance one game's mix (measure it; see CLAUDE.md), the player's sliders sit on top.
// Music goes through A.music: Strudel via kit/music.mjs, which shares this audio context.

const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
export const settings = () => ({
  muted: read('di:sound-muted', '0') === '1',
  sfx: Math.max(0, Math.min(1, Number(read('di:volume-sfx', '0.8')))),
  music: read('di:music-muted', '0') === '1' ? 0 : Math.max(0, Math.min(1, Number(read('di:volume-music', '0.6')))),
});

export function createAudio({ sfxTrim = 1, musicTrim = 1 } = {}) {
  let ctx = null, master, sfx, music, noiseBuf, unlocked = false;
  let cfg = settings();
  const listeners = new Set();
  const A = {
    get ctx() { return ctx; }, get sfx() { return sfx; }, get music() { return music; }, get noise() { return noiseBuf; },
    get ready() { return !!ctx && ctx.state === 'running'; },
    get unlocked() { return unlocked; },
    get soundOn() { return !cfg.muted && cfg.sfx > 0; }, get musicOn() { return !cfg.muted && cfg.music > 0; },
    get now() { return ctx ? ctx.currentTime : 0; },
    ensure, unlock, tone, noiseHit, onChange: fn => (listeners.add(fn), () => listeners.delete(fn)),
  };
  const emit = () => listeners.forEach(fn => fn(A));

  // Curve the sliders so the middle of the range sounds like the middle.
  const curve = v => v * v;
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(cfg.muted ? 0 : 1, t, 0.02);
    sfx.gain.setTargetAtTime(curve(cfg.sfx) * sfxTrim, t, 0.02);
    music.gain.setTargetAtTime(curve(cfg.music) * musicTrim, t, 0.08);
  }
  // The context exists before the first gesture (suspended) so Strudel can share it.
  function ensure() {
    if (ctx) return ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    // A gentle compressor keeps stacked sounds from clipping.
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    music = ctx.createGain(); music.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    return ctx;
  }
  function unlock() {
    if (!ensure()) return;
    unlocked = true;
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().then(emit, () => {});
    emit();
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, true));
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) ctx.suspend().then(emit, () => {}); else ctx.resume().then(emit, () => {});
  });
  // The Sound panel (this tab) and other tabs.
  const reload = () => { cfg = settings(); apply(); emit(); };
  addEventListener('di:audio', reload);
  addEventListener('storage', e => { if (e.key && e.key.startsWith('di:')) reload(); });

  // One synthesized note. type: any OscillatorType, 'pulse' (narrow square, chiptune), 'pluck'
  // (kalimba / harp), 'bell', 'keys' (soft detuned electric piano), 'pad' (slow swell).
  // Envelope in seconds; `glide` bends the pitch toward freq*glide; `cutoff` adds a low-pass.
  function tone({ type = 'sine', freq = 440, dur = 0.15, vol = 0.3, attack = 0.005, release = null, at = null,
    glide = 0, cutoff = 0, detune = 0, pan = 0, bus = null } = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t = at ?? ctx.currentTime, out = bus || sfx;
    const rel = release ?? (type === 'pluck' || type === 'bell' ? dur * 2.5 : 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack + 0.001);
    if (type === 'pluck' || type === 'bell') g.gain.exponentialRampToValueAtTime(0.0001, t + attack + rel);
    else { g.gain.setValueAtTime(vol, t + Math.max(attack, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, dur) + rel); }
    let node = g;
    if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.7; g.connect(f); node = f; }
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(out);
    const end = t + Math.max(attack, dur) + rel + 0.05;
    const osc = (wave, f, d = 0, v = 1) => {
      const o = ctx.createOscillator();
      if (wave === 'pulse') o.setPeriodicWave(pulseWave(ctx));
      else o.type = wave;
      o.frequency.setValueAtTime(f, t); o.detune.value = detune + d;
      if (glide) o.frequency.exponentialRampToValueAtTime(f * glide, t + dur);
      const og = ctx.createGain(); og.gain.value = v; o.connect(og).connect(g);
      o.start(t); o.stop(end);
    };
    if (type === 'pluck') { osc('triangle', freq); osc('sine', freq * 2, 0, 0.35); osc('sine', freq * 4.2, 0, 0.08); }
    else if (type === 'bell') { osc('sine', freq); osc('sine', freq * 2.76, 0, 0.3); osc('sine', freq * 5.4, 0, 0.12); }
    else if (type === 'keys') { osc('triangle', freq, -6); osc('sine', freq, 6); osc('sine', freq * 2, 0, 0.15); }
    else if (type === 'pad') { osc('sawtooth', freq, -9, 0.4); osc('sawtooth', freq, 9, 0.4); osc('triangle', freq / 2, 0, 0.5); }
    else osc(type, freq);
  }

  // Filtered noise burst: drums, whooshes, sand, crackle. kind: 'kick' | 'snare' | 'hat' | 'shaker' | 'whoosh'.
  function noiseHit(kind = 'hat', { at = null, vol = 0.25, bus = null, dur = null } = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t = at ?? ctx.currentTime, out = bus || sfx;
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol * 1.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.25);
      return;
    }
    const spec = { snare: [1800, 'bandpass', 0.14], hat: [8000, 'highpass', 0.04], shaker: [6000, 'highpass', 0.07], whoosh: [900, 'bandpass', 0.5] }[kind] || [3000, 'bandpass', 0.1];
    const len = dur ?? spec[2];
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = spec[1]; f.frequency.value = spec[0];
    if (kind === 'whoosh') { f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + len); }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (kind === 'whoosh' ? len * 0.4 : 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }

  return A;
}

let pulseCache = null;
function pulseWave(ctx) {
  if (pulseCache && pulseCache.ctx === ctx) return pulseCache.wave;
  // 25% duty cycle: the classic NES lead.
  const n = 64, re = new Float32Array(n), im = new Float32Array(n), duty = 0.25;
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  pulseCache = { ctx, wave: ctx.createPeriodicWave(re, im) };
  return pulseCache.wave;
}

// ---------- Scales ----------

export const SCALES = {
  'major pentatonic': [0, 2, 4, 7, 9], 'minor pentatonic': [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  blues: [0, 3, 5, 6, 7, 10], 'in-sen': [0, 1, 5, 7, 10], 'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
};

export const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

// scale(name, rootMidi) -> degree => Hz. Degree 0 is the root; negative degrees go down.
export function scale(name, root = 60) {
  const s = SCALES[name];
  if (!s) throw new Error(`unknown scale "${name}"`);
  const fn = deg => {
    const o = Math.floor(deg / s.length), i = ((deg % s.length) + s.length) % s.length;
    return midiToHz(root + o * 12 + s[i]);
  };
  fn.size = s.length;
  fn.midi = deg => { const o = Math.floor(deg / s.length), i = ((deg % s.length) + s.length) % s.length; return root + o * 12 + s[i]; };
  return fn;
}

// ---------- Sequencer ----------

// A step loop with lookahead scheduling, so timing stays tight even when the page is busy.
// onStep(step, time, bar) runs for each step a little ahead of time; schedule notes `at: time`.
// stepsPerBar 16 = sixteenth notes in 4/4. swing 0..0.3 delays every other step.
export function loop(A, { bpm = 100, stepsPerBar = 16, swing = 0, onStep }) {
  let timer = null, next = 0, step = 0, playing = false;
  const stepDur = () => 60 / bpm / 4;
  function tick() {
    const ctx = A.ctx;
    if (!ctx || ctx.state !== 'running' || !A.musicOn) return;
    if (next < ctx.currentTime - 0.2) next = ctx.currentTime + 0.05;
    while (next < ctx.currentTime + 0.15) {
      const s = step % stepsPerBar;
      const t = next + (s % 2 === 1 ? swing * stepDur() : 0);
      try { onStep(s, t, Math.floor(step / stepsPerBar)); } catch (e) { console.warn(e); }
      next += stepDur(); step++;
    }
  }
  const api = {
    start() { if (playing) return api; playing = true; next = 0; timer = setInterval(tick, 30); return api; },
    stop() { playing = false; clearInterval(timer); return api; },
    get playing() { return playing; },
    get bpm() { return bpm; }, set bpm(v) { bpm = v; },
    restart() { step = 0; return api; },
  };
  return api;
}
