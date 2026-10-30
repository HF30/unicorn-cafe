import {maxLevel, phrasesFor} from './curriculum.mjs';
// SPEC §14 MU9, from the level's DATA (its mechanic and keys, never its number): follow:<song> · beat:<bpm> · rhythm:<pattern> · hl:<note> · penta:<length> · time:<song> · none for free play · else phrase:<notes joined by ,> per distinct phrase.
function musicItems(cur, level) {
  const l = cur.music[level - 1] || {};
  if (l.mechanic === 'beat') return (Array.isArray(l.bpm) ? l.bpm : [l.bpm]).map(b => 'beat:' + b);
  if (l.mechanic === 'follow') return ['follow:' + l.song];
  if (l.mechanic === 'rhythm') return (l.patterns || []).map(p => 'rhythm:' + p);
  if (l.mechanic === 'highlow') return (l.notes || []).map(n => 'hl:' + n);
  if (l.mechanic === 'free') return [];
  if (Array.isArray(l.phraseLengths)) return l.phraseLengths.map(n => 'penta:' + n);
  if (l.bpm && Array.isArray(l.songs)) return l.songs.map(id => 'time:' + id);
  return [...new Set(phrasesFor(cur, level, () => 0).map(p => 'phrase:' + p.join(',')))];
}
// SPEC §15 MA3, from the level's DATA (its mechanic, range, wholes, coins), never its number.
const span = (a, b, d = 1) => { const o = []; for (let v = a; v <= b; v += d) o.push(v); return o; };
function mathItems(cur, level) {
  const l = cur.maths[level - 1] || {}, r = l.range || [1, 1];
  if (l.mechanic === 'flash') return span(r[0], r[1]).map(n => 'sub:' + n);
  if (l.mechanic === 'market') { const lo = Math.max(r[0], 1 + Math.max(0, ...cur.maths.slice(0, level - 1).filter(m => m.mechanic === 'market').map(m => m.range[1]))); return span(lo, r[1]).map(n => 'count:' + n); }
  if (l.mechanic === 'compare') return ['cmp:more', 'cmp:fewer', 'cmp:same'];
  if (l.mechanic === 'path') return ['path:+1', 'path:+2', 'path:+3', 'path:-1'];
  if (l.mechanic === 'hide') return (l.wholes || []).flatMap(w => span(1, w - 1).map(a => `bond:${w}:${a}`));
  if (l.mechanic === 'kitchen') return ['add:' + l.maxSum, 'take:' + l.maxSum, ...(l.maxSum >= 10 ? ['missing:10'] : [])];
  if (l.mechanic === 'tenframe') return l.wholes ? [...span(1, 9).map(k => 'make10:' + k), ...span(1, 5).map(k => 'double:' + k)] : span(r[0], r[1]).map(n => 'teen:' + n);
  const cs = l.coins || [5, 10, 25], step = Math.min(...cs);
  if (l.mechanic === 'till') return l.task === 'price' ? span(2 * step, l.maxPrice, step).map(p => 'price:' + p) : [...cs.map(c => 'coin:' + c), ...(l.skipBy || []).map(c => 'skip:' + c)];
  if (l.mechanic === 'till_change') return span(step, l.maxPrice, step).map(p => 'change:' + p);
  return [];
}
function shapeItems(cur, level) {
  const l = cur.shapes[level - 1] || {};
  if (l.shapes) return l.shapes.map(s => 'shape:' + s);
  if (l.units) return l.units.map(u => 'pattern:' + u);
  return (l.compose || []).map(s => 'compose:' + s);
}
export function levelItems(cur, skill, level, ctx = {}) {
  if (skill === 'math') return mathItems(cur, level);
  if (skill === 'shapes') return shapeItems(cur, level);
  if (skill === 'read') { const r = cur.read[level - 1] || {}; if (r.pairs) return r.pairs.map(p => 'rhyme:' + p[0]); if (r.mode === 'audio') return r.words.map(w => 'blend:' + w);
    return [...(r.gpcs || []).map(g => 'gpc:' + g), ...(r.pictures || []).map(w => 'read:' + w), ...(r.tricky || []).map(w => 'tricky:' + w)]; }
  if (skill === 'music') return musicItems(cur, level);
  const t = cur.trace[level - 1] || {}; if (t.glyphs) return t.glyphs.map(g => 'trace:' + g); if (t.captions) return t.captions.map(c => 'caption:' + c);
  if (t.wordsFrom) return ((cur.read[(ctx.readLevel || 1) - 1] || {}).pictures || []).map(w => 'word:' + w); return [];
}
export function recordItem(ledger, key, outcome, day) { const e = ledger[key] || (ledger[key] = {first: [], n: 0}); e.n++; if (outcome === 'first') e.first.push(day); e.last = outcome; return ledger; }
export const isSecure = (e, rule) => !!e && e.first.length >= rule.firstTryPasses && new Set(e.first).size >= rule.distinctDays;
export function levelPassed(cur, skill, level, ledger, ctx = {}) {
  const items = levelItems(cur, skill, level, ctx); if (!items.length) return false; const adv = skill === 'trace' && level <= 11 ? cur.trace[level - 1].advanceAt : 0;
  const ok = items.filter(k => isSecure(ledger[k], cur.mastery.item) && (!adv || ((ctx.guides || {})[k.slice(6)]?.g || 1) >= adv)).length;
  const lad = {read: cur.read, trace: cur.trace, math: cur.maths, shapes: cur.shapes, music: cur.music}[skill] || [], need = (lad[level - 1] || {}).shareToPass ?? cur.mastery.levelUp.shareOfLevelItemsMastered; // a level may need more than the default share (M7, M9: every bond secure)
  return ok / items.length >= need;
}
export function masteryLevel(cur, skill, level, ledger, history, ctx = {}) {
  const n = cur.mastery.levelDown.demosInARow, max = maxLevel(cur, skill);
  if (history.length >= n && history.slice(-n).every(x => x === 'demo')) return Math.max(1, level - 1);
  return levelPassed(cur, skill, level, ledger, ctx) ? Math.min(max, level + 1) : level;
}
export function pickItem(cur, skill, level, ledger, taskIndex, rng = Math.random, ctx = {}) {
  if (taskIndex % 3 === 2 && level > 1) { const e = []; for (let l = 1; l < level; l++) e.push(...levelItems(cur, skill, l, ctx)); return {key: e[Math.floor(rng() * e.length)], review: true}; }
  let items = levelItems(cur, skill, level, ctx); if (items.length >= 2) items = items.filter(k => k !== ctx.last);
  const n = k => (ledger[k] ? ledger[k].first.length : 0), min = Math.min(...items.map(n)), pool = items.filter(k => n(k) === min);
  return {key: pool[Math.floor(rng() * pool.length)], review: false};
}
export function nextGuide(s, o) { s = s ? {...s} : {g: 1, run: 0, demos: 0};
  if (o === 'first') { s.run++; s.demos = 0; if (s.run >= 3) { s.g = Math.min(5, s.g + 1); s.run = 0; } }
  else if (o === 'demo') { s.demos++; s.run = 0; if (s.demos >= 2) { s.g = Math.max(1, s.g - 1); s.demos = 0; } }
  else { s.run = 0; s.demos = 0; } return s; }
const p2 = n => String(n).padStart(2, '0');
export const dayKey = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
