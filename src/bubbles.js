// Real floating bubbles for the hero. Each one is a round window onto the painted
// bubble in the approved image, so it looks exactly like the art, but it rises,
// sways, pops at the top (or when clicked) and is born again near the mountains.

import { IMG_W, IMG_H, PAINTED_BUBBLES } from './hero-flow.js';

const KID = { x0: 840, x1: 1020 }; // new bubbles never start in front of the kid

export function initBubbles(layer, flow, src, { boost = () => 0 } = {}) {
  const bubbles = PAINTED_BUBBLES.map((spec, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bubble';
    el.setAttribute('aria-label', 'Pop bubble');
    el.tabIndex = -1;
    const skin = document.createElement('span');
    skin.className = 'bubble__skin';
    skin.style.backgroundImage = `url('${src}')`;
    el.append(skin);
    layer.append(el);
    const b = {
      el, skin, spec,
      x: spec.x, y: spec.y, r: spec.r,
      speed: 6 + 420 / spec.r,           // image px per second: small ones climb faster
      phase: i * 1.7, age: 10, popping: 0,
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); pop(b); });
    return b;
  });

  let fit = flow.fit();
  const layout = () => {
    fit = flow.fit();
    for (const b of bubbles) {
      const d = b.r * 2 * fit.s;
      b.el.style.width = b.el.style.height = `${d}px`;
      // Show the painted bubble (and only it) inside the round window.
      const k = d / (b.spec.r * 2);
      b.skin.style.backgroundSize = `${IMG_W * k}px ${IMG_H * k}px`;
      b.skin.style.backgroundPosition = `${-(b.spec.x - b.spec.r) * k}px ${-(b.spec.y - b.spec.r) * k}px`;
    }
  };
  new ResizeObserver(layout).observe(layer);
  layout();

  function pop(b) {
    if (b.popping) return;
    b.popping = 0.001;
    b.el.classList.add('is-popping');
  }
  function respawn(b) {
    do { b.x = 60 + Math.random() * (IMG_W - 120); } while (b.x > KID.x0 && b.x < KID.x1);
    b.y = 770 + Math.random() * 40;      // just behind the mountain line
    b.age = 0;
    b.popping = 0;
    b.el.classList.remove('is-popping');
  }

  let clock = 0;
  const tick = (dt) => {
    clock += dt;
    const lift = 1 + boost();
    for (const b of bubbles) {
      if (b.popping) {
        b.popping += dt;
        if (b.popping > 0.32) respawn(b);
      } else {
        b.y -= b.speed * lift * dt;
        b.age += dt;
        if (b.y < b.r * 0.7) pop(b);     // reached the top of the sky
      }
      const sway = Math.sin(clock * 0.55 + b.phase) * (8 + b.r * 0.12);
      const sx = (b.x + sway - b.r - fit.ox) * fit.s;
      const sy = (b.y - b.r - fit.oy) * fit.s;
      const grow = Math.min(1, b.age / 1.4);                       // new bubbles swell into view
      const wobble = 1 + 0.025 * Math.sin(clock * 1.3 + b.phase * 2);
      b.el.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(${(0.35 + 0.65 * grow) * wobble}, ${(0.35 + 0.65 * grow) / wobble})`;
      b.el.style.opacity = String(grow);
    }
  };

  let raf = 0;
  let visible = true;
  let last = performance.now();
  const loop = (now) => {
    tick(Math.min((now - last) / 1000, 0.05));
    last = now;
    raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(layer);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  tick(0);
  start();

  return { bubbles, tick, pop };
}
