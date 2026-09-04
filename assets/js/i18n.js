/* =============================================
   LANGUAGE SWITCH (EN default / 中文)
   - English lives in the DOM as default text.
   - Chinese is stored per-element in data-zh.
   - Choice persists in localStorage across pages.
   ============================================= */
(function () {
  const STORAGE_KEY = 'lang';
  const swappables = Array.from(document.querySelectorAll('[data-zh]'));

  // Snapshot the original English once.
  swappables.forEach(el => { el.dataset.en = el.innerHTML.trim(); });

  // Links whose href differs by language (e.g. EN / 中 CV). Snapshot the EN href.
  const hrefSwappables = Array.from(document.querySelectorAll('[data-href-zh]'));
  hrefSwappables.forEach(el => { el.dataset.hrefEn = el.getAttribute('href'); });

  const btn      = document.getElementById('langBtn');
  const menu     = document.getElementById('langMenu');
  const current  = document.getElementById('langCurrent');
  const wrap     = document.getElementById('langSwitch');

  function applyLang(lang) {
    const zh = lang === 'zh';
    swappables.forEach(el => {
      el.innerHTML = zh ? el.dataset.zh : el.dataset.en;
    });
    hrefSwappables.forEach(el => {
      el.setAttribute('href', zh ? el.dataset.hrefZh : el.dataset.hrefEn);
    });
    document.documentElement.lang = zh ? 'zh-Hant' : 'en';
    if (current) current.textContent = zh ? '中' : 'EN';
    if (menu) {
      menu.querySelectorAll('.lang-switch__opt').forEach(opt => {
        opt.setAttribute('aria-selected', String(opt.dataset.lang === lang));
      });
    }
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function openMenu(open) {
    if (!wrap || !btn) return;
    wrap.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  }

  // Wire the dropdown (guard in case a page has no switcher)
  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(!wrap.classList.contains('is-open'));
    });
    menu.querySelectorAll('.lang-switch__opt').forEach(opt => {
      opt.addEventListener('click', () => {
        applyLang(opt.dataset.lang);
        openMenu(false);
      });
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) openMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') openMenu(false);
    });
  }

  // Initial language (default English)
  let saved = 'en';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) {}
  applyLang(saved);
})();
