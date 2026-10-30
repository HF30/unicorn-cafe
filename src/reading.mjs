import {levelItems} from './mastery.mjs';
const V = 'aeiou';
export const cumulativeGpcs = (cur, level) => cur.read.slice(0, level).flatMap(r => r.gpcs || []);
export function soundButtons(word, gpcs) {
  const set = new Set(gpcs.filter(g => !g.includes('-'))), out = []; let split = null;
  if (word.length >= 3 && word.endsWith('e')) { const v = word[word.length - 3], c = word[word.length - 2]; if (gpcs.includes(v + '-e') && !V.includes(c)) split = {g: v + '-e', at: [word.length - 3, word.length - 1]}; }
  const max = Math.max(1, ...[...set].map(g => g.length)); let i = 0;
  while (i < word.length) {
    if (split && i === split.at[0]) { out.push(split); i++; continue; } if (split && i === split.at[1]) { i++; continue; }
    let hit = null; for (let L = Math.min(max, word.length - i); L >= 1; L--) { const s = word.slice(i, i + L); if (set.has(s) && !(split && i < split.at[1] && i + L > split.at[1])) { hit = s; break; } }
    if (!hit) return null; out.push({g: hit, at: Array.from({length: hit.length}, (_, k) => i + k)}); i += hit.length;
  }
  return out;
}
export const decodable = (w, g) => soundButtons(w, g) !== null;
export const pictureArt = (cur, w) => (cur.pictureArt && cur.pictureArt[w]) || 'pic_' + w;
export const decodableFoods = (cur, level, foods) => foods.filter(f => decodable(f, cumulativeGpcs(cur, level)));
const levelOf = (cur, item) => { for (let l = 1; l <= cur.read.length; l++) if (levelItems(cur, 'read', l, {}).includes(item)) return l; return 1; };
const allPics = cur => [...new Set(cur.read.flatMap(r => r.pictures || []))];
function three(right, pool, rng) { const o = [...new Set(pool)].filter(x => x !== right); const a = [];
  while (a.length < 2) { const x = o.splice(Math.floor(rng() * o.length), 1)[0]; a.push(x); }
  const at = Math.floor(rng() * 3); a.splice(at, 0, right); return {choices: a, answer: at}; }
export function readTask(cur, item, rng = Math.random) {
  const i = item.indexOf(':'), kind = item.slice(0, i), v = item.slice(i + 1), l = levelOf(cur, item), lv = cur.read[l - 1];
  if (kind === 'rhyme') return {kind, item, word: v, ...three(lv.pairs.find(p => p[0] === v)[1], allPics(cur), rng)};
  if (kind === 'blend') return {kind, item, word: v, sounds: soundButtons(v, cumulativeGpcs(cur, cur.read.length)).map(b => b.g), ...three(v, allPics(cur), rng)};
  if (kind === 'read') return {kind, item, word: v, buttons: soundButtons(v, cumulativeGpcs(cur, l)), ...three(v, allPics(cur), rng)};
  if (kind === 'gpc') return {kind, item, gpc: v, ...three(v, cumulativeGpcs(cur, l), rng)};
  return {kind, item, word: v, ...three(v, cur.read.flatMap(r => r.tricky || []), rng)};
}
