// Sound: CC0 Kenney SFX (app/audio/*.mp3, see assets3d/LICENSES.md) + a soft generated music bed (WebAudio, no file).
// iOS only starts audio after a gesture, so unlock() is called from the first tap. Music respects the on/off toggle.
import {SILENT} from './silent.mjs';
const files = {tap: 'tap', select: 'select', coin: 'coin', plop: 'plop', sparkle: 'sparkle', cheer: 'cheer', bell: 'bell', back: 'back', sizzle: 'sizzle'};
const pool = {};
const gain = {tap: .5, select: .5, coin: .8, plop: .7, sparkle: .7, cheer: .8, bell: .35, back: .5, sizzle: .5};
let ctx = null, master = null, musicOn = true, unlocked = false, timer = null, step = 0, nextAt = 0;

function load(name) {
  if (!pool[name]) { const a = new Audio(`audio/${files[name]}.mp3`); a.preload = 'auto'; pool[name] = a; }
  return pool[name];
}
export function preload() { if (SILENT) return; for (const n of Object.keys(files)) load(n); }
export function sfx(name, {rate = 1, delay = 0} = {}) {
  if (SILENT || !files[name]) return;
  const go = () => { try { const a = load(name).cloneNode(); a.volume = gain[name] ?? .6; a.playbackRate = rate; const p = a.play(); p?.catch?.(() => {}); } catch {} };
  delay ? setTimeout(go, delay) : go();
}
export const cheer = () => { sfx('cheer'); sfx('sparkle', {delay: 120, rate: 1.2}); sfx('bell', {delay: 260}); sfx('cheer', {delay: 380, rate: 1.25}); };
export const coin = () => sfx('coin', {rate: .95 + Math.random() * .15});

// ---- music bed: slow music-box pentatonic loop (C major pentatonic), soft sine+triangle voices ----
const SCALE = [0, 2, 4, 7, 9]; // degrees of C major pentatonic
const TUNE = [4, 2, 3, 1, 2, 0, 1, -1, 4, 2, 3, 5, 4, 3, 2, 0, 2, 3, 4, 2, 1, 0, 1, 2, 3, 1, 2, 0, -1, 0, 1, 0];
const BASS = [0, -5, 2, -3, 0, -5, 4, 2]; // semitones from C3-ish, one per 4 steps
const note = (deg) => 60 + 12 * Math.floor(deg / 5) + SCALE[((deg % 5) + 5) % 5];
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
function pluck(t, f, dur, vol, type = 'sine') {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function schedule() {
  if (!ctx || !musicOn) return;
  const beat = 60 / 76 / 2; // eighth notes at 76 bpm
  while (nextAt < ctx.currentTime + .6) {
    const i = step % TUNE.length;
    if (i % 2 === 0 || i % 4 === 3) pluck(nextAt, freq(note(TUNE[i])), 1.1, .5, 'triangle');
    if (i % 4 === 0) pluck(nextAt, freq(48 + BASS[(i / 4) % BASS.length]), 1.6, .5, 'sine');
    nextAt += beat; step++;
  }
}
export function unlock() {
  if (SILENT) return; // ?silent=1: never create an AudioContext
  if (unlocked) { if (ctx?.state === 'suspended') ctx.resume(); return; }
  unlocked = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(ctx.destination); master.disconnect(); master.connect(lp);
    ctx.resume?.();
    nextAt = ctx.currentTime + .1;
    timer = setInterval(schedule, 200);
    applyMusic();
  } catch {}
  preload();
}
function applyMusic() {
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.linearRampToValueAtTime(musicOn ? .09 : 0, ctx.currentTime + .4);
  if (musicOn) { if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + .05; ctx.resume?.(); }
}
export function setMusic(on) { musicOn = !!on; applyMusic(); }
export const isMusicOn = () => musicOn;
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend?.(); else if (musicOn) ctx.resume?.(); });
export const _state = () => ({unlocked, musicOn, ctx: ctx?.state || null, playing: !!timer});
