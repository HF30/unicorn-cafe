// The ONE place that makes the game talk: speak(lineId, text).
//  1. if the line is recorded -> play the recording(s): a line is either its own clip app/audio/voice/<lineId>.mp3 (manifest.ids)
//     or a SEQUENCE of short clips (manifest.seq[lineId] = [clipId,...], e.g. "We need" + "three" + "buns");
//  2. otherwise fall back to on-device speechSynthesis.
// speakSeq([[id,text],...]) says several lines one after another (recordings chain; if any part has no recording the joined text is spoken instead).
// ?silent=1 (see silent.mjs) turns ALL of it off.
import manifest from '../audio/voice/manifest.json' with {type: 'json'};
import {SILENT, said} from './silent.mjs';
export {SILENT};
const HAVE = new Set(manifest.ids || []);
let awaitingVoice = false, lastLines = null, current = null, gen = 0;
const SEQ = manifest.seq || {};
// the clip ids that say a line, or null if any part has no recording
export function clipsFor(id) {
  const parts = SEQ[id] || [id];
  return parts.every(p => HAVE.has(p)) ? parts : null;
}
export const hasRecording = id => clipsFor(id) !== null;

function stop() {
  gen++;
  if (current) { try { current.pause(); } catch {} current = null; }
  if (!SILENT && 'speechSynthesis' in window) speechSynthesis.cancel();
}
function tts(text) {
  if (SILENT || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = .8;
  const local = speechSynthesis.getVoices().find(v => v.localService && v.lang.startsWith('en'));
  if (local) { u.voice = local; awaitingVoice = false; } else { awaitingVoice = true; return; }
  speechSynthesis.speak(u);
}
function playChain(ids, g) {
  // build every element up front so the next clip is already loaded when the last one ends (tight gaps)
  const els = ids.map(id => { const a = new Audio(`audio/voice/${id}.mp3`); a.preload = 'auto'; return a; });
  const next = i => {
    if (g !== gen || i >= ids.length) { if (g === gen) current = null; return; }
    const a = els[i];
    current = a;
    a.onended = () => next(i + 1);
    a.onerror = () => next(i + 1);
    a.play()?.catch?.(() => next(i + 1));
  };
  next(0);
}
export function speakSeq(lines) {
  lastLines = lines;
  for (const [id, text] of lines) said.push({id, text});
  stop();
  if (SILENT) return;
  const clips = lines.map(([id]) => clipsFor(id));
  if (clips.every(Boolean)) playChain(clips.flat(), gen);
  else tts(lines.map(l => l[1]).join(' '));
}
export const speak = (lineId, text) => speakSeq([[lineId, text]]);
export const repeatLast = () => { if (lastLines) speakSeq(lastLines); };
// iOS needs a speak() inside the first gesture before later speech is allowed.
export function unlockVoice() { if (!SILENT && 'speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance('')); }
// Safari may populate installed voices after first render.
if (!SILENT && 'speechSynthesis' in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', () => { if (awaitingVoice && lastLines) speakSeq(lastLines); });
}
