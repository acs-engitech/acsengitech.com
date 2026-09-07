(function () {
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
    { label: 'Contact Us', href: 'contact-us.html' },
  ];
  const acsImages = {
    engineers: 'assets/acs/process-automation.jpg',
    automation: 'assets/acs/machine-automation.jpg',
    team: 'assets/acs/acs-team.jpg',
    panels: 'assets/acs/control-panels.jpg',
    software: 'assets/acs/industrial-software.png',
    server: 'assets/acs/data-systems.jpg',
  };
  const serviceCards = [
    ['Process Automation', 'PLC, SCADA, instrumentation, commissioning, and control architecture for industrial process plants.', 'process-automation.html', acsImages.engineers],
    ['Machine / Plant Automation', 'Automation systems for OEMs, production machines, and plant-wide control requirements.', 'machine-plant-automation.html', acsImages.automation],
    ['Software & Technologies', 'Industrial software, data logging, SCADA reporting, IoT, and plant data visibility.', 'software-and-cutting-edge-technologies.html', acsImages.software],
    ['Energy Monitoring', 'Energy and operational data systems that improve visibility, reporting, and plant performance.', 'energy-monitoring-and-date-management.html', acsImages.server],
    ['Smart Data Logger', 'Production, process, and energy logging systems for traceability and performance monitoring.', 'smart-data-logger.html', acsImages.server],
    ['Boiler Automation', 'PLC and SCADA based boiler control for safer, reliable, and efficient operation.', 'boiler-automation.html', acsImages.automation],
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
    '/contact-us': {
      kicker: 'Contact ACS Engitech',
      title: 'Talk to ACS about your automation requirement.',
      lead: 'Reach ACS Engitech for control panels, PLC SCADA programming, process automation, machine automation, and engineering support.',
      contact: true,
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

  function injectAnalytics(settings) {
    if (settings?.gtmContainerId && !document.querySelector('[data-acs-gtm]')) {
      const script = document.createElement('script');
      script.dataset.acsGtm = 'true';
      script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtmContainerId}');`;
      document.head.appendChild(script);
    }
    if (settings?.gaMeasurementId && !document.querySelector('[data-acs-ga]')) {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.acsGa = 'true';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${settings.gaMeasurementId}`;
      document.head.appendChild(script);
      const config = document.createElement('script');
      config.dataset.acsGa = 'true';
      config.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.gaMeasurementId}');`;
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
          <a class="acs-lab-cta" href="contact-us.html">Get In Touch <span aria-hidden="true">→</span></a>
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

  let shellEventsBound = false;

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
    if (shellEventsBound) return;
    shellEventsBound = true;
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
    return;
    const root = document.querySelector('main#main .entry-content') || document.querySelector('.entry-content') || document.querySelector('main#main');
    if (!root || root.dataset.acsRebuilt === 'true') return;
    root.dataset.acsRebuilt = 'true';
    root.innerHTML = `
      <section class="acs-lab-page-hero acs-page-hero acs-about-hero">
        <div class="acs-lab-page-hero-media"><img src="${acsImages.team}" alt="ACS Engitech automation team in Ahmedabad"></div>
        <div class="acs-template-container acs-lab-hero-content">
          <p class="acs-template-kicker">About ACS Engitech</p>
          <h1>Industrial automation built with precision.</h1>
          <p>Control panels, PLC and SCADA programming, process automation, machine automation, and plant engineering support from Ahmedabad.</p>
          <a class="acs-lab-hero-link" href="#acs-about-intro">Discover ACS <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section class="acs-lab-feature-strip" aria-label="ACS credentials">
        <article><strong>16+ years</strong><span>Industrial automation experience</span></article>
        <article><strong>7000+ orders</strong><span>Executed across industrial sectors</span></article>
        <article><strong>Siemens partner</strong><span>Automation and drive expertise</span></article>
      </section>

      <section class="acs-template-section acs-about-intro" id="acs-about-intro">
        <div class="acs-template-container acs-intro-grid">
          <div class="acs-image-stack">
            <img src="${acsImages.engineers}" alt="ACS automation engineers working on industrial systems">
            <div class="acs-image-card">
              <strong>16+</strong>
              <span>Years of automation experience</span>
            </div>
          </div>
          <div class="acs-template-copy">
            <p class="acs-template-kicker">About our company</p>
            <h2>We are ACS Automation</h2>
            <p>Established in 2009 in Ahmedabad, ACS Engitech has grown from a focused automation team into a trusted engineering partner for control panels, PLC, HMI, SCADA, machine automation, plant automation, and process automation.</p>
            <p>Our in-house manufacturing facility supports customized control panel requirements with quality execution, commissioning support, and practical automation know-how.</p>
            <div class="acs-check-grid">
              <span>PLC Panel Manufacturing</span>
              <span>SCADA / HMI Programming</span>
              <span>System Integration</span>
              <span>Process Automation</span>
              <span>Siemens Channel Partner</span>
              <span>ISO 9001:2015 Certified</span>
            </div>
          </div>
        </div>
      </section>

      <section class="acs-stat-strip">
        <div class="acs-template-container acs-stat-grid">
          <article><strong>16+</strong><span>Experience Years</span></article>
          <article><strong>200+</strong><span>Happy Clients</span></article>
          <article><strong>7000+</strong><span>Work Orders</span></article>
          <article><strong>90+</strong><span>Team Members</span></article>
        </div>
      </section>

      <section class="acs-blue-section acs-history-section">
        <div class="acs-template-container">
          <div class="acs-section-title is-centered">
            <p class="acs-template-kicker">Our history</p>
            <h2>A tradition of accuracy</h2>
            <p>From a focused team in 2009 to a 90+ strong force with 7000+ successful installations across industries.</p>
          </div>
          <div class="acs-timeline">
            ${[
              ['2009', 'Establishment', 'Founded in Ahmedabad and executed first automation panel order through OEM.'],
              ['2012', 'Export Order', 'Executed automation panel work for international OEM clients.'],
              ['2014', 'Quality Management System', 'Became ISO 9001:2015 certified and an authorized Siemens channel partner.'],
              ['2018', 'Siemens System House', 'Became Authorized System House of Siemens for Automation & Drive.'],
              ['2021', 'CPRI Approval', 'CPRI approved PMCC panel as per IEC 61439 after short circuit test.'],
              ['2026 - Now', 'Where We Stand Today', 'More than 90 employees and 7000+ successful installations worldwide.'],
            ].map(([year, title, copy], index) => `
              <article class="${index % 2 ? 'is-right' : ''}">
                <span>${year}</span>
                <h3>${title}</h3>
                <p>${copy}</p>
              </article>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="acs-template-section">
        <div class="acs-template-container">
          <div class="acs-section-title is-centered">
            <p class="acs-template-kicker">Our expertise team</p>
            <h2>Your partners in precision</h2>
            <p>A dedicated team of engineers, automation specialists, and project managers bringing practical industrial experience.</p>
          </div>
          <div class="acs-team-showcase">
            <img src="${acsImages.team}" alt="ACS Engitech team Ahmedabad Gujarat">
            <div>
              <p>ACS combines technical depth with manufacturing discipline to deliver control panels, PLC, SCADA, commissioning, and support for industrial clients.</p>
              <p>We focus on dependable execution, responsive service, and long-term relationships with OEMs, factories, and process plants.</p>
              <div class="acs-credential-list">
                <span>Siemens Channel Partner</span>
                <span>Siemens System House</span>
                <span>ISO 9001:2015 Certified</span>
                <span>CPRI Approved PMCC Panel</span>
                <span>Global Installations via OEMs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="acs-blue-section">
        <div class="acs-template-container">
          <div class="acs-section-title is-centered">
            <p class="acs-template-kicker">Our foundation</p>
            <h2>Vision, mission & values</h2>
          </div>
          <div class="acs-value-grid">
            <article><h3>Our Vision</h3><p>To be a preferred solution provider in specific industrial automation segments.</p></article>
            <article><h3>Our Mission</h3><p>To provide accurate, user-friendly control and monitoring solutions for industrial machinery.</p></article>
            <article><h3>Our Values</h3><p>Transparent business, ethical conduct, and customer-first engineering support.</p></article>
          </div>
        </div>
      </section>

      <section class="acs-template-section">
        <div class="acs-template-container">
          <div class="acs-section-title is-centered">
            <p class="acs-template-kicker">Our capabilities</p>
            <h2>What we do?</h2>
          </div>
          <div class="acs-capability-grid">
            ${[
              ['System Integration', 'PLC, HMI, SCADA, motion control drives, process instruments, and sensing devices.'],
              ['Software & Technologies', 'IoT based solutions, smart data logger, energy monitoring, and data management systems.'],
              ['Manufacturing Control Panels', 'Design and manufacturing of PLC, drive, MCC, SCADA, and instrumentation panels.'],
              ['Project Execution', 'Concept to commissioning with EPLAN, Siemens TIA Portal, Profinet, Ethernet, Modbus, and USS field bus.'],
              ['Custom Built for OEMs', 'Develop and commission customized applications as per control philosophy.'],
              ['AMC', 'Annual maintenance support for Siemens PLC panels, SCADA systems, and plant machinery.'],
            ].map(([title, copy]) => `<article><h3>${title}</h3><p>${copy}</p></article>`).join('')}
          </div>
        </div>
      </section>

      <section class="acs-blue-cta">
        <div class="acs-template-container">
          <div>
            <p class="acs-template-kicker">Start a project</p>
            <h2>Looking to automate your plant or process?</h2>
            <p>Talk to ACS about PLC panels, SCADA systems, process automation, machine automation, and system integration.</p>
          </div>
          <a href="contact-us.html">Contact Us Now <span aria-hidden="true">→</span></a>
        </div>
      </section>
    `;
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
          <a class="acs-lab-hero-link" href="contact-us.html">Discuss your project <span aria-hidden="true">→</span></a>
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
    cta.innerHTML = `<div class="acs-template-container"><div><p class="acs-template-kicker">Start a project</p><h2>Need dependable automation execution?</h2><p>Talk to ACS Engitech about PLC panels, SCADA systems, process automation, machine automation, data logging, or Siemens automation support.</p></div><a href="contact-us.html">Contact Us Now <span aria-hidden="true">→</span></a></div>`;
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
    if (['/about', '/blog', '/career', '/admin'].includes(path)) return;
    const blueprint = pageBlueprints[path] || pageBlueprints[aliases[path]];
    if (!blueprint) return;
    preserveExistingPage(blueprint);
    return;
    const root = findContentRoot();
    if (!root || root.dataset.acsRebuilt === 'true') return;
    root.dataset.acsRebuilt = 'true';
    const focus = blueprint.focus || ['Automation Engineering', 'PLC & SCADA', 'Control Panels', 'Commissioning Support'];
    const cards = blueprint.cards || serviceCards;
    const heroImage = blueprint.image || cards[0]?.[3] || acsImages.engineers;
    const featureItems = focus.slice(0, 3);
    root.innerHTML = `
      <section class="acs-lab-page-hero acs-page-hero">
        <div class="acs-lab-page-hero-media"><img src="${heroImage}" alt="${escapeHtml(blueprint.kicker)} by ACS Engitech"></div>
        <div class="acs-template-container acs-lab-hero-content">
          <p class="acs-template-kicker">${escapeHtml(blueprint.kicker)}</p>
          <h1>${escapeHtml(blueprint.title)}</h1>
          <p>${escapeHtml(blueprint.lead)}</p>
          <a class="acs-lab-hero-link" href="${blueprint.contact ? 'tel:+917048520058' : 'contact-us.html'}">${blueprint.contact ? 'Call ACS' : 'Discuss your project'} <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <section class="acs-lab-feature-strip" aria-label="Key capabilities">
        ${featureItems.map((item, index) => `<article><span>0${index + 1}</span><strong>${escapeHtml(item)}</strong><small>Engineered and supported by ACS Engitech</small></article>`).join('')}
      </section>

      <section class="acs-template-section acs-lab-overview">
        <div class="acs-template-container acs-lab-overview-grid">
          <div class="acs-lab-overview-media"><img src="${heroImage}" alt="${escapeHtml(blueprint.title.replace(/\.$/, ''))}"></div>
          <div class="acs-template-copy">
            <p class="acs-template-kicker">ACS capability</p>
            <h2>${escapeHtml(blueprint.title.replace(/\.$/, ''))}</h2>
            <p>${escapeHtml(blueprint.lead)}</p>
            <div class="acs-check-grid">
              ${focus.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
            </div>
            <a class="acs-inline-link" href="about.html">Why industries choose ACS <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>

      ${blueprint.contact ? `
        <section class="acs-template-section acs-contact-section">
          <div class="acs-template-container acs-contact-grid">
            <article><span>Phone</span><a href="tel:+917048520058">+91 70485 20058</a></article>
            <article><span>Email</span><a href="mailto:sales@acsengitech.com">sales@acsengitech.com</a></article>
            <article><span>Office</span><p>A-98, Swayam Industrial Park, Opposite Gharda Ghar, Vill-Kuha, Taluka-Daskroi, Ahmedabad-382433</p></article>
          </div>
        </section>
      ` : `
        <section class="acs-lab-services-section">
          <div class="acs-template-container">
            <div class="acs-section-title">
              <p class="acs-template-kicker">What we handle</p>
              <h2>Industrial services connected to this work</h2>
              <p>One engineering partner from panel manufacture and PLC programming through commissioning, reporting, and ongoing support.</p>
            </div>
            <div class="acs-lab-service-grid">
              ${cards.slice(0, 6).map(([title, copy, href, image], index) => `
                <article class="acs-lab-service-card">
                  <div><span>0${index + 1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p><a href="${href}">Explore service <span aria-hidden="true">→</span></a></div>
                  <img src="${image || [acsImages.engineers, acsImages.automation, acsImages.software, acsImages.server, acsImages.panels, acsImages.automation][index]}" alt="${escapeHtml(title)}">
                </article>
              `).join('')}
            </div>
          </div>
        </section>
      `}

      <section class="acs-lab-proof-strip">
        <div class="acs-template-container">
          <article><strong>16+</strong><span>Years of experience</span></article>
          <article><strong>200+</strong><span>Industrial clients</span></article>
          <article><strong>7000+</strong><span>Work orders</span></article>
          <article><strong>90+</strong><span>Team members</span></article>
        </div>
      </section>

      <section class="acs-blue-cta acs-lab-project-cta">
        <div class="acs-template-container">
          <div>
            <p class="acs-template-kicker">Start a project</p>
            <h2>Need dependable automation execution?</h2>
            <p>Talk to ACS Engitech about PLC panels, SCADA systems, process automation, machine automation, data logging, or Siemens automation support.</p>
          </div>
          <a href="contact-us.html">Contact Us Now <span aria-hidden="true">→</span></a>
        </div>
      </section>
    `;
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
          <div class="acs-career-actions"><a href="mailto:${applyEmail}?subject=Application for ${encodeURIComponent(job.title || 'ACS Engitech role')}">Apply Now <span aria-hidden="true">→</span></a></div>
        </section>`;
    }).join('');
  }

  function replaceExistingCareerBoard(jobs) {
    if (!/career/i.test(location.pathname)) return false;
    const candidates = Array.from(document.querySelectorAll('section.elementor-top-section')).filter((node) => {
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
            <div class="acs-blog-content">${selected.content || `<p>${escapeHtml(selected.excerpt || 'Article content will be updated soon.')}</p>`}</div>
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

  let runtimeStarted = false;
  let runtimeAttempts = 0;

  function hasEnoughDomToStart() {
    if (!document.body) return false;
    const path = normalizePath(location.pathname);
    const needsPageRoot = pageBlueprints[path] || pageBlueprints[aliases[path]] || path === '/about';
    return !needsPageRoot || Boolean(findContentRoot());
  }

  async function init() {
    if (runtimeStarted) {
      installSharedShell();
      bindSharedShell();
      return;
    }
    if (!hasEnoughDomToStart()) return;
    runtimeStarted = true;
    installSharedShell();
    bindSharedShell();
    rebuildAboutPage();
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
    if (!runtimeStarted && runtimeAttempts < 600) {
      runtimeAttempts += 1;
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
