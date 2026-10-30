// Art contract (_briefs/art-contract.md) -> file names, plus the graceful fallback chain for any file not yet on disk.
// Chain for every art name: art/<name>.png  ->  a stand-in already in the app (fallback/ or assets/)  ->  a soft placeholder.
import words from '../content/words.json' with {type:'json'};

export const CHARACTERS = {
  girl: {idle: 12, wave: 12, cheer: 12, stir: 12, think: 6},
  unicorn: {walk: 16, idle: 12, happy: 12, order: 6},
  princess: {walk: 16, idle: 12, happy: 12, order: 6},
  kitty: {walk: 16, idle: 12, happy: 12, order: 6},
  // Buddy, the café dog (rendered separately; every frame is optional: a missing set just hides him, see frames()).
  dog: {sleep: 12, wake: 8, wag: 12, walk: 16},
};
export const BACKGROUNDS = ['bg_cafe', 'bg_ticket', 'bg_market', 'bg_till', 'bg_kitchen', 'bg_kitchen_nopan', 'bg_serve', 'bg_closing'];
export const UI = ['ui_settings', 'ui_music', 'ui_music_off', 'ui_back', 'ui_check', 'ui_undo'];
export const ITEM_IDS = words.map(w => (typeof w === 'string' ? w : w.word));
export const STICKERS = 12;
export const PAN_FRAMES = 8;
const pad = n => String(n).padStart(2, '0');

// Every file name the contract promises (without extension).
export function contractNames() {
  const out = [...BACKGROUNDS, ...UI, 'coin', 'coin_s', 'basket', 'basket_full', 'pan', 'spoon', 'plate'];
  for (const [c, anims] of Object.entries(CHARACTERS)) for (const [a, n] of Object.entries(anims)) for (let i = 0; i < n; i++) out.push(`${c}_${a}_${pad(i)}`);
  for (let i = 0; i < PAN_FRAMES; i++) out.push(`pan_cooking_${pad(i)}`);
  for (let i = 0; i < STICKERS; i++) out.push(`sticker_${pad(i)}`);
  for (const id of ITEM_IDS) out.push(`item_${id}`, `dish_${id}`);
  return out;
}

const FALLBACK_BG = 'fallback/cafe.jpg';
const CHAR_FALLBACK = {girl: 'fallback/girl.png', unicorn: 'fallback/unicorn.png', princess: 'fallback/unicorn.png', kitty: 'fallback/unicorn.png'};
// Soft placeholder: a pastel blob with a symbol, as an inline data URI (no network, no file).
export function placeholder(symbol = '★', hue = 300) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="6" y="6" width="88" height="88" rx="30" fill="hsl(${hue} 70% 90%)" stroke="hsl(${hue} 50% 80%)" stroke-width="4"/><text x="50" y="68" font-size="52" text-anchor="middle" fill="hsl(${hue} 40% 55%)" font-family="sans-serif">${symbol}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
const UI_SYMBOL = {ui_settings: '⚙', ui_music: '♫', ui_music_off: '✕', ui_back: '↶', ui_check: '✓', ui_undo: '↶'};

// Ordered list of urls to try for an art name (relative to app/).
export function chain(name) {
  const primary = `art/${name}.png`;
  let m;
  if (name.startsWith('bg_')) return [primary, FALLBACK_BG, placeholder('', 300)];
  if (name.startsWith('ui_')) return [primary, placeholder(UI_SYMBOL[name] || '★', 270)];
  if ((m = name.match(/^(girl|unicorn|princess|kitty)_/))) return [primary, CHAR_FALLBACK[m[1]]];
  if (name.startsWith('item_')) return [primary, `assets/${name.slice(5)}.svg`, placeholder('★', 40)];
  if (name.startsWith('dish_')) return [primary, 'assets/plate.svg', placeholder('★', 40)];
  if (name.startsWith('pan_cooking_') || name === 'pan') return [primary, 'assets/pan.svg'];
  if (name === 'basket_full') return [primary, 'art/basket.png', 'assets/basket.svg'];
  if (name.startsWith('sticker_')) return [primary, Number(name.slice(8)) % 2 ? 'assets/sparkle.svg' : 'assets/unicorn.svg'];
  if (name === 'coin_s') return [primary, 'art/coin.png', 'assets/coin.svg'];
  if (['coin', 'basket', 'spoon', 'plate'].includes(name)) return [primary, `assets/${name}.svg`];
  return [primary, placeholder()];
}

export const status = {}; // name -> 'art' | 'fallback' | 'placeholder' (what actually rendered; read by tools/screens-check)
const cache = new Map();
// Resolve an art name to a loaded url (first working link in the chain). Never rejects.
export function resolve(name) {
  if (cache.has(name)) return cache.get(name);
  const urls = chain(name);
  const p = new Promise(done => {
    const next = i => {
      const url = urls[i];
      if (url.startsWith('data:')) { status[name] = 'placeholder'; done({url, level: 'placeholder'}); return; }
      const im = new Image();
      im.onload = () => { status[name] = i === 0 ? 'art' : 'fallback'; done({url, level: status[name], im}); };
      im.onerror = () => (i + 1 < urls.length ? next(i + 1) : (status[name] = 'placeholder', done({url: placeholder(), level: 'placeholder'})));
      im.src = url;
    };
    next(0);
  });
  cache.set(name, p);
  return p;
}

// Frame sequence for a character animation: only frames that exist; one stand-in frame if none do.
export async function frames(char, anim) {
  const n = CHARACTERS[char][anim];
  const got = await Promise.all(Array.from({length: n}, (_, i) => resolveStrict(`${char}_${anim}_${pad(i)}`)));
  const real = got.filter(Boolean);
  const meta = await spriteMeta(char, anim);
  if (real.length) return {urls: real, real: true, meta};
  const fb = CHAR_FALLBACK[char];
  return {urls: fb ? [fb] : [], real: false, meta: null}; // no stand-in (e.g. the dog) -> no sprite at all
}
// Sprite geometry from the art manifests: canvas size + the ground point (feet) + px_per_unit, so every set shares ONE world scale
// and stands on its ground_px. Manifests that are missing or unreadable just mean "no meta" (the stage then uses a plain default).
let metaP = null;
function loadMeta() {
  return metaP ??= (async () => {
    const out = {};
    for (const f of ['characters', 'dog']) {
      try {
        const j = (await import(`../art/${f}.manifest.json`, {with: {type: 'json'}})).default; // a missing manifest just rejects -> skipped (no network call)
        const chars = j.characters || (j.sets ? {dog: j} : {});
        for (const [c, v] of Object.entries(chars)) for (const [a, d] of Object.entries(v.sets || {})) {
          if (d.width && d.height && Array.isArray(d.ground_px)) out[`${c}/${a}`] = {w: d.width, h: d.height, gx: d.ground_px[0], gy: d.ground_px[1], ppu: d.px_per_unit || 520};
        }
      } catch {}
    }
    return out;
  })();
}
export async function spriteMeta(char, anim) { return (await loadMeta())[`${char}/${anim}`] || null; }
export async function panFrames() {
  const got = (await Promise.all(Array.from({length: PAN_FRAMES}, (_, i) => resolveStrict(`pan_cooking_${pad(i)}`)))).filter(Boolean);
  return got.length ? got : null;
}
const strict = new Map();
function resolveStrict(name) {
  if (strict.has(name)) return strict.get(name);
  const p = new Promise(done => { const im = new Image(); im.onload = () => { status[name] = 'art'; done(im.src && `art/${name}.png`); }; im.onerror = () => { status[name] = status[name] || 'missing'; done(null); }; im.src = `art/${name}.png`; });
  strict.set(name, p);
  return p;
}

// HTML for an <img> that walks its fallback chain on error (see armArt). `cls` is the class list.
export function imgHtml(name, cls = '', alt = '') {
  const urls = chain(name);
  return `<img class="${cls}" data-art="${name}" data-fb="0" src="${urls[0]}" alt="${alt}" draggable="false">`;
}
// Capture-phase error handler: advance a failed <img data-art> to the next url in its chain.
export function armArt(root) {
  root.addEventListener('error', e => {
    const el = e.target;
    if (!(el instanceof HTMLImageElement) || !el.dataset.art) return;
    const urls = chain(el.dataset.art), i = Number(el.dataset.fb) + 1;
    if (i < urls.length) {
      el.dataset.fb = String(i);
      el.classList.add('fb');
      status[el.dataset.art] = urls[i].startsWith('data:') ? 'placeholder' : 'fallback';
      el.src = urls[i];
    }
  }, true);
  root.addEventListener('load', e => {
    const el = e.target;
    if (el instanceof HTMLImageElement && el.dataset.art && el.dataset.fb === '0') status[el.dataset.art] = 'art';
  }, true);
}
