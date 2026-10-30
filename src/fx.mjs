// Juice: gentle tweens built on the Web Animations API. Nothing here can block play; every helper is safe to skip.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const centre = r => ({x: r.left + r.width / 2, y: r.top + r.height / 2});

// Scale-bounce on tap.
export function bounce(el, amount = 1.14) {
  if (!el || reduce()) return;
  el.animate([{scale: 1}, {scale: amount}, {scale: .96}, {scale: 1}], {duration: 380, easing: 'ease-out'});
}
// Fly a copy of `src` from one element to another (items into the basket / pan). Resolves when it lands.
export function flyTo(fromEl, toEl, src, {ms = 520, size = 84, arc = 90} = {}) {
  return new Promise(done => {
    if (!fromEl || !toEl || reduce()) { done(); return; }
    const a = centre(fromEl.getBoundingClientRect()), b = centre(toEl.getBoundingClientRect());
    const g = document.createElement('img');
    g.src = src; g.className = 'flyer'; g.alt = '';
    Object.assign(g.style, {left: a.x + 'px', top: a.y + 'px', width: size + 'px', height: size + 'px'});
    document.body.append(g);
    const dx = b.x - a.x, dy = b.y - a.y;
    const an = g.animate([
      {transform: 'translate(-50%,-50%) translate(0,0) scale(1.15)'},
      {transform: `translate(-50%,-50%) translate(${dx / 2}px,${dy / 2 - arc}px) scale(1.25)`, offset: .5},
      {transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(.8)`},
    ], {duration: ms, easing: 'cubic-bezier(.3,.1,.4,1)'});
    an.onfinish = () => { g.remove(); done(); };
    an.oncancel = () => { g.remove(); done(); };
  });
}
// Coin dropping from above into place.
export function coinDrop(toEl, src, {ms = 560, size = 70} = {}) {
  return new Promise(done => {
    if (!toEl || reduce()) { done(); return; }
    const b = centre(toEl.getBoundingClientRect());
    const g = document.createElement('img');
    g.src = src; g.className = 'flyer'; g.alt = '';
    Object.assign(g.style, {left: b.x + 'px', top: b.y + 'px', width: size + 'px', height: size + 'px'});
    document.body.append(g);
    const an = g.animate([
      {transform: 'translate(-50%,-50%) translateY(-260px) rotate(-30deg)', opacity: .2},
      {transform: 'translate(-50%,-50%) translateY(10px) rotate(8deg)', opacity: 1, offset: .7},
      {transform: 'translate(-50%,-50%) translateY(-14px)', offset: .85},
      {transform: 'translate(-50%,-50%) translateY(0)'},
    ], {duration: ms, easing: 'ease-in'});
    an.onfinish = () => { g.remove(); done(); };
  });
}
// Star burst at a point (viewport px) or centred on an element.
export function sparkleBurst(at, {n = 16, colors = ['#ffd24d', '#ff9ccf', '#a3e3ff', '#c9a4ff', '#fff'], radius = 150} = {}) {
  if (reduce()) return;
  const p = at instanceof Element ? centre(at.getBoundingClientRect()) : at || {x: innerWidth / 2, y: innerHeight / 2};
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'spark'; s.textContent = '✦';
    const ang = (i / n) * Math.PI * 2 + Math.random() * .4, d = radius * (.6 + Math.random() * .6), sz = 22 + Math.random() * 26;
    Object.assign(s.style, {left: p.x + 'px', top: p.y + 'px', color: colors[i % colors.length], fontSize: sz + 'px'});
    document.body.append(s);
    const a = s.animate([
      {transform: 'translate(-50%,-50%) scale(.2) rotate(0)', opacity: 1},
      {transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(1.2) rotate(140deg)`, opacity: 1, offset: .6},
      {transform: `translate(-50%,-50%) translate(${Math.cos(ang) * d * 1.15}px,${Math.sin(ang) * d * 1.15 + 30}px) scale(.3) rotate(220deg)`, opacity: 0},
    ], {duration: 900 + Math.random() * 300, easing: 'ease-out'});
    a.onfinish = () => s.remove();
  }
}
// Pop an element in from nothing (rewards, stickers).
export function popIn(el, ms = 650) {
  if (!el || reduce()) return;
  el.animate([{scale: .1, opacity: 0}, {scale: 1.25, opacity: 1, offset: .6}, {scale: .94, offset: .8}, {scale: 1}], {duration: ms, easing: 'ease-out'});
}
