/* ACS CONSOLE — homepage motion.
   Two behaviors:
   1) Pinned hero: as the outer .cn-panel scrolls past, swap annotation SETS
      via opacity (no transform on the pinned layer -> no jitter).
   2) Capability console: hover/focus a row -> hard-swap the sticky media +
      HUD label.
   Uses the vendored GSAP + ScrollTrigger (already loaded elsewhere on the
   site). If GSAP isn't available, hero shows the first annotation set only
   and everything else still works (marquee is CSS-only, hover swap is
   plain JS). Also degrades cleanly under prefers-reduced-motion. */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------ 1. Console hover-swap ------------------ */
  document.querySelectorAll('[data-cn-console]').forEach((console) => {
    const rows = [...console.querySelectorAll('.cn-console-row')];
    const media = console.querySelector('.cn-console-media');
    const imgs = media ? [...media.querySelectorAll('img[data-src]')] : [];
    const title = media ? media.querySelector('.cn-console-hud-title') : null;
    const meta = media ? media.querySelector('.cn-console-hud-meta') : null;
    if (!rows.length || !media) return;
    const activate = (row) => {
      rows.forEach((r) => r.classList.toggle('is-active', r === row));
      const src = row.getAttribute('data-media');
      imgs.forEach((img) => img.classList.toggle('is-shown', img.dataset.src === src));
      if (title) title.textContent = row.getAttribute('data-title') || '';
      // data-meta contains author-controlled markup (a couple of <b> tags for
      // emphasis). Any future value here MUST be authored in this file, never
      // user-supplied — no admin/CMS path should reach this attribute.
      if (meta) meta.innerHTML = row.getAttribute('data-meta') || '';
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => activate(row));
      row.addEventListener('focusin', () => activate(row));
      row.addEventListener('click', () => activate(row));
    });
  });

  /* ------------------ 2. Header height sync + shrink-on-scroll ------------------
     Measure the real header height (topbar + primary bar) and expose it as
     --cn-hdr on the body, so the pinned hero can size itself to the exact
     remaining viewport. Re-measure on resize. */
  const topbar = document.querySelector('.cn-topbar');
  const header = document.querySelector('.cn-header');
  function syncHeader() {
    if (!header) return;
    // Only the sticky header covers the top after any scroll. The topbar
    // scrolls away in normal flow, so it's NOT part of the reserved offset.
    const hdr = header.getBoundingClientRect().height;
    document.body.style.setProperty('--cn-hdr', Math.round(hdr) + 'px');
  }
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncHeader);
    syncHeader();
    onScroll();
  }

  /* ------------------ 3. Mobile menu (accessible) ------------------ */
  const hamburger = document.querySelector('.cn-hamburger');
  const nav = document.querySelector('.cn-nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
  }

  /* ------------------ 4. Pinned hero annotation swap ------------------ */
  function initPinnedHero() {
    const wrap = document.querySelector('.cn-panel');
    const stick = wrap ? wrap.querySelector('.cn-panel-stick') : null;
    if (!wrap || !stick) return;
    const sets = [...wrap.querySelectorAll('.cn-anno-set')];
    const progressFill = wrap.querySelector('.cn-panel-progress-fill');
    const progressLabel = wrap.querySelector('.cn-panel-progress-label');
    if (!sets.length) return;

    // Reduced motion / no-JS-side fallback: show first set only, done
    if (reduced || !window.gsap || !window.ScrollTrigger) {
      sets[0].classList.add('is-in');
      return;
    }

    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    sets[0].classList.add('is-in');
    if (progressFill) progressFill.style.width = (100 / sets.length) + '%';
    if (progressLabel) progressLabel.textContent = '01 / 0' + sets.length;

    window.ScrollTrigger.create({
      trigger: wrap,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        // divide progress into equal segments per set
        const idx = Math.min(sets.length - 1, Math.floor(self.progress * sets.length));
        sets.forEach((s, i) => s.classList.toggle('is-in', i === idx));
        if (progressFill) progressFill.style.width = ((idx + 1) / sets.length) * 100 + '%';
        if (progressLabel) progressLabel.textContent = '0' + (idx + 1) + ' / 0' + sets.length;
      },
    });
  }

  // Wait for GSAP if the shared bundle is still loading (defer scripts don't guarantee order across pages)
  let waited = 0;
  (function waitReady() {
    if (window.gsap && window.ScrollTrigger) return initPinnedHero();
    waited += 60;
    if (waited > 1500) return initPinnedHero(); // fall back
    setTimeout(waitReady, 60);
  })();
})();
