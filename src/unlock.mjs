// iPad audio unlock (SPEC §16 AU1). iOS only lets a WebAudio context make sound once it was created/resumed inside a user gesture, and a
// context created earlier stays "suspended". armUnlock listens for the first touches and, INSIDE each event, asks getContexts() for the
// contexts to wake (so one can be created in the gesture, never before the first event) and resume()s every one that is not running.
// It lets go of the listeners only when at least one context exists and all of them report "running"; with none yet it stays armed.
export function armUnlock(target, getContexts) {
  const EVENTS = ['pointerdown', 'touchend', 'click'];
  let armed = true, fired = 0;
  const disarm = () => { armed = false; for (const e of EVENTS) target.removeEventListener(e, onEvent, true); };
  function onEvent() {
    if (!armed) return;
    fired++;
    let list = [];
    try { list = (getContexts() || []).filter(Boolean); } catch { list = []; }
    for (const c of list) { if (c.state !== 'running') { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch {} } }
    if (list.length && list.every(c => c.state === 'running')) disarm();
  }
  for (const e of EVENTS) target.addEventListener(e, onEvent, true);
  return {fired: () => fired, armed: () => armed};
}
