(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = document.querySelector('.acs-menu-toggle');
  if (!toggle.dataset.bound) {
  const menu = document.querySelector('.rs-header-menu');
  const closeMenu = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  document.querySelectorAll('.acs-submenu-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const open = button.parentElement.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (menu.classList.contains('is-open')) { closeMenu(); toggle.focus(); }
    document.querySelectorAll('.acs-submenu-toggle[aria-expanded="true"]').forEach(button => {
      button.parentElement.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    });
  });
  document.addEventListener('click', event => { if (!event.target.closest('header')) closeMenu(); });
  }

  document.querySelectorAll('.acs-circle-text').forEach(el => {
    const chars = [...el.textContent.trim() + ' - '];
    el.textContent = '';
    chars.forEach((char, index) => {
      const span = document.createElement('span');
      span.textContent = char;
      span.style.transform = `rotate(${index * 360 / chars.length}deg)`;
      el.append(span);
    });
    el.classList.add('is-circular');
  });
  if (window.Swiper && document.querySelector('.acs-hero-slider')) {
    const slider = new Swiper('.acs-hero-slider', {
      slidesPerView: 1, effect: 'fade', fadeEffect: { crossFade: true }, rewind: true,
      speed: reduced ? 0 : 650,
      autoplay: reduced ? false : { delay: 8500, disableOnInteraction: true, pauseOnMouseEnter: true },
      navigation: { prevEl: '.acs-slide-prev', nextEl: '.acs-slide-next' },
      pagination: { el: '.swiper-pagination', clickable: true },
      a11y: { enabled: true },
    });
    const pause = document.querySelector('.acs-slide-pause');
    const syncPause = () => {
      const label = slider.autoplay.running ? 'Pause slideshow' : 'Play slideshow';
      pause.setAttribute('aria-label', label); pause.title = label;
      pause.firstElementChild.className = slider.autoplay.running ? 'ri-pause-line' : 'ri-play-line';
      document.querySelectorAll('.swiper-slide').forEach(slide => { slide.inert = !slide.classList.contains('swiper-slide-active'); });
    };
    pause.addEventListener('click', () => { slider.autoplay.running ? slider.autoplay.stop() : slider.autoplay.start(); syncPause(); });
    slider.on('slideChangeTransitionEnd', syncPause);
    slider.on('autoplayStop', syncPause);
    document.querySelector('.acs-hero-slider').addEventListener('focusin', () => { slider.autoplay.stop(); syncPause(); });
    syncPause();
  }
  const tabs = [...document.querySelectorAll('.acs-tab-btn')];
  document.querySelector('.acs-tabs').setAttribute('role', 'tablist');
  tabs.forEach((button, i) => {
    const panel = document.querySelector(`[data-panel="${button.dataset.tab}"]`);
    button.id = `acs-tab-${i}`; panel.id = `acs-panel-${i}`;
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', button.id);
    const select = () => tabs.forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).classList.toggle('is-active', active);
    });
    button.setAttribute('aria-selected', String(i === 0)); button.tabIndex = i === 0 ? 0 : -1;
    button.addEventListener('click', select);
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (i + 1) % tabs.length : event.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault(); tabs[next].click(); tabs[next].focus();
    });
  });
  // Values are present in HTML; animation is an enhancement, never a visibility gate.
  if (!reduced && window.Odometer && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const value = entry.target.dataset.countTo;
      entry.target.textContent = '';
      const number = document.createElement('span');
      entry.target.append(number, '+');
      new Odometer({ el: number, value: 0, format: 'd', duration: 1000 }).update(Number(value));
    }), { threshold: .5 });
    document.querySelectorAll('[data-count-to]').forEach(el => observer.observe(el));
  }
})();
