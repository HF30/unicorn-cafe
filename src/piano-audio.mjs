// Real piano samples (app/audio/piano/<note>.mp3, see CREDITS.md) played through WebAudio. No fetch/XHR (gate K1): every key owns a few
// <audio> elements that are routed through AudioContext.createMediaElementSource -> GainNode, so playback stays low-latency and mixable.
// ?silent=1 and the music on/off toggle both silence it: canSound({silent, musicOn}) is checked before every note.
import {SILENT} from './silent.mjs';
import {canSound} from './music.mjs';
import cur from '../content/curriculum.json' with {type: 'json'};

const SAMPLE = new Map(cur.keys.map(k => [k.note, k.sample])); // note -> "audio/piano/C4.mp3" (the key's .sample path)
let ctx = null, master = null, musicOn = true;
const voices = new Map(); // note -> {els:[HTMLAudioElement], i}

export const setPianoMusic = on => { musicOn = !!on; };
// Create the AudioContext inside a user gesture (iOS). Never creates one when silent (silent.mjs already removes AudioContext then).
export function initPianoAudio() {
  if (!canSound({silent: SILENT, musicOn: true})) return false;
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.95; master.connect(ctx.destination);
    } catch { ctx = null; return false; }
  }
  try { ctx.resume?.(); } catch {}
  return true;
}
// The piano's AudioContext (SPEC §16 AU2): created (when sound is allowed) and asked to resume, so main.mjs can hand it to armUnlock inside the first touch.
export function pianoContext() {
  if (!canSound({silent: SILENT, musicOn: true})) return null;
  initPianoAudio();
  return ctx;
}
function voice(note) {
  let v = voices.get(note);
  if (!v) { v = {els: [], i: 0}; voices.set(note, v); }
  if (v.els.length < 2) {
    const el = new Audio(SAMPLE.get(note)); el.preload = 'auto';
    try { const g = ctx.createGain(); ctx.createMediaElementSource(el).connect(g); g.connect(master); el._gain = g; } catch {}
    try { el.load(); } catch {}
    v.els.push(el); return el;
  }
  v.i = (v.i + 1) % v.els.length; return v.els[v.i];
}
// iOS lets a media element play outside a touch only after it has been played INSIDE one. Called from the first touch: every sample element is
// started silent (its own gain at 0) and stopped at once, so the unicorn's tune and the playback can sound later, from a timer.
function prime(el) {
  if (el._primed || el._priming) return; el._priming = true;
  const g = el._gain; if (g) g.gain.value = 0;
  const back = () => { try { el.pause(); el.currentTime = 0; } catch {} if (g) g.gain.value = 1; };
  // primed ONLY once play() resolved: a play iOS refused (pointerdown may not count as a gesture) stays unprimed and is retried on the next touchend / click
  try { const p = el.play(); if (p && p.then) p.then(() => { el._primed = true; el._priming = false; back(); }, () => { el._priming = false; back(); }); else { el._primed = true; el._priming = false; back(); } } catch { el._priming = false; back(); }
}
// Start loading every sample (call from the first touch, and again when the piano screen opens).
export function warmPiano() {
  if (!canSound({silent: SILENT, musicOn}) || !initPianoAudio()) return;
  for (const n of SAMPLE.keys()) { voice(n); voice(n); }
  for (const v of voices.values()) for (const el of v.els) prime(el);
}
export function playNote(note) {
  if (!canSound({silent: SILENT, musicOn})) return false;
  if (!SAMPLE.has(note) || !initPianoAudio()) return false;
  try { const el = voice(note); el.currentTime = 0; el.play()?.catch?.(() => {}); return true; } catch { return false; }
}
