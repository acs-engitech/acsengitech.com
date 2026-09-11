/* ACS SIGNAL — motion for the pilot experiences. Uses the already-vendored
   GSAP + ScrollTrigger (assets/lab-theme/js/plugins/gsap.min.js,
   rs-scroll-trigger.min.js). No new dependency. Every animated behavior has
   a static, fully-usable fallback and is skipped under reduced-motion. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsapReady = window.gsap && window.ScrollTrigger;
  if (gsapReady) gsap.registerPlugin(ScrollTrigger);

  // ---------- sticky hover/focus media swap (capability + node lists) ----------
  document.querySelectorAll('[data-sg-index]').forEach((index) => {
    const rows = [...index.querySelectorAll('[data-media]')];
    const imgs = [...index.querySelectorAll('img[data-role="frame"]')];
    if (!rows.length || !imgs.length) return;
    const activate = (row) => {
      rows.forEach((r) => r.classList.toggle('is-active', r === row));
      imgs.forEach((img) => img.classList.toggle('is-shown', img.dataset.src === row.dataset.media));
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => activate(row));
      row.addEventListener('focus', () => activate(row));
      row.addEventListener('click', () => activate(row));
    });
  });

  // ---------- count-up (data-count-to on an element; optional data-suffix) ----------
  function runCounters(scope) {
    const els = scope.querySelectorAll('[data-count-to]');
    els.forEach((el) => {
      const target = parseFloat(el.dataset.countTo);
      const suffix = el.dataset.suffix || '';
      const plain = el.dataset.plain === 'true'; // e.g. a year — no thousands separator
      const format = (v) => (plain ? String(Math.round(v)) : Number.isInteger(target) ? Math.round(v).toLocaleString('en-IN') : v.toFixed(1));
      if (reduced || !gsapReady) { el.textContent = format(target) + suffix; return; }
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.6, ease: 'power2.out',
        onUpdate: () => { el.textContent = format(obj.v) + suffix; },
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      });
    });
  }
  runCounters(document);

  // ---------- reduced motion: reveal everything immediately, skip the rest ----------
  if (reduced || !gsapReady) {
    document.querySelectorAll('.sg-reveal').forEach((el) => el.classList.add('is-in'));
    document.querySelectorAll('.sg-mask > *').forEach((el) => { el.style.transform = 'none'; });
    document.querySelectorAll('.sg-hero-mid h1 .sg-line, .sg-svc-hero h1, .sg-prod-body h1').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
    document.querySelectorAll('.sg-chain-line i').forEach((el) => { el.style.transform = 'scaleX(1)'; });
    return;
  }

  // ---------- hero entrance ----------
  document.querySelectorAll('.sg-hero, .sg-svc-hero, .sg-prod-hero').forEach((hero) => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const top = hero.querySelectorAll('.sg-hero-top > *, .sg-prod-top > *');
    const lines = hero.querySelectorAll('.sg-hero-mid h1 .sg-line, .sg-svc-hero h1, .sg-prod-body h1');
    const lead = hero.querySelectorAll('.sg-hero-lead, .sg-svc-hero p, .sg-prod-body p');
    const actions = hero.querySelectorAll('.sg-hero-actions, .sg-hero-mid + *, .sg-prod-body .sg-btn');
    const chain = hero.querySelectorAll('.sg-chain');
    if (top.length) tl.from(top, { opacity: 0, y: -10, duration: .6, stagger: .08 }, 0);
    if (lines.length) tl.to(lines, { opacity: 1, y: 0, duration: .9, stagger: .12, clearProps: 'transform' }, .15);
    if (lead.length) tl.from(lead, { opacity: 0, y: 18, duration: .7 }, .55);
    if (actions.length) tl.from(actions, { opacity: 0, y: 18, duration: .7 }, .68);
    if (chain.length) tl.from(chain, { opacity: 0, y: 14, duration: .6 }, .82);
    // subtle continuous parallax on the media layer while hero is in view
    const media = hero.querySelector('.sg-hero-media img, .sg-svc-hero-media img, .sg-prod-media img');
    if (media) {
      gsap.to(media, {
        scale: 1, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }
  });

  // ---------- chain line draw (hero bottom strip) ----------
  document.querySelectorAll('.sg-chain-line i').forEach((line) => {
    gsap.fromTo(line, { scaleX: 0 }, {
      scaleX: 1, duration: 1.1, ease: 'power2.inOut',
      scrollTrigger: { trigger: line, start: 'top 90%', once: true },
    });
  });

  // ---------- generic scroll reveals ----------
  const revealEls = document.querySelectorAll('.sg-reveal');
  if (revealEls.length) {
    ScrollTrigger.batch(revealEls, {
      start: 'top 88%',
      onEnter: (batch) => batch.forEach((el, i) => gsap.to(el, { opacity: 1, y: 0, duration: .8, delay: i * .05, ease: 'power3.out', onStart: () => el.classList.add('is-in') })),
      once: true,
    });
  }

  // ---------- section headline masks outside hero (system/service/product sections) ----------
  document.querySelectorAll('.sg-system-head .sg-mask, .sg-cap-head .sg-mask, .sg-modules-head .sg-mask').forEach((mask) => {
    gsap.to(mask.querySelectorAll(':scope > *'), {
      yPercent: 0, duration: .9, ease: 'power3.out', stagger: .06,
      scrollTrigger: { trigger: mask, start: 'top 85%', once: true },
    });
  });

  ScrollTrigger.refresh();
})();
