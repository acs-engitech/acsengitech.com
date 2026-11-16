(() => {
  'use strict';
  document.documentElement.classList.add('has-js');
  const nav = document.getElementById('main-navigation');
  const menu = document.querySelector('.menu-toggle');
  const groups = [...document.querySelectorAll('.nav-group')];
  const mobileNav = matchMedia('(max-width: 1023px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const journey = document.getElementById('system-journey');
  const chapters = [...document.querySelectorAll('[data-journey-chapter]')];
  const mapLinks = [...document.querySelectorAll('.journey-map a')];
  const hotspot = document.querySelector('.model-hotspot');
  const description = document.getElementById('hotspot-description');
  const fallback = document.querySelector('.scene-fallback');
  const caption = document.querySelector('.scene-caption');
  const controls = document.querySelector('.scene-controls');
  let engine, stageData, current = -1, frame = 0, positions = [], visible = true, bootVersion = 0;
  const wire = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wire.classList.add('annotation-wire'); wire.setAttribute('aria-hidden', 'true');
  wire.innerHTML = '<path/><circle r="3"/>';
  document.querySelector('.scene-sticky').insertBefore(wire, document.querySelector('.scene-annotations'));
  function projectAnnotation(point) {
    wire.style.visibility = point ? 'visible' : 'hidden';
    if (!point) return;
    const mount = document.getElementById('scene-mount').getBoundingClientRect();
    const scene = document.querySelector('.scene-sticky').getBoundingClientRect();
    const dot = document.querySelector('.hotspot-dot').getBoundingClientRect();
    const x = point.x + mount.left - scene.left, y = point.y + mount.top - scene.top;
    const endX = dot.left - scene.left + dot.width / 2, endY = dot.top - scene.top + dot.height / 2;
    wire.firstElementChild.setAttribute('d', `M${x} ${y} L${endX - 24} ${endY} H${endX}`);
    wire.lastElementChild.setAttribute('cx', x); wire.lastElementChild.setAttribute('cy', y);
  }

  function setMenu(open, focus = false) {
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.title = open ? 'Close menu' : 'Open menu';
    menu.firstElementChild.className = open ? 'ri-close-line' : 'ri-menu-line';
    if (!open) groups.forEach(group => { group.open = false; });
    if (focus) menu.focus();
  }
  menu.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  groups.forEach(group => {
    group.addEventListener('toggle', () => {
      group.querySelector('summary').setAttribute('aria-expanded', String(group.open));
      if (group.open) groups.forEach(other => { if (other !== group) other.open = false; });
    });
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) setMenu(false);
    if (!event.target.closest('.scene-annotations')) closeHotspot();
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const open = groups.find(group => group.open);
      if (open) { open.open = false; open.querySelector('summary').focus(); }
      else if (nav.classList.contains('is-open')) setMenu(false, true);
      closeHotspot();
    }
    if (event.key === 'Tab' && mobileNav.matches && nav.classList.contains('is-open')) {
      const items = [...document.querySelectorAll('.site-header a,.site-header summary,.menu-toggle')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobileNav.addEventListener('change', () => setMenu(false));
  document.querySelectorAll('.capability-row').forEach(row => {
    const show = () => {
      const photo = document.getElementById('capability-photo');
      photo.src = row.dataset.media;
      photo.alt = row.dataset.caption;
      document.getElementById('capability-caption').textContent = row.dataset.caption;
    };
    row.addEventListener('mouseenter', show);
    row.addEventListener('focus', show);
  });
  function closeHotspot() { hotspot.setAttribute('aria-expanded', 'false'); description.hidden = true; }
  hotspot.addEventListener('click', () => {
    description.hidden = !description.hidden;
    hotspot.setAttribute('aria-expanded', String(!description.hidden));
  });
  document.querySelectorAll('[data-rotate]').forEach(button => button.addEventListener('click', () => engine?.rotate(Number(button.dataset.rotate))));
  document.querySelector('[data-reset]').addEventListener('click', () => engine?.reset());

  function selectStage(index) {
    if (index === current || !stageData) return;
    current = index;
    const stage = stageData[Math.max(0, index - 1)];
    journey.dataset.stage = chapters[index].id;
    document.querySelector('.scene-stage-label').textContent = index ? stage.label : 'FIELD TO FACTORY';
    document.querySelector('.hotspot-label').textContent = stage.annotation;
    description.textContent = stage.detail;
    closeHotspot();
    document.getElementById('scene-mount').setAttribute('aria-label', stage.modelLabel);
    fallback.src = index ? stage.fallback : 'assets/acs/control-panels.webp';
    fallback.alt = index ? stage.alt : 'ACS electrical control panels with internal wiring visible';
    caption.textContent = journey.dataset.renderer === 'ready' && !journey.classList.contains('no-sticky') ? 'Concept assembly / not to scale' : index ? stage.caption : 'ACS control panel / engineering reference';
    mapLinks.forEach((link, i) => {
      if (i === index - 1) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('.signal-progress').style.strokeDashoffset = String(1 - Math.max(0, index - 1) / 4);
  }
  function update() {
    frame = 0;
    if (!stageData) return;
    const marker = scrollY + innerHeight * (innerWidth < 700 ? 0.26 : 0.45);
    let index = 0;
    for (let i = 1; i < positions.length; i++) if (marker >= positions[i]) index = i;
    selectStage(index);
    if (engine && visible) {
      // Travel during the last part of each chapter; the next assembly arrives with its copy.
      let progress = 0;
      if (index > 0) {
        const span = (positions[index + 1] || positions[index] + chapters[index].offsetHeight) - positions[index];
        const local = (marker - positions[index]) / span;
        progress = index - 1 + Math.max(0, Math.min(1, (local - 0.72) / 0.28));
      }
      engine.setProgress(Math.min(4, progress), index === 0);
    }
  }
  function requestUpdate() { if (!frame) frame = requestAnimationFrame(update); }
  function measure() {
    // Short landscape screens and text zoom use a readable document layout.
    const compact = innerHeight < 600 || (innerWidth < 700 && innerHeight < 740);
    journey.classList.toggle('no-sticky', compact);
    positions = chapters.map(el => el.getBoundingClientRect().top + scrollY);
    requestUpdate();
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  document.fonts.ready.then(measure);
  new ResizeObserver(measure).observe(document.querySelector('.journey-chapters'));
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    engine?.setVisible(visible && !document.hidden);
    if (visible) requestUpdate();
  }).observe(journey);
  document.addEventListener('visibilitychange', () => engine?.setVisible(visible && !document.hidden));

  async function start() {
    const version = ++bootVersion;
    engine?.dispose(); engine = undefined; controls.hidden = true; projectAnnotation(null);
    current = -1;
    if (!stageData) stageData = (await import('./stages.js')).stages;
    if (version !== bootVersion) return;
    journey.dataset.renderer = 'static';
    measure(); update();
    if (motion.matches || navigator.connection?.saveData || journey.classList.contains('no-sticky')) return;
    try {
      const { createJourneyScene } = await import('./scene.js');
      if (version !== bootVersion) return;
      const created = await createJourneyScene(document.getElementById('scene-mount'), stageData, () => {
        journey.dataset.renderer = 'fallback'; controls.hidden = true;
        projectAnnotation(null);
        caption.textContent = stageData[Math.max(0, current - 1)].caption;
      }, projectAnnotation);
      if (version !== bootVersion) { created.dispose(); return; }
      engine = created;
      engine.setVisible(visible && !document.hidden);
      journey.dataset.renderer = 'ready'; controls.hidden = false;
      current = -1; update();
    } catch {
      if (version === bootVersion) { journey.dataset.renderer = 'fallback'; controls.hidden = true; }
    }
  }
  motion.addEventListener('change', () => start().catch(() => { journey.dataset.renderer = 'fallback'; }));
  start().catch(() => { journey.dataset.renderer = 'fallback'; });
})();
