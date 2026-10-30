// Sprite/layer renderer: one persistent stage (background + character sprites) under the HTML game UI.
// Characters play their frame sequences at ~12 fps. Missing frames fall back to a single stand-in sprite that bobs instead
// (or, for a sprite with no stand-in such as the dog, are simply not drawn).
//
// ONE WORLD SCALE: every character set is drawn at (sprite px / px_per_unit) * UNIT percent of the stage height and stands on its
// manifest ground_px, so the girl, the unicorn, the princess, the kitty and the dog all share one scale and one floor line.
import {resolve, frames, chain, status} from './art.mjs';

const FPS = 12;
export const RATIO = 2360 / 1640;
export const UNIT = 31.2; // % of stage height per 1.0 world unit (px_per_unit 520): unicorn idle = 52% (café), unicorn happy = 60%, girl idle = 55%
const BG_FILTER = {bg_cafe: '', bg_ticket: 'hue-rotate(25deg) saturate(.8) blur(4px)', bg_market: 'hue-rotate(-30deg) blur(4px)', bg_till: 'hue-rotate(-60deg) blur(4px)', bg_kitchen: 'hue-rotate(60deg) blur(4px)', bg_kitchen_nopan: 'hue-rotate(60deg) blur(4px)', bg_serve: 'hue-rotate(15deg)', bg_closing: 'hue-rotate(200deg) brightness(.8) saturate(.9)'};
// bg_market's dark green display ledges are ~4% near-black (screens-check fails above 3%): lift the shadows a little at draw time (the PNG is untouched).
const BG_LIFT = {bg_market: 'brightness(1.1) contrast(.86)'};
// Foreground occluders: a clipped copy of the background drawn OVER the actors that stand behind it (the girl behind the café counter).
// Percent of the stage, measured on bg_cafe.png / bg_closing.png (counter top back edge y=71, right end x=73).
const FG = {counter: 'polygon(0% 71%,73% 71%,71.5% 100%,0% 100%)'};

export function createStage(host) {
  host.insertAdjacentHTML('afterbegin', '<div id="stage" aria-hidden="true"><img class="bg" alt="" draggable="false"><img class="fg" alt="" draggable="false"></div>');
  const el = host.querySelector('#stage'), bgImg = el.querySelector('.bg'), fgImg = el.querySelector('.fg');
  const actors = new Map();
  let bgName = null, token = 0;

  async function setBg(name) {
    if (bgName === name) return;
    bgName = name;
    const t = ++token;
    const r = await resolve(name);
    if (t !== token) return;
    bgImg.src = r.url;
    fgImg.src = r.url;
    bgImg.dataset.art = name;
    bgImg.dataset.level = r.level;
    bgImg.style.filter = fgImg.style.filter = r.level === 'art' ? (BG_LIFT[name] || '') : (BG_FILTER[name] || '');
    el.dataset.bg = name;
  }
  function setFg(kind) {
    el.dataset.fg = kind || '';
    fgImg.style.clipPath = kind ? FG[kind] : '';
    fgImg.hidden = !kind;
  }

  class Actor {
    constructor(id) {
      this.id = id;
      this.root = document.createElement('div');
      this.root.className = 'actor';
      this.img = document.createElement('img');
      this.img.alt = '';
      this.img.draggable = false;
      this.root.append(this.img);
      el.append(this.root);
      this.seq = [];
      this.i = 0;
      this.loop = true;
      this.then = null;
      this.char = null;
      this.anim = null;
      this.key = '';
      this.meta = null;
      this.s = 1;
      this.fallbackH = 55;
    }
    // x,y = where the FEET stand (percent of the stage); s = size multiplier on the shared world scale; back = stand behind the foreground occluder.
    place({x, y, s = 1, h, flip = false, back = false}) {
      Object.assign(this.root.style, {left: x + '%', top: y + '%', zIndex: back ? 1 : 3});
      this.root.style.setProperty('--flip', flip ? -1 : 1);
      this.x = x;
      this.s = s;
      if (h) this.fallbackH = h;
      this.layout();
    }
    // Height + anchor from the sprite manifest (ground_px is where the feet touch); defaults when there is no manifest entry.
    layout() {
      const m = this.meta, st = this.root.style;
      const ax = m ? m.gx / m.w * 100 : 50, ay = m ? m.gy / m.h * 100 : 98;
      st.height = (m ? m.h / m.ppu * UNIT * this.s : this.fallbackH * this.s) + '%';
      st.setProperty('--ax', -ax + '%'); st.setProperty('--ay', -ay + '%');
      st.setProperty('--ox', ax + '%'); st.setProperty('--oy', ay + '%');
    }
    async play(char, anim, {loop = true, then = null} = {}) {
      const key = char + '/' + anim;
      if (this.key === key && this.loop === loop && !then) return;
      this.key = key; this.char = char; this.anim = anim; this.loop = loop; this.then = then;
      const t = (this.t = (this.t || 0) + 1);
      const s = await frames(char, anim);
      if (t !== this.t) return;
      this.seq = s.urls; this.i = 0;
      this.meta = s.real ? s.meta : null;
      this.layout();
      this.root.classList.toggle('still', !s.real && s.urls.length > 0);
      this.root.classList.toggle('missing', s.urls.length === 0);
      this.root.dataset.anim = anim; this.root.dataset.real = s.real ? '1' : '0';
      if (s.urls.length) this.img.src = this.seq[0];
      else if (then) then(); // nothing to show: let the caller's chain (wake -> wag) keep going rather than stall
    }
    get real() { return this.root.dataset.real === '1' && !this.root.classList.contains('hidden'); }
    tick() {
      if (this.seq.length < 2) return;
      let n = this.i + 1;
      if (n >= this.seq.length) {
        if (!this.loop) { const f = this.then; this.then = null; this.loop = true; if (f) f(); return; }
        n = 0;
      }
      this.i = n;
      this.img.src = this.seq[n];
    }
    // Slide horizontally (percent of stage width). Plays `during` frames while moving.
    moveTo(x, ms, done) {
      this.root.getAnimations().forEach(a => a.cancel());
      const from = this.x ?? x;
      this.x = x;
      this.root.style.left = x + '%';
      const a = this.root.animate([{left: from + '%'}, {left: x + '%'}], {duration: ms, easing: 'ease-in-out'});
      a.onfinish = () => done?.();
      return a;
    }
    // Scale-bounce (tap feedback / happy beats).
    bounce() { this.root.animate([{translate: '0 0'}, {translate: '0 -6%'}, {translate: '0 0'}], {duration: 450, easing: 'ease-out'}); }
    remove() { this.t++; this.root.remove(); actors.delete(this.id); }
  }

  setInterval(() => { for (const a of actors.values()) a.tick(); }, 1000 / FPS);

  // Declarative scene: spec = {id,char,anim,x,y,s,flip,back,loop,hit:{id,label,quiet}}. Same id + same anim keeps playing (no restart on UI redraw).
  // `fg` = name of a foreground occluder (see FG) or none.
  function scene(bg, specs = [], fg = null) {
    setBg(bg);
    setFg(fg);
    const keep = new Set();
    for (const s of specs) {
      keep.add(s.id);
      let a = actors.get(s.id);
      const fresh = !a;
      if (!a) { a = new Actor(s.id); actors.set(s.id, a); }
      if (fresh || s.place !== false) {
        if (fresh || !s.keepPos) a.place(s);
        else { a.root.style.zIndex = s.back ? 1 : 3; a.s = s.s ?? 1; a.layout(); }
      }
      a.play(s.char, s.anim, {loop: s.loop ?? true, then: s.then});
      a.root.classList.toggle('hidden', !!s.hidden);
      let hit = a.root.querySelector('.hit');
      if (s.hit) {
        if (!hit) { hit = document.createElement('button'); hit.className = 'hit'; a.root.append(hit); }
        hit.classList.toggle('quiet', !!s.hit.quiet);
        hit.id = s.hit.id; hit.setAttribute('aria-label', s.hit.label);
      } else hit?.remove();
    }
    for (const [id, a] of [...actors]) if (!keep.has(id)) a.remove();
    return actors;
  }
  return {el, scene, actor: id => actors.get(id), actors, setBg, get bg() { return bgName; }};
}
export {status, chain};
