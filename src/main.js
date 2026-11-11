import { config } from './config.js';
import { initRibbon } from './ribbon.js';
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
// Runs behind every section below the hero and flows upward. The hero keeps its painted ribbon.
const ribbonCanvas = $('#ribbon');
const ribbon = initRibbon(ribbonCanvas);
if (ribbon) {
  window.__ribbon = ribbon;
  document.documentElement.classList.add('live-ribbon');
  const hero = $('#top');
  const narrow = window.matchMedia('(max-width: 1000px)');
  const fade = () => {
    // The ribbon rises softly out of the hero's bottom edge instead of crossing the painted scene.
    const top = hero.offsetTop + hero.offsetHeight - window.scrollY;
    const mask = top > -150 ? `linear-gradient(to bottom, transparent ${top - 30}px, #000 ${top + 150}px)` : 'none';
    ribbonCanvas.style.maskImage = mask;
    ribbonCanvas.style.webkitMaskImage = mask;
    ribbonCanvas.style.opacity = narrow.matches ? '0.9' : '1';
  };
  fade();
  window.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('resize', fade);
  new ResizeObserver(fade).observe(hero);
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