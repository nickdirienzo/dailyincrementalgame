// Phase arrangements of Sepia's Night Pier (slopwave r-444bb474d173), lo-fi hip hop in
// A minor pentatonic. The 32-bar composition (96 s at 80 BPM) stays intact in every phase;
// phases change layers, key, tempo and tone. Written phrase-level gain/filter cycles of
// 3, 4 and 5 passes run against each other, so the combined texture takes many minutes
// to repeat exactly. This module never starts playback or changes global tempo.
import { createParts } from './song.mjs';

export const phases = {
  pond:     { name: 'Pond',      transpose: 0, bpm: 80 }, // first run: the composed groove
  flotilla: { name: 'Flotilla',  transpose: 0, bpm: 80 }, // a warm pad joins
  petition: { name: 'Petition',  transpose: 2, bpm: 84 }, // B minor pentatonic, fuller
  jubilee:  { name: 'Jubilee',   transpose: 5, bpm: 70 }, // D minor pentatonic, half-time, no snare
};

export function createSoundtrack(S) {
  const parts = createParts(S);
  const cache = new Map();
  const transpose = (pattern, semitones) => semitones ? pattern.fmap(value => ({
    ...value, note: (typeof value.note === 'number' ? value.note : S.noteToMidi(value.note)) + semitones,
  })) : pattern;
  // One step per complete 32-bar pass ('/32'): different cycle lengths never line up quickly.
  const chordBreath = p => p.mul(S.gain('<1 0.86 0.94>/32')).lpf('<1700 1400 1900 1550 1250>/32');
  const leadBreath = p => p.mul(S.gain('<1 0.8 1 0.55>/32'));
  const pad = p => p.s('sawtooth').lpf('<620 760 540>/32').attack(0.35).decay(1.6).sustain(0.6)
    .release(1.4).pan(0.3).room(0.45);

  return (phaseKey) => {
    const key = phases[phaseKey] ? phaseKey : 'pond';
    if (cache.has(key)) return cache.get(key);
    const phase = phases[key];
    const [bass, chords, lead] = parts.slice(0, 3).map(p => transpose(p, phase.transpose));
    const [kick, snare, hat] = parts.slice(3); // never transpose percussion
    let layers;
    if (key === 'jubilee') {
      // Finale: slower and warmer; the duck sails off. Kick and hats only, at half weight.
      layers = [
        bass.release(0.35),
        chordBreath(chords.release(0.9)).mul(S.gain(1.05)),
        pad(chords).mul(S.gain(0.5)),
        lead.mul(S.gain(0.9)).room(0.4),
        transpose(lead, 12).s('sine').attack(0.02).release(0.5).mul(S.gain(0.45)).pan(0.7).room(0.5),
        kick.mul(S.gain(0.6)),
        hat.mul(S.gain(0.55)),
      ];
    } else {
      layers = [bass, chordBreath(chords), leadBreath(lead), kick, snare, hat];
      if (key === 'flotilla' || key === 'petition') {
        layers.push(pad(chords).mul(S.gain('<0.32 0.42 0.36 0.45>/32')));
      }
      if (key === 'petition') {
        layers[1] = chordBreath(chords).lpf('<2000 1750 2200 1850 1600>/32');
        // The lead gains an octave-down sine double for the final push.
        layers.push(leadBreath(transpose(lead, -12)).s('sine').attack(0.02).release(0.3)
          .mul(S.gain(0.55)).pan(0.42));
      }
    }
    const result = [key, S.stack(...layers), phase.bpm / 240];
    cache.set(key, result);
    return result;
  };
}
