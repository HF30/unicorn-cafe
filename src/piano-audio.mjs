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
function voice(note) {
  let v = voices.get(note);
  if (!v) { v = {els: [], i: 0}; voices.set(note, v); }
  if (v.els.length < 2) {
    const el = new Audio(SAMPLE.get(note)); el.preload = 'auto';
    try { ctx.createMediaElementSource(el).connect(master); } catch {}
    v.els.push(el); return el;
  }
  v.i = (v.i + 1) % v.els.length; return v.els[v.i];
}
// Start loading every sample (call when the piano screen opens, after a tap).
export function warmPiano() {
  if (!canSound({silent: SILENT, musicOn}) || !initPianoAudio()) return;
  for (const n of SAMPLE.keys()) voice(n);
}
export function playNote(note) {
  if (!canSound({silent: SILENT, musicOn})) return false;
  if (!SAMPLE.has(note) || !initPianoAudio()) return false;
  try { const el = voice(note); el.currentTime = 0; el.play()?.catch?.(() => {}); return true; } catch { return false; }
}
