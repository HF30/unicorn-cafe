// Pure piano logic (no DOM, no audio): the copy-me engine, the silent gate, the key layout and the 88-key mini-map.
export function createCopyMe(notes, {maxBeforeDemo = 2, octaveFree = false} = {}) {
  const same = (a, b) => a === b || (octaveFree && String(a).replace(/\d+$/, '') === String(b).replace(/\d+$/, ''));
  let pos = 0, misses = 0;
  return {
    next: () => (pos < notes.length ? notes[pos] : null),
    press(note) {
      if (pos >= notes.length) return {result: 'done'};
      if (same(note, notes[pos])) { pos++; return {result: pos >= notes.length ? 'done' : 'correct'}; }
      misses++; // a wrong note never moves her back: pos stays, the same note is still expected
      return {result: 'wrong', replay: true, hint: notes[pos], demo: misses >= maxBeforeDemo};
    },
    outcome: () => (misses === 0 ? 'first' : misses < maxBeforeDemo ? 'retry' : 'demo'),
    misses: () => misses,
  };
}
// SPEC §16 FL4, follow-the-light: one key glows at a time; the right key moves on, a wrong key is a soft nudge that never advances or punishes.
// outcome: 0-1 misses = first, 2-3 = retry, 4+ = demo.
export function createFollow(notes) {
  let pos = 0, misses = 0;
  return {
    next: () => (pos < notes.length ? notes[pos] : null),
    press(note) {
      if (pos >= notes.length) return {result: 'done'};
      if (note === notes[pos]) { pos++; return {result: pos >= notes.length ? 'done' : 'correct'}; }
      misses++;
      return {result: 'nudge', expect: notes[pos], pulse: true};
    },
    outcome: () => (misses <= 1 ? 'first' : misses <= 3 ? 'retry' : 'demo'),
    misses: () => misses,
  };
}
export const canSound = ({silent, musicOn}) => !silent && !!musicOn;
// One {note,white,x,w,h} per key, in white-key widths: whites at x = 0,1,2..., blacks centred on the boundary after the white key a semitone below (2-3 grouping).
export function keyLayout(keys) {
  const whites = keys.filter(k => k.white).sort((a, b) => a.midi - b.midi), idx = new Map(whites.map((k, i) => [k.midi, i]));
  const BW = 0.6, BH = 0.62;
  return keys.map(k => {
    if (k.white) return {note: k.note, white: true, x: idx.get(k.midi), w: 1, h: 1};
    const below = idx.get(k.midi - 1), centre = (below === undefined ? 0 : below) + 1;
    return {note: k.note, white: false, x: centre - BW / 2, w: BW, h: BH};
  });
}
const SHARP = new Set([1, 3, 6, 8, 10]);
export function miniMap(lowMidi, highMidi) {
  const keys = Array.from({length: 88}, (_, i) => ({midi: 21 + i, white: !SHARP.has((21 + i) % 12)}));
  return {keys, highlight: [lowMidi - 21, highMidi - 21]};
}
// ---- curriculum-v1 P2 (SPEC §14): note spelling, beat/rhythm onsets, tap scoring, the visible key range ----
// The seed spells a sharp "C#4"; the keys spell it "Cs4". Any other name is unchanged.
export const noteId = name => String(name).replace('#', 's');
const SEMI = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
export const midiOf = name => { const m = /^([A-G])(s?)(-?\d)$/.exec(noteId(name)); return m ? 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] ? 1 : 0) : NaN; };
// n onsets, one per beat, in ms from the first: [0, 60000/bpm, ...]
export const beatTimes = (bpm, n) => Array.from({length: n}, (_, i) => Math.round(i * 60000 / bpm * 1000) / 1000);
// "ta" = one beat, "ti-ti" = two half beats, "-" = a silent beat; returns the onsets in ms
export function rhythmTimes(pattern, bpm) {
  const beat = 60000 / bpm, out = []; let at = 0;
  for (const tok of String(pattern).trim().split(/\s+/)) {
    if (tok === 'ta') { out.push(at); at += beat; } else if (tok === 'ti-ti') { out.push(at, at + beat / 2); at += beat; } else if (tok === '-') at += beat;
  }
  return out;
}
// Each target matches at most one unused tap within tolMs, nearest pair first; extra = taps left unmatched.
export function scoreTaps(targets, taps, tolMs) {
  const pairs = [];
  targets.forEach((t, i) => taps.forEach((p, j) => { const d = Math.abs(t - p); if (d <= tolMs) pairs.push([d, i, j]); }));
  pairs.sort((a, b) => a[0] - b[0]);
  const usedT = new Set(), usedP = new Set();
  for (const [, i, j] of pairs) if (!usedT.has(i) && !usedP.has(j)) { usedT.add(i); usedP.add(j); }
  return {hits: usedT.size, extra: taps.length - usedP.size};
}
// U1 beat: 8 beats of beatTimes(bpm, 8), her taps relative to the first beat; tol = min(200, a quarter beat); 6 hits and at most 2 extra taps (no mashing)
export function beatPass(bpm, taps) {
  const tol = Math.min(200, 0.25 * 60000 / bpm), r = scoreTaps(beatTimes(bpm, 8), taps || [], tol);
  return r.hits >= 6 && r.extra <= 2;
}
// C4..C5 (13 keys) unless a note is below C4, then C3..C5 (25 keys). Free play always shows {low:48, high:72}.
export const keyRange = notes => ((notes || []).some(n => midiOf(n) < 60) ? {low: 48, high: 72} : {low: 60, high: 72});
