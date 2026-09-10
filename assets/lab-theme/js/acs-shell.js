(() => {
  const toggle = document.querySelector('.acs-menu-toggle');
  const menu = document.querySelector('.rs-header-menu');
  if (!toggle || !menu || toggle.dataset.bound) return;
  toggle.dataset.bound = 'true';
  const setOpen = open => {
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    toggle.title = open ? 'Close menu' : 'Open menu';
    const icon=toggle.querySelector('i');
    if(icon)icon.className=open?'ri-close-line':'ri-menu-line';
  };
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
  document.querySelectorAll('.acs-submenu-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const open = button.parentElement.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    menu.querySelectorAll('.is-open').forEach(li => {
      li.classList.remove('is-open');
      li.querySelector('button')?.setAttribute('aria-expanded','false');
    });
  });
  document.addEventListener('click', event => { if (!event.target.closest('header')) setOpen(false); });
  matchMedia('(min-width:1600px)').addEventListener('change', () => setOpen(false));
  const path = location.pathname.replace(/-lab(?=\.html$)/,'').replace(/\.html$|\/$/g,'') || '/index';
  menu.querySelectorAll('a').forEach(link => {
    const current = new URL(link.href).pathname.replace(/\.html$|\/$/g,'') || '/index';
    link.removeAttribute('aria-current');
    link.parentElement.classList.remove('active');
    if (current === path) { link.setAttribute('aria-current','page'); link.parentElement.classList.add('active'); }
  });
})();
