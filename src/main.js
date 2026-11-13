import { config } from './config.js';
import { initRibbonVideo } from './ribbon-video.js';
import { initHeroFlow } from './hero-flow.js';
import { initBubbles } from './bubbles.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Nav ---------- */
const nav = $('#nav');
const toggle = $('#nav-toggle');
let lastY = window.scrollY;
const onScroll = () => {
  const y = window.scrollY;
  nav.classList.toggle('is-scrolled', y > 40);
  // Hide on the way down, bring back on the way up.
  if (Math.abs(y - lastY) > 6) {
    nav.classList.toggle('is-hidden', y > lastY && y > 200);
    lastY = y;
  }
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const setMenu = (open) => {
  nav.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
};
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
$$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
window.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

// Mark the nav link of the section in view.
const links = new Map($$('.nav__links a').map((a) => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    const a = links.get(e.target.id);
    if (!a) return;
    if (e.isIntersecting) {
      links.forEach((l) => l.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');
    }
  }),
  { rootMargin: '-45% 0px -45% 0px' },
);
links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

/* ---------- Booking + social links ---------- */
$$('[data-book]').forEach((a) => {
  if (config.bookingUrl) { a.href = config.bookingUrl; a.target = '_blank'; a.rel = 'noopener'; }
  else a.href = '#contact-form';
});
$$('[data-social]').forEach((a) => {
  const url = config.social[a.dataset.social];
  if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
  else {
    a.title = 'Link coming soon';
    a.setAttribute('aria-disabled', 'true');
    a.addEventListener('click', (e) => e.preventDefault());
  }
});
$('#year').textContent = new Date().getFullYear();

/* ---------- Work gallery ---------- */
$$('[data-gallery]').forEach((g) => {
  const track = $('.gallery__track', g);
  const [prev, next] = $$('.gallery__nav button', g);
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    g.classList.toggle('is-scrollable', max > 4);
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  };
  const step = (dir) => {
    const card = $('.project', track);
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: 'smooth' });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  track.addEventListener('scroll', update, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  new ResizeObserver(update).observe(track);
  update();
});

/* ---------- Automation flow ---------- */
// DRAFT copy for the stage details (written by Claude, pending Sebastian's approval).
const stages = {
  lead: ['Lead', 'Someone reaches out: a form, a message, a call.'],
  agent: ['AI Agent', 'Reads the inquiry, answers the first questions and decides what happens next.'],
  crm: ['CRM', 'Saves the contact and the conversation, so nothing gets lost.'],
  followup: ['Follow-up', 'Sends the next message at the right time, written for that person.'],
  onboarding: ['Onboarding', 'Welcomes the new customer and walks them through the first steps.'],
};
$$('[data-flow]').forEach((flow) => {
  const detail = $('[data-flow-detail]');
  const buttons = $$('.stage', flow);
  const select = (btn) => {
    buttons.forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    });
    const [title, text] = stages[btn.dataset.stage];
    detail.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = title;
    detail.append(b, text);
  };
  buttons.forEach((b) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('mouseenter', () => select(b));
    b.addEventListener('focus', () => select(b));
  });
  select($('.stage.is-active', flow) || buttons[0]);
});

/* ---------- Process ---------- */
$$('[data-process]').forEach((p) => {
  const navBtns = $$('.process__nav button', p);
  const cards = $$('.step', p);
  const select = (i) => {
    navBtns.forEach((b) => b.classList.toggle('is-active', +b.dataset.step === i));
    cards.forEach((c) => c.classList.toggle('is-active', +c.dataset.step === i));
  };
  navBtns.forEach((b) => {
    b.addEventListener('click', () => select(+b.dataset.step));
    b.addEventListener('mouseenter', () => select(+b.dataset.step));
    b.addEventListener('focus', () => select(+b.dataset.step));
  });
  cards.forEach((c) => c.addEventListener('mouseenter', () => select(+c.dataset.step)));
});

/* ---------- Contact form ---------- */
const form = $('#contact-form');
const note = $('#form-note');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fields = $$('input, textarea', form);
  let firstBad = null;
  fields.forEach((f) => {
    const bad = !f.checkValidity();
    f.classList.toggle('is-invalid', bad);
    f.setAttribute('aria-invalid', String(bad));
    if (bad && !firstBad) firstBad = f;
  });
  if (firstBad) {
    note.textContent = 'Please fill in your name, a valid email and a short message.';
    firstBad.focus();
    return;
  }
  if (!config.contactEndpoint) {
    // INTEGRATION POINT: set contactEndpoint in src/config.js.
    note.textContent = 'This form isn’t connected yet, so nothing was sent.';
    return;
  }
  note.textContent = 'Sending…';
  try {
    const res = await fetch(config.contactEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    if (!res.ok) throw new Error(String(res.status));
    form.reset();
    note.textContent = 'Got it. We’ll get back to you soon.';
  } catch {
    note.textContent = 'That didn’t go through. Please try again in a moment.';
  }
});

/* ---------- Scroll reveal ---------- */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce) {
  const targets = $$('.work__intro, .project, .services__head, .service, .automation__head, .flow li, .process__head, .step, .about__copy, .contact__head, .form');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }),
    { rootMargin: '0px 0px -8% 0px' },
  );
  targets.forEach((t, i) => {
    t.classList.add('reveal');
    const sibs = t.parentElement ? [...t.parentElement.children].indexOf(t) : 0;
    t.style.transitionDelay = `${Math.min(sibs, 5) * 70}ms`;
    io.observe(t);
  });
}

/* ---------- Scroll lift ---------- */
// Scrolling down makes everything in the hero rise faster for a moment, then it settles.
const lift = { value: 0, lastY: window.scrollY, lastT: performance.now() };
const liftNow = () => {
  const now = performance.now();
  lift.value *= Math.exp(-(now - lift.lastT) / 1000 * 1.6);
  lift.lastT = now;
  return lift.value;
};
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  liftNow();
  if (y > lift.lastY) lift.value = Math.min(7, lift.value + (y - lift.lastY) * 0.03);
  lift.lastY = y;
}, { passive: true });

/* ---------- Live ribbon ---------- */
// The filmed ribbon runs behind every section below the hero. The hero keeps its painted ribbon.
// How much of it shows depends on the section: full where there is little to read,
// pulled back to the edge where people read or click, gone over the About painting.
const RIBBON_LOOK = {
  top:        { alpha: 1,    x: 0.77, size: 1.3 },
  work:       { alpha: 0.6,  x: 0.9,  size: 1.15 },
  services:   { alpha: 0.5,  x: 0.94, size: 1.1 },
  automation: { alpha: 0.5,  x: 0.94, size: 1.1 },
  process:    { alpha: 0.5,  x: 0.94, size: 1.1 },
  about:      { alpha: 0,    x: 0.94, size: 1.1 },
  contact:    { alpha: 1,    x: 0.8,  size: 1.4 },
};
const ribbonCanvas = $('#ribbon');
const ribbon = initRibbonVideo(ribbonCanvas);
if (ribbon) {
  window.__ribbon = ribbon;
  document.documentElement.classList.add('live-ribbon');
  const hero = $('#top');
  const narrow = window.matchMedia('(max-width: 1000px)');
  const zones = Object.keys(RIBBON_LOOK).map((id) => ({ el: document.getElementById(id), look: RIBBON_LOOK[id] })).filter((z) => z.el);
  // Measured once (and on resize), not on every scroll tick.
  let heroBottom = 0;
  const measure = () => {
    heroBottom = hero.offsetTop + hero.offsetHeight;
    for (const z of zones) { z.top = z.el.offsetTop; z.bottom = z.top + z.el.offsetHeight; }
    fade();
  };
  // The look to aim for: each section counts by how much of the screen it fills right now.
  const goal = { alpha: 1, x: 0.77, size: 1.3 };
  const aim = () => {
    const y0 = window.scrollY, y1 = y0 + window.innerHeight;
    let sum = 0, a = 0, x = 0, size = 0;
    for (const z of zones) {
      const w = Math.max(0, Math.min(y1, z.bottom) - Math.max(y0, z.top));
      sum += w; a += w * z.look.alpha; x += w * z.look.x; size += w * z.look.size;
    }
    if (sum > 0) { goal.alpha = a / sum; goal.x = x / sum; goal.size = size / sum; }
  };
  const fade = () => {
    // The ribbon rises softly out of the hero's bottom edge instead of crossing the painted scene.
    const top = heroBottom - window.scrollY;
    // While the hero still fills the screen the ribbon is invisible, so it doesn't draw at all.
    ribbon.state.hidden = top - 30 >= window.innerHeight;
    const mask = top > -150 ? `linear-gradient(to bottom, transparent ${top - 30}px, #000 ${top + 150}px)` : 'none';
    ribbonCanvas.style.maskImage = mask;
    ribbonCanvas.style.webkitMaskImage = mask;
    ribbonCanvas.style.opacity = narrow.matches ? '0.9' : '1';
    aim();
  };
  // Ease toward the goal a little every frame, so the ribbon glides between looks.
  let lastT = performance.now();
  const glide = (now) => {
    const k = 1 - Math.exp(-Math.min(0.05, (now - lastT) / 1000) * 3.5);
    lastT = now;
    const st = ribbon.state;
    // A phone has no empty side to park it in: keep it a slim, fainter strip on the right edge.
    st.squeeze = narrow.matches ? 0.5 : 1;
    st.xNarrow = 0.98;
    st.alpha += ((narrow.matches ? goal.alpha * 0.6 : goal.alpha) - st.alpha) * k;
    st.x += (goal.x - st.x) * k;
    st.size += (goal.size - st.size) * k;
    requestAnimationFrame(glide);
  };
  measure();
  Object.assign(ribbon.state, goal);
  ribbon.state.sway = 0.025;   // only a slight weave; each section sets where it sits
  requestAnimationFrame(glide);
  window.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);
}

/* ---------- Hero: the painted ribbon flows, the bubbles rise ---------- */
// Same approved image, drawn on a canvas so the ribbon's surface can move.
// If it can't run (or the visitor prefers no motion) the still image stays, bubbles and all.
const heroNarrow = window.matchMedia('(max-width: 1000px)');
window.__heroFlow = initHeroFlow($('#hero-flow'), '/art/hero.webp', {
  posX: () => (heroNarrow.matches ? 0.64 : 0.5),
  boost: liftNow,
  onReady: (flow) => { window.__bubbles = initBubbles($('#hero-bubbles'), flow, '/art/hero.webp', { boost: liftNow }); },
});