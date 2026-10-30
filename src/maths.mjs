// Pure maths engine (no DOM), SPEC §15 MA4-MA5: one task object per item key. Every number range, coin and price comes from the curriculum DATA
// (curriculum.json maths[] / shapes[]); `answer` is the value she must give, `choices` (when present) are 3 distinct options that contain it.
import {levelItems} from './mastery.mjs';
import {maxLevel} from './curriculum.mjs';

const int = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1)); // inclusive
const shuffle = (a, rng) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
// Three distinct numbers containing `answer`: two distractors from lo..hi, nearest first (so a card is a believable wrong answer), in a random order.
export function numChoices(answer, lo, hi, rng = Math.random, step = 1) {
  let cand = [];
  for (let v = lo; v <= hi; v += step) if (v !== answer) cand.push(v);
  for (let h = hi; cand.length < 2; h += step) if (h !== answer && !cand.includes(h) && h > lo) cand.push(h);
  cand.sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer));
  const two = shuffle(cand.slice(0, 4), rng).slice(0, 2);
  return shuffle([answer, ...two], rng);
}
// Every multiset of `coins` that sums to p, as sorted (ascending) arrays.
export function coinWays(p, coins) {
  const cs = [...new Set(coins)].sort((a, b) => b - a), out = [];
  const go = (left, i, acc) => { if (left === 0) { out.push([...acc].sort((a, b) => a - b)); return; } if (i >= cs.length) return; const c = cs[i];
    for (let k = Math.floor(left / c); k >= 0; k--) go(left - k * c, i + 1, [...acc, ...Array(k).fill(c)]); };
  go(p, 0, []);
  return out;
}
export const payOk = (coins, p) => Array.isArray(coins) && coins.length > 0 && coins.reduce((a, b) => a + b, 0) === p;

const entryOf = (cur, level) => cur.maths[level - 1] || {};
// The first level whose items include this key (the level that teaches it).
export function ownerLevel(cur, item, skill = 'math') {
  for (let l = 1; l <= maxLevel(cur, skill); l++) if (levelItems(cur, skill, l).includes(item)) return l;
  return 1;
}
export function mathTask(cur, item, rng = Math.random) {
  const i = String(item).indexOf(':'), kind = String(item).slice(0, i), rest = String(item).slice(i + 1), x = rest.split(':')[0], n = Number(x);
  const level = ownerLevel(cur, item), e = entryOf(cur, level), mechanic = e.mechanic, hi = (e.range && e.range[1]) || 10;
  const base = {mechanic, item, level};
  if (kind === 'sub') return {...base, n, answer: n, choices: numChoices(n, 1, Math.max(hi, 3), rng)};
  if (kind === 'count') return {...base, n, answer: n, tenframe: hi > 5, choices: numChoices(n, 1, Math.max(hi, n + 1), rng)};
  if (kind === 'cmp') {
    let a, b; const top = Math.min(10, hi);
    if (x === 'same') { a = b = int(1, top, rng); } else { a = int(1, top, rng); do { b = int(1, top, rng); } while (b === a); }
    const answer = x === 'same' ? 'same' : ((x === 'more') === (a > b) ? 'left' : 'right');
    return {...base, a, b, ask: x, answer, choices: ['left', 'right', 'same']};
  }
  if (kind === 'path') {
    const step = Number(x); let from; do { from = int(1, 10, rng); } while (from + step < 1 || from + step > 10);
    return {...base, from, step, answer: from + step, choices: numChoices(from + step, 1, 10, rng)};
  }
  if (kind === 'bond') { const a = Number(rest.split(':')[1]); return {...base, whole: n, shown: a, answer: n - a, choices: numChoices(n - a, 1, n, rng)}; }
  if (kind === 'add') { const a = int(1, n - 1, rng), b = int(1, n - a, rng); return {...base, a, b, maxSum: n, answer: a + b, choices: numChoices(a + b, 1, n + 1, rng)}; }
  if (kind === 'take') { const a = int(2, n, rng), b = int(1, a - 1, rng); return {...base, a, b, maxSum: n, answer: a - b, choices: numChoices(a - b, 1, n, rng)}; }
  if (kind === 'missing') { const c = int(2, 10, rng), a = int(1, c - 1, rng); return {...base, a, c, answer: c - a, choices: numChoices(c - a, 1, 9, rng)}; }
  if (kind === 'make10') return {...base, k: n, answer: 10 - n, choices: numChoices(10 - n, 1, 9, rng)};
  if (kind === 'double') return {...base, k: n, answer: 2 * n, choices: numChoices(2 * n, 1, 10, rng)};
  if (kind === 'teen') return {...base, n, answer: n, choices: numChoices(n, 11, 20, rng)};
  if (kind === 'coin') return {...base, value: n, answer: n, choices: shuffle(e.coins || [5, 10, 25], rng)};
  if (kind === 'skip') { const count = int(2, 5, rng); return {...base, count, step: n, answer: count * n, choices: numChoices(count * n, n, 6 * n, rng, n)}; }
  if (kind === 'price') { const ways = shuffle(coinWays(n, e.coins || [5, 10, 25]), rng); return {...base, price: n, coins: e.coins || [5, 10, 25], answer: ways.slice(0, 2)}; }
  if (kind === 'change') { const pay = e.pay || 25; return {...base, price: n, pay, coins: e.coins || [5, 10, 25], answer: pay - n}; }
  return {...base, answer: null};
}

// ---- shapes and patterns (SPEC §15 MA2): the art is the plate / napkin / sandwich / tray and the pat_* pieces ----
export const SHAPE_ART = {circle: 'plate', square: 'pic_napkin', triangle: 'pic_sandwich', rectangle: 'pic_tray'};
export const PAT_PIECES = ['pat_banana', 'pat_cookie', 'pat_cupcake', 'pat_grape', 'pat_strawberry'];
export function shapeTask(cur, item, rng = Math.random) {
  const i = String(item).indexOf(':'), kind = String(item).slice(0, i), rest = String(item).slice(i + 1), level = ownerLevel(cur, item, 'shapes');
  const base = {mechanic: 'shapes', item, level};
  if (kind === 'shape') return {...base, kind, shape: rest, answer: SHAPE_ART[rest], choices: shuffle([SHAPE_ART[rest], ...shuffle(Object.values(SHAPE_ART).filter(a => a !== SHAPE_ART[rest]), rng).slice(0, 2)], rng)};
  if (kind === 'compose') return {...base, kind, shape: rest, parts: ['pic_sandwich', 'pic_sandwich'], answer: SHAPE_ART[rest], choices: shuffle(['pic_napkin', 'plate', 'pic_tray'], rng)};
  // pattern: show the unit repeated twice plus its first piece; she picks the piece that comes next
  const unit = rest, letters = [...new Set(unit.split(''))], pieces = shuffle(PAT_PIECES, rng).slice(0, letters.length), art = Object.fromEntries(letters.map((c, k) => [c, pieces[k]]));
  const seq = (unit + unit + unit[0]).split('').map(c => art[c]), answer = art[unit[1 % unit.length]];
  const others = shuffle(PAT_PIECES.filter(p => p !== answer), rng).slice(0, 2);
  return {...base, kind: 'pattern', unit, seq, answer, choices: shuffle([answer, ...others], rng)};
}
