// ?silent=1 -> NO sound of any kind: speechSynthesis.speak, HTMLAudioElement/Audio playback and AudioContext are all disabled.
// This module must be the FIRST import of main.mjs so it patches the globals before any other module can touch them.
// Every automated, headless or screenshot run of this app MUST load the page with ?silent=1 (macOS speechSynthesis ignores --mute-audio).
const q = new URLSearchParams(location.search);
export const SILENT = q.has('silent') && q.get('silent') !== '0';
export const said = []; // lines that WOULD have been spoken (read by tools via window.__dg.said)
if (SILENT) {
  try { window.speechSynthesis.speak = () => {}; window.speechSynthesis.cancel = () => {}; } catch {}
  try { HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; } catch {}
  try { window.Audio = function () { const a = document.createElement('audio'); a.preload = 'none'; return a; }; } catch {}
  for (const k of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext', 'webkitOfflineAudioContext']) {
    try { Object.defineProperty(window, k, {value: undefined, configurable: true}); } catch {}
  }
}
