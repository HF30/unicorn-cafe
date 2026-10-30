// Piano screen UI (no sound here: main.mjs plays notes through piano-audio.mjs).
// Layout (kitchen-v2 brief §7): top ~40% = the stove with the bubbling pot, the girl and a small customer, with the 88-key mini-map strip
// under it; bottom ~60% = a full-width realistic keyboard drawn from keyLayout(): ivory white keys with thin dark gaps, glossy black keys in the
// 2-3 grouping at ~60% length, a slim dark felt strip along the top, a press-down + tint, and the next key lit in its colour.
// Keys use pointer events keyed by pointerId (multi-touch safe). If a key_animal_* png is missing the key still draws as a CSS key (css-key)
// with a coloured circle (key-dot). The old cabinet art is not used.
import {keyLayout, miniMap} from './music.mjs';
import {imgHtml, panFrames} from './art.mjs';
import {bounce} from './fx.mjs';

const COLOURS = {red: '#e5484d', orange: '#f59a23', yellow: '#f4c20d', green: '#3fae6a', teal: '#14b8a6', blue: '#3b82f6', purple: '#8b5cf6'};
const animalArt = k => k.art || 'key_animal_' + String(k.letter || k.note[0]).toLowerCase();
const pct = v => (Math.round(v * 10000) / 100) + '%';

function miniMapHtml(low, high) {
  const {keys, highlight} = miniMap(low, high), WHITES = keys.filter(k => k.white).length;
  let wc = 0, html = '', hl = null;
  const left = [], right = [];
  keys.forEach((k, i) => {
    if (k.white) { left[i] = wc / WHITES; right[i] = (wc + 1) / WHITES; html += `<i class="mm w" style="left:${pct(wc / WHITES)};width:${pct(1 / WHITES)}"></i>`; wc++; }
    else { const w = 0.6 / WHITES; left[i] = wc / WHITES - w / 2; right[i] = left[i] + w; html += `<i class="mm b" style="left:${pct(left[i])};width:${pct(w)}"></i>`; }
  });
  hl = `<b class="mm-hl" style="left:${pct(left[highlight[0]])};width:${pct(right[highlight[1]] - left[highlight[0]])}"></b>`;
  return html + hl;
}

// opts: keys (curriculum keys), low/high midi of the visible octave, customer/girl art names, ingredients in the pot, onPress(note, el), onRelease(note)
// curriculum-v1 P2 opts: lid (U1: a pot-lid button #lid in place of the keys), card (U13: a #notecard of note letters; pair with faded), faded (the keys lose colour + animal: class `faded`),
// onLid(fn). Only the keys from low to high (midi) are drawn: C4..C5 normally, C3..C5 when the task needs it (keyRange) and in free play.
export function mountPiano(host, {keys, low = 60, high = 72, girl = 'girl_idle_00', customer = 'unicorn_idle_00', ingredients = [], onPress = () => {}, onRelease = () => {}, lid = false, card = false, faded = false, onLid = () => {}} = {}) {
  keys = keys.filter(k => k.midi >= low && k.midi <= high);
  const lay = keyLayout(keys), byNote = new Map(keys.map(k => [k.note, k])), W = Math.max(...lay.filter(l => l.white).map(l => l.x)) + 1;
  const root = document.createElement('div');
  root.className = 'pianoscreen' + (lid ? ' lidmode' : '') + (faded ? ' faded' : ''); root.id = 'pianoscreen';
  const keyHtml = l => {
    const k = byNote.get(l.note), colour = COLOURS[k.colour] || '#ffd24d', style = `left:${pct(l.x / W)};width:${pct(l.w / W)};${l.white ? '' : `height:${pct(l.h)};`}--kc:${colour}`;
    const fd = faded ? ' faded' : '';
    if (!l.white) return `<div class="key black css-key${fd}" data-note="${l.note}" style="${style}"><span class="key-label">${k.label}</span></div>`;
    return `<div class="key white css-key${fd}" data-note="${l.note}" style="${style}"><span class="key-art"><img class="key-animal" src="art/${animalArt(k)}.png" alt="" draggable="false"></span><span class="key-dot"></span><span class="key-label">${k.label}</span><span class="key-strip"></span></div>`;
  };
  root.innerHTML = `<div class="pstove"><div class="pcust">${imgHtml(customer, 'pcustimg')}</div><div class="ppot" id="ppot"><div class="pbubbles"></div>${imgHtml('pan_cooking_00', 'panimg ppanimg')}<div class="inpan">${ingredients.map(n => imgHtml('item_' + n, 'mini')).join('')}</div></div><div class="pgirl">${imgHtml(girl, 'pgirlimg')}</div>${card ? '<div class="notecard" id="notecard"></div>' : ''}</div>`
    + `<div class="pmap" aria-hidden="true">${miniMapHtml(low, high)}</div>`
    + `<div class="pkeys"><div class="felt"></div>${lid ? `<div class="plidwrap"><button id="lid" class="lidbtn" aria-label="Tap the pot lid">${imgHtml('pic_lid', 'lidimg')}</button></div>` : ''}<div class="kb" id="kb">${lay.filter(l => l.white).map(keyHtml).join('')}${lay.filter(l => !l.white).map(keyHtml).join('')}</div></div>`;
  host.append(root);
  // keys whose animal art is missing keep working: show the coloured circle instead
  for (const img of root.querySelectorAll('.key-animal')) img.addEventListener('error', () => img.closest('.key')?.classList.add('noart'));
  const kb = root.querySelector('#kb'), pot = root.querySelector('#ppot'), bubbles = root.querySelector('.pbubbles'), girlEl = root.querySelector('.pgirl');
  const keyEl = n => kb.querySelector(`.key[data-note="${n}"]`);
  let locked = false, timer = null;
  const down = new Map(); // pointerId -> key element (several fingers can play at once)
  kb.addEventListener('pointerdown', e => {
    const el = e.target.closest?.('.key');
    if (!el || locked || el.classList.contains('off')) return;
    e.preventDefault();
    down.set(e.pointerId, el); el.classList.add('pressed');
    onPress(el.dataset.note, el);
  });
  const up = e => {
    const el = down.get(e.pointerId);
    if (!el) return;
    down.delete(e.pointerId); el.classList.remove('pressed'); onRelease(el.dataset.note);
  };
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, up);
  const lidEl = root.querySelector('#lid');
  if (lidEl) lidEl.addEventListener('pointerdown', e => { e.preventDefault(); if (!locked) onLid(performance.now()); });
  panFrames().then(fr => {
    const im = root.querySelector('.ppanimg');
    if (!fr || !im || !root.isConnected) return;
    let i = 0; timer = setInterval(() => { if (!root.isConnected) { clearInterval(timer); return; } if (pot.classList.contains('boil')) { i = (i + 1) % fr.length; im.src = fr[i]; } }, 1000 / 12);
  }).catch(() => {});
  return {
    root, keyEl, lidEl,
    // only the notes the predicate accepts stay alive; the others dim and ignore touches
    only(pred) { for (const el of kb.querySelectorAll('.key')) el.classList.toggle('off', !pred(el.dataset.note)); },
    setCard(text) { const c = root.querySelector('#notecard'); if (c) c.textContent = text; },
    lidHit() { if (lidEl) bounce(lidEl, 1.12); },
    setLocked(b) { locked = !!b; root.classList.toggle('locked', locked); },
    // the key to play next lights in its colour; pulse = demo mode (the key throbs)
    setNext(note, {pulse = false} = {}) {
      for (const el of kb.querySelectorAll('.next,.pulse')) el.classList.remove('next', 'pulse');
      const el = note && keyEl(note);
      if (el) { el.classList.add('next'); if (pulse) el.classList.add('pulse'); }
    },
    // light a key for a moment (the unicorn plays the phrase)
    flash(note, ms = 420) { const el = keyEl(note); if (!el) return; el.classList.add('lit', 'pressed'); setTimeout(() => el.classList.remove('lit', 'pressed'), ms); },
    bubble() {
      pot.classList.add('boil'); bounce(pot, 1.06);
      for (let i = 0; i < 6; i++) { const b = document.createElement('span'); b.className = 'bub'; b.style.left = (12 + Math.random() * 76) + '%'; b.style.animationDelay = (i * 70) + 'ms'; bubbles.append(b); setTimeout(() => b.remove(), 1400); }
      clearTimeout(pot._t); pot._t = setTimeout(() => pot.classList.remove('boil'), 1100);
    },
    sparkle(note) {
      const el = keyEl(note); if (!el) return;
      const s = document.createElement('span'); s.className = 'notespark'; s.textContent = '♪'; s.style.left = el.style.left; s.style.setProperty('--kc', el.style.getPropertyValue('--kc'));
      kb.append(s); setTimeout(() => s.remove(), 1200);
    },
    cheer() { bounce(girlEl, 1.12); },
    destroy() { clearInterval(timer); for (const ev of ['pointerup', 'pointercancel']) window.removeEventListener(ev, up); root.remove(); },
  };
}
