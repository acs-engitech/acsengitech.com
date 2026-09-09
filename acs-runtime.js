(function () {
  // Several pages in this repo (a leftover from the original WordPress export)
  // include this script twice — once as an early `async` tag and once again
  // near the end of body. Each `<script src>` re-runs this whole IIFE with a
  // fresh closure, so any state that must be shared across those instances
  // (has the shell been installed / has init already run) lives on `window`
  // instead of in a local `let`, making repeat loads idempotent no-ops.
  const acsShared = (window.__acsLabRuntime = window.__acsLabRuntime || {
    shellEventsBound: false,
    runtimeStarted: false,
    runtimeAttempts: 0,
    applyLinkHandlerBound: false,
  });

  function resolveApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (location.protocol === 'file:' || (localHost && location.port && location.port !== '3000')) {
      return `http://localhost:3000${path}`;
    }
    return path;
  }
  const siteState = { data: null };
  const primaryNav = [
    { label: 'Home', href: 'index.html' },
    { label: 'About', href: 'about.html' },
    { label: 'Panel Manufacturer', href: 'panel-manufacturer.html', children: [
      ['MCC Panel Manufacturer', 'mcc-panel-manufacturer.html'],
      ['IMCC Panel Manufacturer', 'imcc-panel-manufacturer.html'],
      ['VFD Panel Manufacturer', 'variable-frequency-drive-vfd-electrical-panel-manufacturers.html'],
    ] },
    { label: 'Services', href: 'services.html', children: [
      ['Process Automation', 'process-automation.html'],
      ['Machine / Plant Automation', 'machine-plant-automation.html'],
      ['Software & Technologies', 'software-and-cutting-edge-technologies.html'],
      ['Energy Monitoring', 'energy-monitoring-and-date-management.html'],
      ['Smart Data Logger', 'smart-data-logger.html'],
      ['Boiler Automation', 'boiler-automation.html'],
      ['Centralized Automation', 'centralized-automation.html'],
      ['Annual Maintenance Contract', 'annual-maintenance-contract.html'],
    ] },
    { label: 'Application', href: 'application.html', children: [
      ['All Applications', 'application.html'],
      ['Boiler Automation', 'boiler-automation.html'],
      ['Centralized Automation', 'centralized-automation.html'],
    ] },
    { label: 'Trading', href: 'trading.html', children: [
      ['Siemens S7-1200', 'siemens-s7-1200.html'],
      ['Siemens S7-1500', 'siemens-s7-1500.html'],
      ['Siemens G120 AC Drives', 'siemens-g120-ac-drives.html'],
      ['Accessories', 'accessories.html'],
    ] },
    { label: 'Blog', href: 'blog.html' },
    { label: 'Career', href: 'career.html' },
    { label: 'Certificates', href: 'certificates.html' },
    { label: 'Partner With Us', href: 'partner-with-us.html' },
    { label: 'Contact Us', href: 'contact.html' },
  ];
  const acsImages = {
    engineers: 'assets/acs/process-automation.jpg',
    automation: 'assets/acs/machine-automation.jpg',
    team: 'assets/acs/acs-team.jpg',
    panels: 'assets/acs/control-panels.jpg',
    software: 'assets/acs/industrial-software.png',
    server: 'assets/acs/data-systems.jpg',
    mccPanel: 'assets/acs/mcc-panel.jpg',
    plcPanel: 'assets/acs/plc-panel.jpg',
    vfdPanel: 'assets/acs/vfd-panel.jpg',
  };
  const serviceCards = [
    ['Process Automation', 'PLC, SCADA, instrumentation, commissioning, and control architecture for industrial process plants.', 'process-automation.html', acsImages.engineers],
    ['Machine / Plant Automation', 'Automation systems for OEMs, production machines, and plant-wide control requirements.', 'machine-plant-automation.html', acsImages.automation],
    ['Software & Technologies', 'Industrial software, data logging, SCADA reporting, IoT, and plant data visibility.', 'software-and-cutting-edge-technologies.html', acsImages.panels],
    ['Energy Monitoring', 'Energy and operational data systems that improve visibility, reporting, and plant performance.', 'energy-monitoring-and-date-management.html', acsImages.plcPanel],
    ['Smart Data Logger', 'Production, process, and energy logging systems for traceability and performance monitoring.', 'smart-data-logger.html', acsImages.vfdPanel],
    ['Boiler Automation', 'PLC and SCADA based boiler control for safer, reliable, and efficient operation.', 'boiler-automation.html', acsImages.mccPanel],
  ];
  const pageBlueprints = {
    '/': {
      kicker: 'ACS Engitech',
      title: 'Electrical automation that delivers.',
      lead: 'Automation control panels, PLC, SCADA, process automation, machine automation, and industrial data systems for factories across India.',
      image: acsImages.engineers,
      focus: ['PLC & SCADA Programming', 'Control Panel Manufacturing', 'Machine & Plant Automation', 'Process Automation'],
    },
    '/services': {
      kicker: 'Industrial automation services',
      title: 'Control, monitor, and improve industrial performance.',
      lead: 'ACS Engitech delivers practical automation services across PLC, SCADA, control panels, data systems, boiler automation, and annual maintenance.',
      cards: serviceCards,
    },
    '/panel-manufacturer': {
      kicker: 'Control panel manufacturing',
      title: 'Panels engineered for dependable automation.',
      lead: 'ACS manufactures MCC, IMCC, PCC, PLC, VFD, SCADA, and instrumentation panels for industrial automation applications.',
      image: acsImages.panels,
      focus: ['MCC / IMCC Panels', 'PLC Panels', 'Drive Panels', 'Instrumentation Panels'],
    },
    '/process-automation': {
      kicker: 'Process automation',
      title: 'Reliable PLC and SCADA control for process plants.',
      lead: 'From control philosophy to commissioning, ACS builds process automation systems for monitoring, alarms, reporting, and efficient plant operation.',
      image: acsImages.engineers,
      focus: ['PLC Logic', 'SCADA Screens', 'Instrumentation', 'Commissioning Support'],
    },
    '/machine-plant-automation': {
      kicker: 'Machine and plant automation',
      title: 'Automation systems for OEMs and manufacturers.',
      lead: 'Improve productivity and control with machine automation, plant automation, HMI, motion control, drives, and integrated panel systems.',
      image: acsImages.automation,
      focus: ['Machine Control', 'Plant Integration', 'OEM Applications', 'Motion & Drives'],
    },
    '/software-and-cutting-edge-technologies': {
      kicker: 'Software and technologies',
      title: 'Industrial software for smarter plant decisions.',
      lead: 'ACS builds connected data systems for SCADA reporting, energy monitoring, smart logging, IoT dashboards, and automation visibility.',
      image: acsImages.software,
      focus: ['SCADA Reporting', 'IoT Dashboards', 'Smart Data Logger', 'Energy Monitoring'],
    },
    '/energy-monitoring-and-date-management': {
      kicker: 'Energy monitoring and data management',
      title: 'Measure energy, production, and plant performance.',
      lead: 'Monitor energy usage and operational data with systems designed for better visibility, accountability, and industrial performance.',
      image: acsImages.software,
      focus: ['Energy Dashboards', 'Data Reports', 'Plant KPIs', 'Performance Tracking'],
    },
    '/smart-data-logger': {
      kicker: 'Smart data logger',
      title: 'Capture industrial data where it matters.',
      lead: 'ACS smart data logger systems capture process, production, and energy data for reporting, traceability, and better decisions.',
      image: acsImages.server,
      focus: ['Process Logs', 'Energy Logs', 'Reports', 'Traceability'],
    },
    '/boiler-automation': {
      kicker: 'Boiler automation',
      title: 'Safer and more reliable boiler control.',
      lead: 'PLC and SCADA based boiler automation systems for control, alarms, safety interlocks, reporting, and efficient operation.',
      image: acsImages.engineers,
      focus: ['PLC Control', 'SCADA Monitoring', 'Safety Interlocks', 'Alarm Systems'],
    },
    '/centralized-automation': {
      kicker: 'Centralized automation',
      title: 'Plant-wide control from one intelligent layer.',
      lead: 'Centralize control and monitoring across industrial processes with PLC, SCADA, reporting, and plant data integration.',
      image: acsImages.server,
      focus: ['Central Monitoring', 'Integrated Controls', 'Plant Dashboards', 'Data Visibility'],
    },
    '/annual-maintenance-contract': {
      kicker: 'Automation AMC',
      title: 'Keep automation systems reliable after commissioning.',
      lead: 'ACS provides annual maintenance support for PLCs, SCADA, control panels, instrumentation, troubleshooting, and plant automation systems.',
      image: acsImages.panels,
      focus: ['PLC Support', 'SCADA Support', 'Panel Maintenance', 'Troubleshooting'],
    },
    '/application': {
      kicker: 'Applications',
      title: 'Automation applications for practical plant needs.',
      lead: 'ACS automation systems support process plants, boiler systems, centralized monitoring, machine control, and data-driven manufacturing.',
      cards: serviceCards,
    },
    '/trading': {
      kicker: 'Siemens trading',
      title: 'Siemens PLC, HMI, drives, and automation accessories.',
      lead: 'ACS supports Siemens automation products, integration, programming, commissioning, and panel-level execution.',
      cards: [
        ['Siemens S7-1200', 'Compact PLC support for machines and automation panels.', 'siemens-s7-1200.html'],
        ['Siemens S7-1500', 'High-performance PLC support for advanced automation systems.', 'siemens-s7-1500.html'],
        ['Siemens G120 AC Drives', 'Drive support for industrial motor control applications.', 'siemens-g120-ac-drives.html'],
        ['Siemens KTP700 HMI', 'Operator interface configuration and PLC integration.', 'siemens-ktp700-hmi.html'],
      ],
    },
    '/certificates': {
      kicker: 'Certificates and quality',
      title: 'Credentials that support reliable execution.',
      lead: 'ACS Engitech maintains certification, quality, and approval credentials for industrial automation and control panel work.',
      focus: ['ISO 9001:2015 Certified', 'Siemens Channel Partner', 'Siemens System House', 'CPRI Approved PMCC Panel'],
    },
    '/photo-gallery': {
      kicker: 'Photo gallery',
      title: 'Automation projects, panels, and field work.',
      lead: 'A visual look at ACS control panels, automation installations, project execution, and engineering work.',
      image: acsImages.panels,
      focus: ['Control Panels', 'Project Execution', 'Automation Systems', 'Plant Work'],
    },
    '/contact': {
      kicker: 'Contact ACS Engitech',
      title: 'Talk to ACS about your automation requirement.',
      lead: 'Reach ACS Engitech for control panels, PLC SCADA programming, process automation, machine automation, and engineering support.',
      contact: true,
    },
    '/partner-with-us': {
      kicker: 'Partner With Us',
      title: 'Grow with ACS Engitech.',
      lead: 'Register as a vendor or agency partner across marketing, design, development, content, and consulting to work with ACS Engitech.',
      image: acsImages.team,
      focus: ['Marketing & Design Partners', 'Development Partners', 'Consulting Partners'],
    },
  };
  const aliases = {
    '/mcc-panel-manufacturer': '/panel-manufacturer',
    '/imcc-panel-manufacturer': '/panel-manufacturer',
    '/variable-frequency-drive-vfd-electrical-panel-manufacturers': '/panel-manufacturer',
    '/scada': '/software-and-cutting-edge-technologies',
    '/accessories': '/trading',
    '/siemens-s7-1200': '/trading',
    '/siemens-s7-1500': '/trading',
    '/siemens-s7-200-smart-plc': '/trading',
    '/siemens-s7-300-plc': '/trading',
    '/siemens-s7-400-plc': '/trading',
    '/siemens-ktp700-hmi': '/trading',
    '/siemens-g120-ac-drives': '/trading',
    '/siemens-v-20': '/trading',
    '/siemens-v-90-servo-drive': '/trading',
    '/siemens-et-200sp': '/trading',
    '/siemens-logo': '/trading',
    '/multi-effect-evaporator-plant-automation': '/process-automation',
    '/process-automation-2': '/process-automation',
    '/smart-data-logger-2': '/smart-data-logger',
  };

  function normalizePath(pathname) {
    const path = (pathname || '/').replace(/\/+/g, '/').replace(/\.html$/i, '').replace(/\/index$/i, '').replace(/\/$/, '');
    return path || '/';
  }

  function upsertMeta(selector, attrs) {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      document.head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  }

  function upsertLink(rel, href) {
    if (!href) return;
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement('link');
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href.startsWith('http') ? href : `${location.origin}${href === '/' ? '/' : href}`;
  }

  function applySeo(data) {
    const path = normalizePath(location.pathname);
    const seo = data.pageSeo?.[path] || data.pageSeo?.[path.replace(/\/$/, '')] || data.pageSeo?.['/'];
    if (!seo) return;
    if (seo.title) document.title = seo.title;
    if (seo.description) upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
    if (seo.robots) upsertMeta('meta[name="robots"]', { name: 'robots', content: seo.robots });
    if (seo.keywords) upsertMeta('meta[name="keywords"]', { name: 'keywords', content: seo.keywords });
    if (seo.canonical) upsertLink('canonical', seo.canonical);
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.ogTitle || seo.title || document.title });
    if (seo.ogDescription || seo.description) upsertMeta('meta[property="og:description"]', { property: 'og:description', content: seo.ogDescription || seo.description });
    if (seo.ogImage) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: seo.ogImage });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.twitterTitle || seo.ogTitle || seo.title || document.title });
    if (seo.twitterDescription || seo.ogDescription || seo.description) upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.twitterDescription || seo.ogDescription || seo.description });
    if (seo.twitterImage || seo.ogImage) upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.twitterImage || seo.ogImage });
    if (seo.jsonLd) {
      let script = document.head.querySelector('script[data-acs-jsonld]');
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.acsJsonld = 'true';
        document.head.appendChild(script);
      }
      script.textContent = seo.jsonLd;
    }
  }

  // Admin-entered GTM/GA IDs are interpolated into inline <script> text below.
  // Enforce their well-known formats first so a malicious/typo'd value typed
  // into the admin Analytics tab can never break out of the string literal.
  var GTM_ID_RE = /^GTM-[A-Z0-9]+$/;
  var GA4_ID_RE = /^G-[A-Z0-9]+$/;

  function injectAnalytics(settings) {
    var gtmId = settings?.gtmContainerId && GTM_ID_RE.test(settings.gtmContainerId) ? settings.gtmContainerId : null;
    var gaId = settings?.gaMeasurementId && GA4_ID_RE.test(settings.gaMeasurementId) ? settings.gaMeasurementId : null;
    if (gtmId && !document.querySelector('[data-acs-gtm]')) {
      const script = document.createElement('script');
      script.dataset.acsGtm = 'true';
      script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(script);
      const noscript = document.createElement('noscript');
      noscript.dataset.acsGtm = 'true';
      noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
      document.body.insertBefore(noscript, document.body.firstChild);
    }
    if (gaId && !document.querySelector('[data-acs-ga]')) {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.acsGa = 'true';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);
      const config = document.createElement('script');
      config.dataset.acsGa = 'true';
      config.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`;
      document.head.appendChild(config);
    }
  }

  function visitorId() {
    const key = 'acsVisitorId';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function deviceType() {
    return window.matchMedia('(max-width: 767px)').matches ? 'mobile' : window.matchMedia('(max-width: 1100px)').matches ? 'tablet' : 'desktop';
  }

  function track() {
    fetch(resolveApiUrl('/api/public'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: normalizePath(location.pathname),
        visitorId: visitorId(),
        referrer: document.referrer,
        device: deviceType(),
      }),
      keepalive: true,
    }).catch(function () {});
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  // Blog post "Content HTML" is an intentional rich-content field (the admin
  // panel's editor is a raw-HTML textarea by design) so it is rendered as
  // real markup, not escaped. This strips the handful of tags/attributes
  // that would let a compromised admin session plant script that runs for
  // every site visitor, while leaving normal formatting (headings, links,
  // images, lists) untouched. Defense-in-depth against an already-privileged
  // threat, not a substitute for keeping the admin account itself secure.
  function sanitizeBlogHtml(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(["'])\s*(javascript:|data:)/gi, '$1=$2#blocked:');
  }

  function navItems(items) {
    return items.map((item) => `
      <li class="${item.children ? 'has-dropdown' : ''}">
        <a href="${item.href}">${item.label}${item.children ? '<span aria-hidden="true">⌄</span>' : ''}</a>
        ${item.children ? `<ul>${item.children.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>` : ''}
      </li>
    `).join('');
  }

  function mobileNavItems(items) {
    return items.map((item) => `
      <li class="${item.children ? 'has-children' : ''}">
        <div class="acs-mobile-row">
          <a href="${item.href}">${item.label}</a>
          ${item.children ? '<button type="button" aria-label="Toggle submenu">⌄</button>' : ''}
        </div>
        ${item.children ? `<ul>${item.children.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>` : ''}
      </li>
    `).join('');
  }

  function installSharedShell() {
    const header = document.querySelector('header#masthead') || document.querySelector('header');
    if (header && !header.classList.contains('acs-lab-header')) {
      header.className = 'acs-lab-header';
      header.removeAttribute('style');
      header.innerHTML = `
        <div class="acs-lab-topline">
          <span>Email. <a href="mailto:sales@acsengitech.com">sales@acsengitech.com</a></span>
          <span>Call. <a href="tel:+917048520058">+91 70485 20058</a></span>
          <span>Schedule. Mon - Sat 10.00 - 18.00</span>
        </div>
        <div class="acs-lab-nav">
          <a class="acs-lab-brand" href="index.html" aria-label="ACS Engitech">
            <img src="logo-1.svg" alt="ACS Engitech">
          </a>
          <nav class="acs-lab-menu" aria-label="Primary navigation">
            <ul>${navItems(primaryNav)}</ul>
          </nav>
          <a class="acs-lab-cta" href="contact.html">Get In Touch <span aria-hidden="true">→</span></a>
          <button class="acs-lab-toggle" type="button" aria-expanded="false" aria-controls="acsMobileMenu" aria-label="Open menu" onclick="window.acsToggleMobileMenu && window.acsToggleMobileMenu(event)">
            <span></span><span></span><span></span>
          </button>
        </div>
        <div class="acs-mobile-panel" id="acsMobileMenu" hidden>
          <nav aria-label="Mobile navigation"><ul>${mobileNavItems(primaryNav)}</ul></nav>
        </div>
      `;
    }

    const footer = document.querySelector('footer#colophon') || document.querySelector('footer');
    if (footer && !footer.classList.contains('acs-lab-footer')) {
      footer.id = 'colophon';
      footer.className = 'acs-lab-footer';
      footer.removeAttribute('style');
      footer.innerHTML = `
        <div class="acs-lab-footer-main">
          <div class="acs-lab-footer-about">
            <img src="logo-white.svg" alt="ACS Engitech">
            <p>ACS Engitech Pvt. Ltd. specializes in Automation Control Panels, PLC and SCADA programming, and industrial automation solutions for industries across India.</p>
            <div class="acs-lab-social" aria-label="Social links">
              <a href="#" aria-label="Facebook">f</a>
              <a href="#" aria-label="Instagram">◎</a>
              <a href="#" aria-label="YouTube">▶</a>
              <a href="#" aria-label="LinkedIn">in</a>
            </div>
          </div>
          <div>
            <h3>Quick Links</h3>
            <ul>
              <li><a href="about.html">About Us</a></li>
              <li><a href="panel-manufacturer.html">Panel Manufacturer</a></li>
              <li><a href="certificates.html">Certificate</a></li>
              <li><a href="photo-gallery.html">Photo Gallery</a></li>
              <li><a href="blog.html">Blog</a></li>
            </ul>
          </div>
          <div>
            <h3>Services</h3>
            <ul>
              <li><a href="process-automation.html">Process Automation</a></li>
              <li><a href="machine-plant-automation.html">Machine / Plant Automation</a></li>
              <li><a href="software-and-cutting-edge-technologies.html">Software & Technologies</a></li>
              <li><a href="energy-monitoring-and-date-management.html">Energy Monitoring & Data Management</a></li>
              <li><a href="smart-data-logger.html">Smart Data Logger</a></li>
              <li><a href="boiler-automation.html">Boiler Automation</a></li>
              <li><a href="centralized-automation.html">Centralized Automation</a></li>
              <li><a href="annual-maintenance-contract.html">Annual Maintenance Contract</a></li>
            </ul>
          </div>
          <div class="acs-lab-contact">
            <h3>Our Office</h3>
            <p><strong>ACS Engitech Private Limited</strong><br>A-98, Swayam Industrial Park,<br>Opposite - Gharda Ghar, Vill- Kuha,<br>Taluka- Daskroi, Ahmedabad-382433<br>GST : 24AAQCA6090D1ZO</p>
            <p><a href="tel:+917048520058">+91 70485 20058</a></p>
            <p><a href="mailto:sales@acsengitech.com">sales@acsengitech.com</a></p>
          </div>
        </div>
        <div class="acs-lab-copyright">
          <p>© 2026, All Rights Reserved - ACS Engitech Private Limited</p>
          <p>Made with <span aria-hidden="true">♥</span> by <a href="https://monkmediaone.com/">Monk Media One</a></p>
        </div>
      `;
    }
  }

  function toggleMobileMenu(event) {
    const toggle = event.target.closest('.acs-lab-toggle');
    const panel = document.getElementById('acsMobileMenu');
    if (!toggle || !panel) return;
    event.preventDefault();
    event.stopPropagation();
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
    toggle.classList.toggle('is-open', !isOpen);
    panel.hidden = isOpen;
  }

  function bindSharedShell() {
    window.acsToggleMobileMenu = toggleMobileMenu;
    if (acsShared.shellEventsBound) return;
    acsShared.shellEventsBound = true;
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest('.acs-lab-toggle');
      if (toggle) {
        toggleMobileMenu(event);
        return;
      }

      const submenuButton = event.target.closest('.acs-mobile-row button');
      if (submenuButton) {
        event.preventDefault();
        submenuButton.closest('li')?.classList.toggle('is-open');
      }
    });
  }

  function rebuildAboutPage() {
    if (normalizePath(location.pathname) !== '/about') return;
    preserveExistingPage({
      kicker: 'About ACS Engitech',
      title: 'Industrial automation built with precision.',
      lead: 'Control panels, PLC and SCADA programming, process automation, machine automation, and plant engineering support from Ahmedabad.',
      image: acsImages.team,
      focus: ['16+ years of experience', '7000+ work orders', 'Siemens automation expertise'],
    });
  }

  // Homepage-only, hand-built section set matching the laboratory reference
  // theme's structure (feature/about-tabs/services/process/case-studies/
  // clients/CTA), in ACS brand tone, using ACS's real content only — no
  // stock thumbnails, no invented copy. Keeps the existing hero (already
  // built from the real `/` blueprint via renderPageHero) and replaces
  // everything below it, unlike preserveExistingPage() elsewhere which
  // keeps the original WordPress/Elementor body untouched under a new hero.
  // ACS-first hero: image-led industrial proof with blueprint detailing. The
  // animation is restrained so the company, facility, panels, and credentials
  // are the story; motion is an enhancement, never the subject.
  function blueprintHeroMarkup() {
    const b = pageBlueprints['/'];
    return `
    <section class="acs-bp-hero" aria-label="${escapeHtml(b.kicker)}">
      <div class="acs-bp-hero-inner">
        <div class="acs-bp-copy">
          <p class="acs-bp-eyebrow">ACS Engitech <span>// Industrial Electrical Automation</span></p>
          <h1 class="acs-bp-title">
            <span class="ln"><span>Electrical automation</span></span>
            <span class="ln"><span>built for real</span></span>
            <span class="ln"><span><em>industrial plants.</em></span></span>
          </h1>
          <p class="acs-bp-lead">${escapeHtml(b.lead)}</p>
          <div class="acs-bp-actions">
            <a class="acs-bp-btn" href="contact.html">Discuss your project <span class="arw" aria-hidden="true">&rarr;</span></a>
            <a class="acs-bp-link" href="about.html">16+ years. 7000+ work orders.</a>
          </div>
          <div class="acs-bp-chips">
            <span class="acs-bp-chip">Siemens Channel Partner</span>
            <span class="acs-bp-chip">ISO 9001:2015</span>
            <span class="acs-bp-chip">CPRI-approved PMCC</span>
            <span class="acs-bp-chip">36,000 sq. ft. facility</span>
          </div>
        </div>

        <div class="acs-bp-figure">
          <div class="acs-bp-photo-stack" aria-label="ACS Engitech industrial automation work">
            <figure class="acs-bp-main-photo">
              <img src="${acsImages.panels}" alt="ACS Engitech control panel manufacturing">
              <figcaption>MCC / PLC / VFD Panels</figcaption>
            </figure>
            <figure class="acs-bp-secondary-photo">
              <img src="${acsImages.automation}" alt="ACS Engitech machine and plant automation">
              <figcaption>Machine &amp; Plant Automation</figcaption>
            </figure>
          </div>
          <div class="acs-bp-readout">
            <span class="k">Work orders</span><span class="k">Clients</span>
            <span class="v" data-count-to="7000">7000<small>+</small></span>
            <span class="v" data-count-to="200">200<small>+</small></span>
          </div>
          <div class="acs-bp-proof-card">
            <strong>36,000 sq. ft.</strong>
            <span>Ahmedabad manufacturing facility for automation panels and commissioning support.</span>
          </div>
        </div>
      </div>
    </section>`;
  }

  function rebuildHomePage() {
    if (normalizePath(location.pathname) !== '/') return;
    const root = findContentRoot();
    if (!root || root.dataset.acsPreserved === 'true') return;

    // The original homepage markup includes an inline slider script (its own
    // `<script>` block, not part of this runtime) that starts a
    // setInterval-driven hero rotation targeting elements like `.hero`/`.hc`.
    // Timers survive their triggering markup being replaced below, so left
    // alone it keeps firing every 2.5s against DOM that no longer exists and
    // throws repeatedly. Nothing in this runtime uses setInterval, so it is
    // safe to clear every pending interval before taking over the content.
    const highestIntervalId = setInterval(() => {}, 1e9);
    for (let id = 1; id <= highestIntervalId; id += 1) clearInterval(id);
    clearInterval(highestIntervalId);

    root.classList.add('acs-preserved-page');
    root.dataset.acsPreserved = 'true';
    root.dataset.acsRebuilt = 'true';
    document.body.classList.add('acs-home-active'); // unlocks full-bleed layout (see homepage.css)
    root.innerHTML = '';

    const wrap = document.createElement('div');
    // `gsap-ready` here (not added later in JS) hides the hero intro elements at
    // first paint so there is no flash-then-hide; runBlueprintMotion animates
    // them in, or revealFallback() strips the class if GSAP never loads.
    // `reveal-armed` gates the hidden pre-reveal state (see homepage.css): set here
    // so if init ever fails before wiring the observer, content isn't left invisible.
    wrap.className = 'acs-home gsap-ready reveal-armed';
    wrap.innerHTML = `
      ${blueprintHeroMarkup()}
      <section class="acs-features">
        <div class="acs-container">
          <span class="acs-eyebrow">Why ACS Engitech</span>
          <h2 class="acs-h2">Trusted for precision, backed by scale</h2>
          <div class="acs-features-grid">
            <div class="acs-feature-card acs-reveal">
              <div class="acs-feature-icon"><svg viewBox="0 0 24 24" stroke-width="1.6"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01M9 15h.01M15 15h.01" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <h5>36,000 Sq. Ft. Facility</h5>
              <p>In-house manufacturing in Ahmedabad, built for panel fabrication at scale.</p>
            </div>
            <div class="acs-feature-card acs-reveal" style="transition-delay:.12s">
              <div class="acs-feature-icon"><svg viewBox="0 0 24 24" stroke-width="1.6"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <h5>Siemens Channel Partner</h5>
              <p>Authorized Siemens Channel Partner since 2014, Siemens System House since 2018.</p>
            </div>
            <div class="acs-feature-card acs-reveal" style="transition-delay:.24s">
              <div class="acs-feature-icon"><svg viewBox="0 0 24 24" stroke-width="1.6"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <h5>ISO 9001:2015 Certified</h5>
              <p>CPRI-approved PMCC panels, ERDA IP55 cubicle panels, safe industrial solutions.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="acs-about">
        <div class="acs-container">
          <div class="acs-about-grid">
            <div class="acs-about-media acs-reveal acs-reveal-left">
              <img src="${acsImages.team}" alt="ACS Engitech team">
              <div class="acs-stats-bar">
                <div class="acs-stat"><div class="acs-stat-n" data-count-to="16">0</div><div class="acs-stat-l">Years of<br>Experience</div></div>
                <div class="acs-stat"><div class="acs-stat-n" data-count-to="7000">0</div><div class="acs-stat-l">Work<br>Orders</div></div>
                <div class="acs-stat"><div class="acs-stat-n" data-count-to="200">0</div><div class="acs-stat-l">Clients<br>Served</div></div>
                <div class="acs-stat"><div class="acs-stat-n" data-count-to="80">0</div><div class="acs-stat-l">WWT<br>Plants</div></div>
              </div>
            </div>
            <div class="acs-reveal" style="transition-delay:.1s">
              <span class="acs-eyebrow">About ACS Engitech</span>
              <h2 class="acs-h2">Reliable automation solutions since 2009</h2>
              <p class="acs-lead">ACS Engitech provides automation and electrical automation solutions — from Machine Automation, Plant Automation and Process Automation to comprehensive Electrical Panel Manufacturing. Established in Ahmedabad with a 36,000 sq. ft. in-house manufacturing facility.</p>
              <div class="acs-tabs">
                <button class="acs-tab-btn is-active" data-tab="approach">Our Approach</button>
                <button class="acs-tab-btn" data-tab="standards">Our Standards</button>
                <button class="acs-tab-btn" data-tab="capability">Our Capability</button>
              </div>
              <div class="acs-tab-panel is-active" data-panel="approach"><p class="acs-lead">Every panel and control system is engineered around the client's actual process — from control philosophy through commissioning and support, not off-the-shelf templates.</p></div>
              <div class="acs-tab-panel" data-panel="standards"><p class="acs-lead">Authorized Siemens Channel Partner since 2014 and Siemens System House since 2018. ISO 9001:2015 certified. CPRI-approved PMCC panels. ERDA IP55 cubicle panels.</p></div>
              <div class="acs-tab-panel" data-panel="capability"><p class="acs-lead">Panel supply and commissioning, PLC/HMI/SCADA integration, IEC 61439 and IEC 60204 compliant builds, all delivered from our own 36,000 sq. ft. facility.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section class="acs-services">
        <div class="acs-container">
          <span class="acs-eyebrow">What we do</span>
          <h2 class="acs-h2">End-to-end automation, every industry</h2>
          <div class="acs-services-grid">
            ${serviceCards.map((card, i) => `
              <a class="acs-service-card acs-reveal" style="transition-delay:${(i * 0.08).toFixed(2)}s" href="${card[2]}">
                <img src="${card[3]}" alt="${escapeHtml(card[0])}">
                <div class="acs-service-body">
                  <div class="acs-service-num">0${i + 1}</div>
                  <h4>${escapeHtml(card[0])}</h4>
                  <p>${escapeHtml(card[1])}</p>
                </div>
              </a>`).join('')}
          </div>
        </div>
      </section>

      <section class="acs-process acs-tight">
        <div class="acs-container">
          <span class="acs-eyebrow">How we work</span>
          <h2 class="acs-h2">Precision in automation steps</h2>
          <div class="acs-process-grid">
            <div class="acs-step acs-reveal"><h5>Consultation &amp; Assessment</h5><p>Understand your process, plant, and automation requirements before proposing a solution.</p></div>
            <div class="acs-step acs-reveal" style="transition-delay:.1s"><h5>Customized Strategy Development</h5><p>Control philosophy, panel design, and IEC-compliant engineering for the specific application.</p></div>
            <div class="acs-step acs-reveal" style="transition-delay:.2s"><h5>Manufacturing &amp; Commissioning</h5><p>In-house fabrication at our 36,000 sq. ft. facility, followed by on-site commissioning.</p></div>
            <div class="acs-step acs-reveal" style="transition-delay:.3s"><h5>Implementation &amp; Ongoing Support</h5><p>Annual maintenance contracts and support keep systems running reliably long-term.</p></div>
          </div>
        </div>
      </section>

      <section class="acs-cases">
        <div class="acs-container">
          <span class="acs-eyebrow">Case studies</span>
          <h2 class="acs-h2">Case studies of excellence</h2>
          <div class="acs-cases-grid">
            <div class="acs-case-card acs-reveal">
              <img src="${acsImages.panels}" alt="PLC Panel - Water Treatment Plant">
              <div class="acs-case-overlay"><span class="acs-case-tag">Water Treatment</span><h5>PLC Panel — Water Treatment Plant</h5></div>
            </div>
            <div class="acs-case-card acs-reveal" style="transition-delay:.1s">
              <img src="${acsImages.automation}" alt="MCC Panel - Waste Water Industry">
              <div class="acs-case-overlay"><span class="acs-case-tag">Waste Water</span><h5>MCC Panel — Waste Water Industry</h5></div>
            </div>
            <div class="acs-case-card acs-reveal" style="transition-delay:.2s">
              <img src="${acsImages.engineers}" alt="VFD Panel - Industrial Plant">
              <div class="acs-case-overlay"><span class="acs-case-tag">Industrial Plant</span><h5>VFD Panel — Industrial Plant</h5></div>
            </div>
          </div>
        </div>
      </section>

      <section class="acs-clients acs-tight">
        <div class="acs-container" style="text-align:center">
          <span class="acs-eyebrow" style="justify-content:center">Trusted by</span>
          <h2 class="acs-h2">Some of the companies we work with</h2>
          <div class="acs-clients-row">
            <img src="https://acsengitech.com/wp-content/uploads/2026/03/hikal-straight-logo.png" alt="Hikal">
            <img src="https://matthey.com/o/jm-platinum-theme/images/new__jm__images/Johnson_Matthey%20_Logo_blue.svg" alt="Johnson Matthey">
            <img src="https://acsengitech.com/wp-content/uploads/2026/03/Untitled-design.png" alt="Rexroth">
          </div>
        </div>
      </section>

      <section class="acs-tight">
        <div class="acs-container">
          <div class="acs-cta-band acs-reveal">
            <div>
              <h3>Need dependable automation execution?</h3>
              <p>Talk to ACS Engitech about PLC panels, SCADA systems, process automation, machine automation, data logging, or Siemens automation support.</p>
            </div>
            <a class="acs-cta-btn" href="contact-us.html">Contact Us →</a>
          </div>
        </div>
      </section>
    `;
    root.appendChild(wrap);

    initAcsHomeInteractions(wrap);
  }

  function initAcsHomeInteractions(scope) {
    // Tabs
    scope.querySelectorAll('.acs-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.acs-about-grid') ? scope.querySelector('.acs-about-grid') : scope;
        group.querySelectorAll('.acs-tab-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        group.querySelectorAll('.acs-tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === btn.dataset.tab));
      });
    });

    // Scroll-reveal via IntersectionObserver (native, no dependency)
    const revealTargets = scope.querySelectorAll('.acs-reveal');
    const revealAll = () => revealTargets.forEach((el) => el.classList.add('is-visible'));
    try {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        revealTargets.forEach((el) => io.observe(el));
      } else {
        revealAll();
      }
    } catch (_) {
      revealAll();
    }
    // Last-resort safety net: whatever the observer missed, reveal it so a section
    // can never stay invisible ("stripped off"). Long enough not to fight the
    // scroll animation for a normally-browsing visitor.
    setTimeout(revealAll, 6000);

    // Count-up stats, triggered when the stats bar scrolls into view
    const statEls = scope.querySelectorAll('[data-count-to]');
    if (statEls.length && 'IntersectionObserver' in window) {
      const statIo = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          statIo.unobserve(entry.target);
          const el = entry.target;
          const target = parseInt(el.dataset.countTo, 10) || 0;
          const duration = 1400;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target) + '+';
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });
      statEls.forEach((el) => statIo.observe(el));
    }

    initBlueprintMotion(scope);
  }

  // Lightweight homepage motion, powered by the locally vendored GSAP. The
  // hero is rendered with `.gsap-ready` already set so intro elements are
  // hidden at first paint (no flash); if GSAP fails to load, revealFallback()
  // drops `.gsap-ready` and the page shows normally.
  function initBlueprintMotion(scope) {
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealFallback = () => scope.classList.remove('gsap-ready');
    if (prefersReduced) { revealFallback(); return; }

    let waited = 0;
    (function waitForGsap() {
      if (window.gsap) return runBlueprintMotion(scope);
      waited += 60;
      if (waited > 1800) return revealFallback(); // lib never arrived
      setTimeout(waitForGsap, 60);
    })();
  }

  function runBlueprintMotion(scope) {
    const gsap = window.gsap;

    // NOTE: this never touches scroll position or the native scrollbar.

    const hero = scope.querySelector('.acs-bp-hero');
    if (!hero) { scope.classList.remove('gsap-ready'); return; }

    gsap.set(hero.querySelector('.acs-bp-title'), { visibility: 'visible' }); // GSAP now owns the split transform
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(hero.querySelectorAll('.acs-bp-title .ln > span'), { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.1 }, 0.05)
      .fromTo(hero.querySelector('.acs-bp-lead'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, 0.35)
      .fromTo(hero.querySelector('.acs-bp-actions'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, 0.48)
      .fromTo(hero.querySelectorAll('.acs-bp-chip'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 }, 0.6)
      .fromTo(hero.querySelector('.acs-bp-main-photo'), { opacity: 0, x: 34 }, { opacity: 1, x: 0, duration: 0.85 }, 0.18)
      .fromTo(hero.querySelector('.acs-bp-secondary-photo'), { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.72 }, 0.46)
      .fromTo(hero.querySelector('.acs-bp-readout'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0.72)
      .fromTo(hero.querySelector('.acs-bp-proof-card'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0.82);
  }

  function findContentRoot() {
    return document.querySelector('main#main .entry-content') ||
      document.querySelector('.entry-content') ||
      document.querySelector('[data-elementor-type="wp-page"]') ||
      document.querySelector('main#main') ||
      document.querySelector('#primary') ||
      document.querySelector('#content');
  }

  function renderPageHero(blueprint) {
    const focus = (blueprint.focus || []).slice(0, 3);
    const heroImage = blueprint.image || acsImages.engineers;
    const hero = document.createElement('div');
    hero.className = 'acs-preserved-intro';
    hero.innerHTML = `
      <section class="acs-lab-page-hero acs-page-hero">
        <div class="acs-lab-page-hero-media"><img src="${heroImage}" alt="${escapeHtml(blueprint.kicker)} by ACS Engitech"></div>
        <div class="acs-template-container acs-lab-hero-content">
          <p class="acs-template-kicker">${escapeHtml(blueprint.kicker)}</p>
          <h1>${escapeHtml(blueprint.title)}</h1>
          <p>${escapeHtml(blueprint.lead)}</p>
          <a class="acs-lab-hero-link" href="contact.html">Discuss your project <span aria-hidden="true">→</span></a>
        </div>
      </section>
      ${focus.length ? `<section class="acs-lab-feature-strip" aria-label="Key capabilities">
        ${focus.map((item, index) => `<article><span>0${index + 1}</span><strong>${escapeHtml(item)}</strong><small>Engineered and supported by ACS Engitech</small></article>`).join('')}
      </section>` : ''}
    `;
    return hero;
  }

  function originalSectionContainer(root) {
    if (root.children.length === 1 && root.firstElementChild?.classList.contains('elementor')) {
      return root.firstElementChild;
    }
    return root;
  }

  function materializeOriginalGalleries(root) {
    root.querySelectorAll('.e-gallery-image[data-thumbnail]').forEach((item, index) => {
      if (item.querySelector('img[data-acs-gallery-image]')) return;
      const src = item.getAttribute('data-thumbnail');
      if (!src) return;
      const card = item.closest('.e-gallery-item');
      const anchor = item.closest('a');
      const title = card?.querySelector('.elementor-gallery-item__title')?.textContent?.replace(/\s+/g, ' ').trim() || anchor?.getAttribute('data-elementor-lightbox-title') || anchor?.getAttribute('aria-label') || `ACS Engitech certificate ${index + 1}`;
      const image = document.createElement('img');
      image.src = src;
      image.alt = title;
      image.loading = 'eager';
      image.decoding = 'async';
      image.setAttribute('data-acs-gallery-image', '');
      item.appendChild(image);
      item.setAttribute('role', 'img');
      item.setAttribute('aria-label', title);
      const captionHost = anchor || card;
      if (captionHost && !captionHost.querySelector('.acs-gallery-caption')) {
        const caption = document.createElement('span');
        caption.className = 'acs-gallery-caption';
        caption.textContent = title;
        captionHost.appendChild(caption);
      }
    });
  }

  function classifyOriginalSections(container) {
    Array.from(container.children).forEach((section, index) => {
      if (section.classList.contains('acs-preserved-intro')) return;
      section.classList.add('acs-content-band');
      section.dataset.acsSection = String(index + 1);
      if (section.querySelector('[data-thumbnail], .e-gallery-container, .gallery')) section.classList.add('has-gallery');
      if (section.querySelector('form, input, textarea, select')) section.classList.add('has-form');
      if (section.querySelector('img, video, iframe')) section.classList.add('has-media');
      if (section.querySelectorAll('h2, h3, h4').length >= 3) section.classList.add('has-section-grid');
    });
  }

  function activateMotionContent(root) {
    root.querySelectorAll('[data-sr]').forEach((element) => {
      element.classList.add('acs-motion-visible');
    });
    root.querySelectorAll('*').forEach((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (Number(style.opacity) <= 0.05 && style.transform !== 'none' && rect.width > 0 && rect.height > 0) {
        element.classList.add('acs-motion-visible');
      }
    });
  }

  function markObsoleteTitleBanner(root, container, path) {
    if (path === '/') {
      const legacyHero = container.querySelector('section.hero');
      if (legacyHero) legacyHero.classList.add('acs-original-banner');
      return;
    }
    const first = container.firstElementChild;
    if (!first) return;
    const headings = first.querySelectorAll('h1, h2, h3');
    const forms = first.querySelectorAll('form, input, textarea, select');
    const media = first.querySelectorAll('img, video, iframe, [data-thumbnail]');
    const textLength = (first.textContent || '').replace(/\s+/g, ' ').trim().length;
    if (headings.length && !forms.length && media.length <= 1 && textLength < 180) {
      first.classList.add('acs-original-banner');
    }
  }

  function appendProjectCta(root) {
    if (root.querySelector('.acs-preserved-project-cta')) return;
    const cta = document.createElement('section');
    cta.className = 'acs-blue-cta acs-lab-project-cta acs-preserved-project-cta';
    cta.innerHTML = `<div class="acs-template-container"><div><p class="acs-template-kicker">Start a project</p><h2>Need dependable automation execution?</h2><p>Talk to ACS Engitech about PLC panels, SCADA systems, process automation, machine automation, data logging, or Siemens automation support.</p></div><a href="contact.html">Contact Us Now <span aria-hidden="true">→</span></a></div>`;
    root.appendChild(cta);
  }

  function preserveExistingPage(blueprint) {
    const root = findContentRoot();
    if (!root || root.dataset.acsPreserved === 'true') return;
    const path = normalizePath(location.pathname);
    const container = originalSectionContainer(root);
    markObsoleteTitleBanner(root, container, path);
    materializeOriginalGalleries(container);
    classifyOriginalSections(container);
    root.classList.add('acs-preserved-page');
    root.dataset.acsPreserved = 'true';
    root.dataset.acsRebuilt = 'true';
    root.insertBefore(renderPageHero(blueprint), root.firstChild);
    appendProjectCta(root);
    activateMotionContent(container);
    setTimeout(() => activateMotionContent(container), 450);
  }

  function rebuildStandardPage() {
    const path = normalizePath(location.pathname);
    if (['/', '/about', '/blog', '/career', '/admin'].includes(path)) return;
    const blueprint = pageBlueprints[path] || pageBlueprints[aliases[path]];
    if (!blueprint) return;
    preserveExistingPage(blueprint);
  }

  function asList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return String(value || '').split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean);
  }

  function injectBlogNav() {
    const menu = document.getElementById('menu-1-e8c3c62') || document.querySelector('header#masthead .hfe-nav-menu');
    if (!menu || menu.querySelector('a[href$="blog.html"], a[href="/blog"], a[href="/blog.html"]')) return;
    const careerItem = Array.from(menu.children).find((item) => /career/i.test(item.textContent || ''));
    const item = document.createElement('li');
    item.className = 'menu-item menu-item-type-post_type menu-item-object-page parent hfe-creative-menu acs-blog-menu-item';
    item.innerHTML = '<a href="blog.html" class="hfe-menu-item">Blog</a>';
    menu.insertBefore(item, careerItem || null);
  }

  function careerDetailsHtml(jobs) {
    const visibleJobs = (jobs || []).filter((job) => job.status !== 'closed');
    if (!visibleJobs.length) {
      return '<div class="acs-career-empty"><p class="acs-kicker">Careers</p><h2>No active openings</h2><p class="acs-lead">Current openings will appear here once they are published from the admin panel.</p></div>';
    }
    return visibleJobs.map((job, index) => {
      const responsibilities = asList(job.responsibilities);
      const responsibilityItems = responsibilities.length
        ? responsibilities
        : asList(job.description || `Contribute to ${job.department || 'automation'} projects and support ACS Engitech clients with reliable engineering execution.`);
      const department = escapeHtml(job.department || 'Automation');
      const location = escapeHtml(job.location || 'Ahmedabad, Gujarat');
      const applyEmail = escapeHtml(job.applyEmail || 'sales@acsengitech.com');
      const title = escapeHtml(job.title || 'Open role');
      return `
        <section class="acs-career-role rs-services-item">
          <div class="acs-career-role-head">
            <span class="acs-career-pill ${index % 2 ? 'is-sales' : ''}">${department}</span>
            <span class="acs-career-location"><i class="fas fa-map-marker-alt"></i>${location}</span>
          </div>
          <h2>${title}</h2>
          <div class="acs-career-meta">
            <span><i class="fas fa-briefcase"></i><strong>Experience:</strong> ${escapeHtml(job.experience || 'Relevant experience preferred')}</span>
            <span><i class="fas fa-graduation-cap"></i><strong>Qualification:</strong> ${escapeHtml(job.qualification || 'As per role')}</span>
            <span><i class="fas fa-users"></i><strong>Vacancies:</strong> ${escapeHtml(job.vacancies || 'As per requirement')}</span>
            <span><i class="fas fa-user"></i><strong>Gender:</strong> ${escapeHtml(job.gender || 'Open')}</span>
          </div>
          <hr>
          <p class="acs-career-label">Key Responsibilities</p>
          <ul class="acs-career-list">
            ${responsibilityItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          <hr>
          <div class="acs-career-skills">
            <div><p class="acs-career-label">Hard Skills</p><p>${escapeHtml(job.hardSkills || '')}</p></div>
            <div><p class="acs-career-label">Soft Skills</p><p>${escapeHtml(job.softSkills || '')}</p></div>
          </div>
          <hr>
          <div class="acs-career-actions"><a href="#acs-job-form" class="acs-apply-link" data-position-id="${escapeHtml(job.id || '')}" data-apply-email="${applyEmail}" data-apply-title="${escapeHtml(job.title || 'ACS Engitech role')}">Apply Now <span aria-hidden="true">→</span></a></div>
        </section>`;
    }).join('');
  }

  function replaceExistingCareerBoard(jobs) {
    if (!/career/i.test(location.pathname)) return false;
    // Idempotent: safe to call more than once (this repo's WordPress-era
    // pages sometimes load acs-runtime.js twice - see acsShared above).
    if (document.querySelector('.acs-career-existing-board')) return true;
    const candidates = Array.from(document.querySelectorAll('section.elementor-top-section')).filter((node) => {
      // Never touch the section that holds the real, working apply form -
      // its position <select> is populated from the same job titles this
      // regex looks for, so once options load it can start matching too.
      if (node.querySelector('#acs-job-form, .acs-apply-form')) return false;
      const text = node.textContent || '';
      return /Automation Engineer|Field Sales Engineer|Apply Now/i.test(text);
    });
    if (!candidates.length) return false;
    const first = candidates[0];
    const parent = first.parentNode;
    const wrapper = document.createElement('section');
    wrapper.className = 'acs-career-existing-board';
    wrapper.innerHTML = careerDetailsHtml(jobs);
    parent.insertBefore(wrapper, first);
    candidates.forEach((node) => node.remove());
    return true;
  }

  function renderCareers(jobs) {
    const root = document.getElementById('acs-career-board');
    const visibleJobs = (jobs || []).filter((job) => job.status !== 'closed');
    if (!root) {
      replaceExistingCareerBoard(visibleJobs);
      return;
    }
    root.innerHTML = `<div class="acs-dynamic-inner">${careerDetailsHtml(visibleJobs)}</div>`;
  }

  function renderBlog(posts) {
    const root = document.getElementById('acs-blog-board');
    if (!root) return;
    const slug = new URLSearchParams(location.search).get('post');
    const selected = posts.find((post) => post.slug === slug);
    const visiblePosts = (posts || []).filter((post) => post.status !== 'draft');
    if (selected) {
      document.title = selected.seo?.title || selected.title;
      root.innerHTML = `
        <article class="acs-blog-article rs-postbox-wrapper">
          <a class="acs-blog-back" href="/blog">Back to blogs</a>
          <div class="acs-blog-article-hero">
            <div class="acs-blog-hero-media"><img src="${selected.coverImage || acsImages.engineers}" alt="${escapeHtml(selected.coverAlt || selected.title)}"></div>
            <p class="acs-kicker">${new Date(selected.publishedAt).toLocaleDateString()} - ${escapeHtml(selected.author || 'ACS Engitech')} - ${selected.readingMinutes || 1} min read</p>
            <h1>${escapeHtml(selected.title)}</h1>
            <p class="acs-lead">${escapeHtml(selected.excerpt || '')}</p>
          </div>
          <div class="acs-blog-content-card">
            <div class="acs-blog-content">${selected.content ? sanitizeBlogHtml(selected.content) : `<p>${escapeHtml(selected.excerpt || 'Article content will be updated soon.')}</p>`}</div>
          </div>
        </article>`;
      return;
    }
    root.innerHTML = `
      <div class="acs-dynamic-inner acs-blog-index">
        <div class="acs-blog-hero">
          <div class="acs-blog-hero-media"><img src="${acsImages.engineers}" alt="ACS Engitech industrial automation insights"></div>
          <p class="acs-kicker">ACS insights</p>
          <h1>Industrial automation blog</h1>
          <p class="acs-lead">PLC, SCADA, control panel, and industrial automation notes from ACS Engitech.</p>
        </div>
        <div class="acs-blog-list">
          ${visiblePosts.map((post) => `
            <article class="acs-blog-card">
              <img src="${post.coverImage || acsImages.panels}" alt="${escapeHtml(post.coverAlt || post.title)}">
              <div>
                <p>${new Date(post.publishedAt).toLocaleDateString()} - ${escapeHtml(post.author || 'ACS Engitech')}</p>
                <h2>${escapeHtml(post.title || 'ACS Engitech update')}</h2>
                <span>${escapeHtml(post.excerpt || 'Industrial automation insight from ACS Engitech.')}</span>
                ${(post.tags || []).length ? `<div class="acs-blog-tags">${post.tags.slice(0, 4).map((tag) => `<em>${escapeHtml(tag)}</em>`).join('')}</div>` : ''}
              </div>
              <a href="/blog?post=${encodeURIComponent(post.slug)}">Read article</a>
            </article>
          `).join('') || '<p>No published posts yet.</p>'}
        </div>
      </div>`;
  }

  function hasEnoughDomToStart() {
    if (!document.body) return false;
    const path = normalizePath(location.pathname);
    const needsPageRoot = pageBlueprints[path] || pageBlueprints[aliases[path]] || path === '/about';
    return !needsPageRoot || Boolean(findContentRoot());
  }

  // Delegated click handler for career "Apply Now" links.
  // Reads data-* attributes (safely escaped at render time), never
  // interpolates user data into an inline JS string. If the on-page
  // application form exists (window.acsSelectPosition present), pre-fills
  // the position and lets the anchor scroll to #acs-job-form. Otherwise
  // safely falls back to a mailto composed via URL builders (no user
  // data ever inserted into an HTML/JS context).
  if (!acsShared.applyLinkHandlerBound) {
    acsShared.applyLinkHandlerBound = true;
    document.addEventListener('click', (event) => {
      const link = event.target && event.target.closest && event.target.closest('a.acs-apply-link');
      if (!link) return;
      const positionId = link.getAttribute('data-position-id') || '';
      if (typeof window.acsSelectPosition === 'function') {
        try { window.acsSelectPosition(positionId); } catch { /* ignore */ }
        return; // let the browser scroll to #acs-job-form
      }
      event.preventDefault();
      const email = (link.getAttribute('data-apply-email') || '').trim();
      // Only allow simple email addresses in the mailto fallback
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      const title = link.getAttribute('data-apply-title') || 'ACS Engitech role';
      const params = new URLSearchParams({ subject: `Application for ${title}` });
      window.location.href = `mailto:${email}?${params.toString()}`;
    });
  }

  async function init() {
    if (acsShared.runtimeStarted) {
      installSharedShell();
      bindSharedShell();
      return;
    }
    if (!hasEnoughDomToStart()) return;
    acsShared.runtimeStarted = true;
    installSharedShell();
    bindSharedShell();
    rebuildAboutPage();
    rebuildHomePage();
    rebuildStandardPage();
    injectBlogNav();
    try {
      const path = encodeURIComponent(normalizePath(location.pathname));
      const response = await fetch(resolveApiUrl(`/api/public?path=${path}`));
      const data = await response.json();
      if (!response.ok) return;
      siteState.data = data;
      applySeo(data);
      injectAnalytics(data.settings || {});
      renderCareers(data.jobs || []);
      renderBlog(data.posts || []);
      track();
    } catch (error) {
      if (document.getElementById('acs-blog-board')) {
        document.getElementById('acs-blog-board').innerHTML = '<div class="acs-dynamic-inner"><p class="acs-kicker">ACS insights</p><h1>Industrial automation blog</h1><p class="acs-lead">No published posts yet.</p></div>';
      }
    }
  }

  function scheduleInit() {
    init();
    if (!acsShared.runtimeStarted && acsShared.runtimeAttempts < 600) {
      acsShared.runtimeAttempts += 1;
      window.setTimeout(scheduleInit, 50);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
    scheduleInit();
  } else {
    init();
  }
}());
