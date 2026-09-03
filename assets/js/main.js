/* =============================================
   SCROLL STORYTELLING — HERO
   Approach: video autoplays freely, scroll drives
   CSS zoom/pan via data-chapter attribute.
   ============================================= */

const heroScroll  = document.getElementById('hero');
const heroVideo   = document.getElementById('heroVideo');
const heroOverlay = document.getElementById('heroOverlay');
const progressBar = document.getElementById('heroProgressBar');
const chapterFill = document.getElementById('chapterFill');
const navItems    = document.querySelectorAll('.chapter-nav__item');

const panels = [
  document.getElementById('panelIntro'),
  document.getElementById('panel01'),
  document.getElementById('panel02'),
  document.getElementById('panel03'),
];

// Panel fade zones (fraction of total hero scroll 0→1)
const PANEL_RANGES = [
  { in: -0.06, out: 0.22 },  // intro
  { in:  0.16, out: 0.46 },  // creativity
  { in:  0.40, out: 0.72 },  // data analysis
  { in:  0.66, out: 1.06 },  // design output
];
const FADE = 0.06;

function getPanelOpacity(i, p) {
  const { in: s, out: e } = PANEL_RANGES[i];
  const fi = Math.min(1, (p - s) / FADE);
  const fo = Math.min(1, (e - p) / FADE);
  return Math.max(0, Math.min(fi, fo));
}

function getActiveChapter(p) {
  let best = 0, bestOp = 0;
  PANEL_RANGES.forEach((_, i) => {
    const op = getPanelOpacity(i, p);
    if (op > bestOp) { bestOp = op; best = i; }
  });
  return best;
}

function getScrollProgress() {
  const top   = heroScroll.offsetTop;
  const total = heroScroll.offsetHeight - window.innerHeight;
  return Math.max(0, Math.min(1, (window.scrollY - top) / total));
}

// ---- Zoom out → in state ----
let lastChapter      = -1;
let lastVideoChapter = -1;
let zoomTimer        = null;

function triggerZoom(chapter) {
  if (chapter === lastVideoChapter) return;
  const isFirstLoad = lastVideoChapter === -1;
  lastVideoChapter = chapter;

  // Clear any pending zoom
  if (zoomTimer) { clearTimeout(zoomTimer); zoomTimer = null; }

  if (isFirstLoad || chapter === 0) {
    // No zoom-out step on first load or returning to intro
    heroVideo.dataset.chapter = chapter === 0 ? '' : String(chapter);
  } else {
    // Step 1: zoom out to neutral
    heroVideo.dataset.chapter = '';
    // Step 2: after zoom-out completes, zoom into new chapter
    zoomTimer = setTimeout(() => {
      heroVideo.dataset.chapter = String(chapter);
      zoomTimer = null;
    }, 780); // matches transition duration
  }
}

function tick() {
  const progress = getScrollProgress();
  const chapter  = getActiveChapter(progress);

  // Progress bar
  progressBar.style.width = (progress * 100) + '%';
  const fillPct = chapter === 0 ? 0 : ((chapter - 1) / 2) * 100;
  chapterFill.style.width = fillPct + '%';

  // Panel opacities (scroll-driven, no CSS transition)
  panels.forEach((panel, i) => {
    const op = getPanelOpacity(i, progress);
    panel.style.opacity = op;
    panel.style.transform = `translateY(${-50 + (1 - op) * 3}%)`;
    panel.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
  });

  // Chapter change → trigger zoom-out → zoom-in
  if (chapter !== lastChapter) {
    lastChapter = chapter;
    triggerZoom(chapter);
    heroOverlay.dataset.chapter = chapter === 0 ? '' : String(chapter);
    navItems.forEach((el, i) => el.classList.toggle('is-active', i === chapter));
  }

  requestAnimationFrame(tick);
}

// Init
tick();
window.addEventListener('scroll', tick, { passive: true });

// Dot click → scroll to chapter
document.querySelectorAll('.chapter-nav__dot').forEach((dot, i) => {
  dot.addEventListener('click', () => {
    const top   = heroScroll.offsetTop;
    const total = heroScroll.offsetHeight - window.innerHeight;
    const t     = i === 0 ? 0 : PANEL_RANGES[i].in + FADE + 0.01;
    window.scrollTo({ top: top + t * total, behavior: 'smooth' });
  });
});

/* =============================================
   NAV
   ============================================= */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* =============================================
   SCROLL-REVEAL (below hero)
   ============================================= */
const revealEls = document.querySelectorAll(
  '.about__left, .about__right, .works__header, .work-card, .process__step, .contact__inner'
);
revealEls.forEach((el, i) => {
  el.classList.add('reveal');
  if (i % 3 === 1) el.classList.add('reveal-delay-1');
  if (i % 3 === 2) el.classList.add('reveal-delay-2');
});
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach(el => revealObserver.observe(el));

/* =============================================
   ANCHOR SMOOTH SCROLL
   ============================================= */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});
