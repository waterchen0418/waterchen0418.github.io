/* =============================================
   Google Analytics 4 — G-CWRES636M4
   Loaded on every page. Auto page_view + custom
   click events (CV, projects, contact, language,
   protected unlock).
   ============================================= */
(function () {
  var GA_ID = 'G-CWRES636M4';

  // ---- gtag loader ----
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);

  function track(name, params) {
    try { gtag('event', name, params || {}); } catch (e) {}
  }
  window.trackEvent = track; // let inline page scripts fire events too

  // ---- click events ----
  function bind() {
    // CV download (EN or 中 resume)
    document.querySelectorAll('a[href*="resume-sharonchen"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track('cv_download', { lang: /-ch\.pdf/.test(a.getAttribute('href')) ? 'zh' : 'en', page: location.pathname });
      });
    });

    // Project / case-study clicks
    document.querySelectorAll('.work-card a[href], .work-card__link').forEach(function (a) {
      a.addEventListener('click', function () {
        var card = a.closest('.work-card');
        var title = card && card.querySelector('.work-card__title');
        track('project_click', {
          project: (title ? title.textContent : a.getAttribute('href') || '').trim().replace('🔒', '').trim()
        });
      });
    });

    // Contact buttons (Say Hello / LinkedIn / Behance)
    document.querySelectorAll('.contact__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        track('contact_click', { method: a.textContent.trim(), href: a.getAttribute('href') });
      });
    });

    // Language switch
    document.querySelectorAll('.lang-switch__opt').forEach(function (b) {
      b.addEventListener('click', function () {
        track('language_switch', { lang: b.dataset.lang });
      });
    });
  }

  if (document.readyState !== 'loading') bind();
  else document.addEventListener('DOMContentLoaded', bind);
})();
