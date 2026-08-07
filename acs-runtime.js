(function () {
  const siteState = { data: null };

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
      const noscript = document.createElement('noscript');
      noscript.dataset.acsGtm = 'true';
      noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${settings.gtmContainerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
      document.body.insertBefore(noscript, document.body.firstChild);
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
    fetch('/api/public', {
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
        <section class="acs-career-role">
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
          <div class="acs-career-actions"><a href="mailto:${applyEmail}?subject=Application for ${encodeURIComponent(job.title || 'ACS Engitech role')}">Apply Now <span aria-hidden="true">&rarr;</span></a></div>
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
        <article class="acs-blog-article">
          <a class="acs-blog-back" href="/blog">Back to blogs</a>
          <div class="acs-blog-article-hero">
            <p class="acs-kicker">${new Date(selected.publishedAt).toLocaleDateString()} - ${escapeHtml(selected.author || 'ACS Engitech')} - ${selected.readingMinutes || 1} min read</p>
            <h1>${escapeHtml(selected.title)}</h1>
            <p class="acs-lead">${escapeHtml(selected.excerpt || '')}</p>
          </div>
          ${selected.coverImage ? `<img src="${selected.coverImage}" alt="${escapeHtml(selected.coverAlt || selected.title)}">` : ''}
          <div class="acs-blog-content-card">
            <div class="acs-blog-content">${selected.content || `<p>${escapeHtml(selected.excerpt || 'Article content will be updated soon.')}</p>`}</div>
          </div>
        </article>`;
      return;
    }
    root.innerHTML = `
      <div class="acs-dynamic-inner acs-blog-index">
        <div class="acs-blog-hero">
          <p class="acs-kicker">ACS insights</p>
          <h1>Industrial automation blog</h1>
          <p class="acs-lead">PLC, SCADA, control panel, and industrial automation notes from ACS Engitech.</p>
        </div>
        <div class="acs-blog-list">
          ${visiblePosts.map((post) => `
            <article class="acs-blog-card">
              ${post.coverImage ? `<img src="${post.coverImage}" alt="${post.coverAlt || post.title}">` : '<div class="acs-blog-mark" aria-hidden="true">ACS</div>'}
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

  async function init() {
    injectBlogNav();
    try {
      const path = encodeURIComponent(normalizePath(location.pathname));
      const response = await fetch(`/api/public?path=${path}`);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
