// Pure curriculum engine (no DOM): every ladder size, guide, word list, problem range and phrase is read from the curriculum data
// (app/content/curriculum.json) passed in, never hard-coded, so a new level is a new data entry and no code change.
import {noteId} from './music.mjs';
const LADDER = {trace: 'trace', math: 'maths', maths: 'maths', music: 'music'};
const ladder = (cur, skill) => cur[LADDER[skill] || skill] || [];
const clamp = (cur, skill, level) => Math.max(1, Math.min(ladder(cur, skill).length || 1, Math.round(level) || 1));
const entry = (cur, skill, level) => ladder(cur, skill)[clamp(cur, skill, level) - 1] || {};
const int = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
export const maxLevel = (cur, skill) => ladder(cur, skill).length;
// The pad settings of guide step g (1..5): dotted / faintLetter / endpointsOnly / numberedArrows / scorer / model / studyMs (curriculum.json guides).
export const guideFor = (cur, g) => (cur.guides || []).find(x => x.g === g) || (cur.guides || [])[0] || null;
export function makeProblem(cur, level, rng = Math.random) {
  const s = entry(cur, 'math', level), max = Math.max(1, s.max || 1);
  if (s.type === 'add') { const sum = int(2, Math.max(2, max), rng), a = int(1, sum - 1, rng); return {a, b: sum - a, sum}; }
  if (s.type === 'budget') { const budget = int(1, max, rng), count = int(1, budget, rng); return {budget, items: Array.from({length: count}, () => ({price: 1}))}; }
  return {n: int(1, max, rng)};
}
// SPEC §15 MA9: a kitchen scoop is an ungraded count of n scoops, n in 1..min(10, the level's largest number) (5 on the coin levels).
export function scoopStep(cur, level, rng = Math.random) {
  const s = entry(cur, 'math', level), top = Math.min(10, Math.max(...[...(s.range || []), ...(s.wholes || []), s.maxSum || 0, s.maxPrice ? 5 : 0].filter(Number.isFinite)) || 5);
  return {kind: 'count', target: int(1, top, rng)};
}
// "-" in a song is a phrase break: a song splits into phrases there (empty pieces dropped).
const splitSong = line => { const out = []; let cur_ = []; for (const n of line) { if (n === '-') { if (cur_.length) out.push(cur_); cur_ = []; } else cur_.push(n); } if (cur_.length) out.push(cur_); return out; };
// The phrases of a music level (arrays of notes), from its DATA: its `phrases`; else every song of its `songs` split at "-"; else `phraseLengths` -> random phrases of those
// lengths drawn from its `notes` (pentatonic echoes); else its `notes` up then down (the scale). A new level with a new song needs no code.
export function phrasesFor(cur, level, rng = Math.random) {
  const l = entry(cur, 'music', level);
  if (Array.isArray(l.phrases) && l.phrases.length) return l.phrases.map(p => [...p]);
  if (Array.isArray(l.songs) && l.songs.length) return l.songs.flatMap(id => splitSong((cur.songs || {})[id] || []));
  const notes = l.notes || [];
  if (Array.isArray(l.phraseLengths) && l.phraseLengths.length && notes.length) {
    return Array.from({length: 4}, () => { const n = l.phraseLengths[Math.floor(rng() * l.phraseLengths.length)]; return Array.from({length: n}, () => notes[Math.floor(rng() * notes.length)]); });
  }
  return notes.length ? [[...notes, ...[...notes].reverse().slice(1)]] : [];
}
// SPEC §16 FL2: the notes of a follow-the-light level = the first `take` phrases of its `song` (split at "-"), joined, spelled by noteId. Any other level: [].
export function followNotes(cur, level) {
  const l = entry(cur, 'music', level);
  if (l.mechanic !== 'follow') return [];
  return splitSong((cur.songs || {})[l.song] || []).slice(0, l.take || 1).flat().map(noteId);
}
