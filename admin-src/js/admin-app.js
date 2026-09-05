(function () {
  const state = {
    pages: [],
    pageSeo: {},
    posts: [],
    jobs: [],
    settings: {},
    analytics: {},
    selectedPage: '/',
    selectedPost: null,
    selectedJob: null,
    postFilter: 'all',
    email: '',
    password: '',
    authenticated: false,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const statusBar = $('#statusBar');
  const loginForm = $('#loginForm');
  const loginError = $('#loginError');
  const adminLoading = $('#adminLoading');

  function setStatus(message, type) {
    statusBar.textContent = message;
    statusBar.className = `status-bar ${type || ''}`;
  }

  function setBusy(isBusy, message) {
    document.body.classList.toggle('admin-busy', isBusy);
    adminLoading?.classList.toggle('is-visible', isBusy);
    if (adminLoading) {
      adminLoading.setAttribute('aria-hidden', String(!isBusy));
      const label = adminLoading.querySelector('strong');
      if (label) label.textContent = message || 'Working...';
    }
    statusBar.classList.toggle('is-loading', isBusy);
  }

  function showSignIn(message) {
    document.body.classList.add('admin-locked');
    state.authenticated = false;
    state.email = '';
    state.password = '';
    setLoginLoading(false);
    if (loginForm) loginForm.reset();
    if (loginError) loginError.textContent = message || '';
    setTimeout(() => loginForm?.email?.focus(), 0);
  }

  function hideSignIn() {
    document.body.classList.remove('admin-locked');
    if (loginError) loginError.textContent = '';
  }

  function setLoginLoading(isLoading) {
    const button = loginForm?.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Signing in...' : 'Sign in';
    loginForm.classList.toggle('is-loading', isLoading);
  }

  function authHeaders() {
    return state.email && state.password ? { 'x-admin-email': state.email, 'x-admin-password': state.password } : {};
  }

  function resolveApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const localHost = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (location.protocol === 'file:' || (localHost && location.port && location.port !== '3000')) {
      return `http://localhost:3000${path}`;
    }
    return path;
  }

  async function api(path, options = {}) {
    const response = await fetch(resolveApiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const error = new Error(data.error || 'Invalid admin email or password');
      error.code = 'AUTH_REQUIRED';
      throw error;
    }
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
  }

  function displayPath(value) {
    const path = String(value || '/').replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '');
    return path || '/';
  }

  function normalizePost(post) {
    const content = post.content || '';
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const publishedAt = post.publishedAt || new Date().toISOString();
    const publishDate = new Date(publishedAt);
    const selectedStatus = post.status || 'published';
    const status = selectedStatus === 'draft' ? 'draft' : publishDate > new Date() ? 'scheduled' : selectedStatus;
    return {
      ...post,
      id: post.id || crypto.randomUUID(),
      title: (post.title || 'Untitled post').trim(),
      slug: slugify(post.slug || post.title),
      excerpt: (post.excerpt || text.slice(0, 180)).trim(),
      author: (post.author || 'ACS Engitech').trim(),
      tags: Array.isArray(post.tags) ? post.tags : String(post.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      status,
      publishedAt: new Date(publishedAt).toISOString(),
      readingMinutes: Math.max(1, Math.ceil((text ? text.split(/\s+/).length : 1) / 220)),
      seo: {
        title: post.metaTitle || post.seo?.title || post.title,
        description: post.metaDescription || post.seo?.description || post.excerpt || text.slice(0, 155),
      },
    };
  }

  function toDatetimeLocal(value) {
    const date = value ? new Date(value) : new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  async function load() {
    if (!state.email || !state.password) {
      showSignIn();
      return;
    }
    setBusy(true, 'Loading admin data...');
    setStatus('Loading admin data...');
    try {
      const days = $('#analyticsDays')?.value || 30;
      const data = await api(`/api/admin?days=${days}`);
      state.pages = data.pages || [];
      state.pageSeo = Object.fromEntries(state.pages.map((page) => [page.path, page.seo || {}]));
      state.posts = data.posts || [];
      state.jobs = data.jobs || [];
      state.settings = data.settings || {};
      state.analytics = data.analytics || {};
      state.authenticated = true;
      state.selectedPage ||= state.pages[0]?.path || '/';
      state.selectedPost ||= state.posts[0]?.id || null;
      state.selectedJob ||= state.jobs[0]?.id || null;
      render();
      hideSignIn();
      setStatus('All changes are loaded.', 'ok');
    } catch (error) {
      render();
      if (error.code === 'AUTH_REQUIRED') {
        showSignIn(error.message);
      } else {
        setStatus('Admin data could not be loaded. Start the local dev server or check the Neon/Vercel connection.', 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function save(payload, message) {
    setBusy(true, 'Saving changes...');
    setStatus('Saving changes...');
    try {
      const data = await api('/api/admin', { method: 'POST', body: JSON.stringify(payload) });
      state.pages = data.pages || state.pages;
      state.pageSeo = Object.fromEntries(state.pages.map((page) => [page.path, page.seo || {}]));
      state.posts = data.posts || state.posts;
      state.jobs = data.jobs || state.jobs;
      state.settings = data.settings || state.settings;
      render();
      setStatus(message || 'Saved.', 'ok');
    } catch (error) {
      if (error.code === 'AUTH_REQUIRED') showSignIn(error.message);
      setStatus(error.message || 'Could not save changes.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const METRIC_ICONS = {
    grid: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 3.25C4.257 3.25 3.25 4.257 3.25 5.5V9c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V5.5c0-1.243-1.007-2.25-2.25-2.25h-3.5Zm9 0c-1.243 0-2.25 1.007-2.25 2.25V9c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V5.5c0-1.243-1.007-2.25-2.25-2.25h-3.5ZM5.5 12.75c-1.243 0-2.25 1.007-2.25 2.25v3.5c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V15c0-1.243-1.007-2.25-2.25-2.25h-3.5Zm9 0c-1.243 0-2.25 1.007-2.25 2.25v3.5c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V15c0-1.243-1.007-2.25-2.25-2.25h-3.5Z"/>',
    doc: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 3.25C5.257 3.25 4.25 4.257 4.25 5.5v13c0 1.243 1.007 2.25 2.25 2.25h11c1.243 0 2.25-1.007 2.25-2.25V9.31a2.25 2.25 0 0 0-.659-1.591l-3.81-3.81a2.25 2.25 0 0 0-1.591-.659H6.5Zm1.25 8.5a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75Zm.75 3.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"/>',
    clock: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12.75 7a.75.75 0 0 0-1.5 0v5c0 .199.079.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V7Z"/>',
    briefcase: '<path fill-rule="evenodd" clip-rule="evenodd" d="M9 3.75c-1.243 0-2.25 1.007-2.25 2.25v.75H5.5c-1.243 0-2.25 1.007-2.25 2.25v8.25c0 1.243 1.007 2.25 2.25 2.25h13c1.243 0 2.25-1.007 2.25-2.25V9c0-1.243-1.007-2.25-2.25-2.25h-1.25V6c0-1.243-1.007-2.25-2.25-2.25H9Zm6.25 3V6a.75.75 0 0 0-.75-.75H9a.75.75 0 0 0-.75.75v.75h6.5ZM4.75 12.5h14.5v4.5a.75.75 0 0 1-.75.75h-13a.75.75 0 0 1-.75-.75v-4.5Z"/>',
    chart: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3.25a.75.75 0 0 1 .75.75v14.5H20a.75.75 0 0 1 0 1.5H5A1.75 1.75 0 0 1 3.25 18.25V4A.75.75 0 0 1 5 3.25ZM18.5 8a1 1 0 0 1 1 1v7.25a.75.75 0 0 1-1.5 0V9a1 1 0 0 1 1-1Zm-4.5 3a1 1 0 0 1 1 1v4.25a.75.75 0 0 1-1.5 0V12a1 1 0 0 1 1-1Zm-4.5 2a1 1 0 0 1 1 1v2.25a.75.75 0 0 1-1.5 0V14a1 1 0 0 1 1-1Z"/>',
    devices: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.75 5.5c0-1.243 1.007-2.25 2.25-2.25h10c1.243 0 2.25 1.007 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25H13v1.5h2.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5H11v-1.5H7A2.25 2.25 0 0 1 4.75 14.5v-9ZM7 4.75a.75.75 0 0 0-.75.75v8.25c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75V5.5a.75.75 0 0 0-.75-.75H7Z"/>',
  };

  function metric(label, value, icon) {
    const path = METRIC_ICONS[icon] || METRIC_ICONS.grid;
    return `<article class="metric"><svg class="metric-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${path}</svg><div class="mt-0 flex items-end justify-between"><div><span>${label}</span><strong>${value}</strong></div></div></article>`;
  }

  function renderOverview() {
    const published = state.posts.filter((post) => post.status === 'published').length;
    const scheduled = state.posts.filter((post) => post.status === 'scheduled').length;
    const openJobs = state.jobs.filter((job) => job.status === 'open').length;
    $('#overviewMetrics').innerHTML = [
      metric('SEO pages', state.pages.length, 'grid'),
      metric('Published blogs', published, 'doc'),
      metric('Scheduled blogs', scheduled, 'clock'),
      metric('Open roles', openJobs, 'briefcase'),
    ].join('');
  }

  function renderSeo() {
    $('#pageList').innerHTML = state.pages.map((page) => `
      <button class="row-card ${page.path === state.selectedPage ? 'active' : ''}" data-page="${page.path}" type="button">
        <strong>${page.label}</strong>
        <span class="row-path">${displayPath(page.path)}</span>
        <span class="block truncate text-gray-500">${(state.pageSeo[page.path]?.title || page.defaults.title || '').slice(0, 90)}</span>
      </button>
    `).join('');

    const page = state.pages.find((item) => item.path === state.selectedPage) || state.pages[0];
    const seo = { ...(page?.defaults || {}), ...(state.pageSeo[page?.path] || {}) };
    $('#seoFormTitle').textContent = page ? `${page.label} SEO` : 'Select a page';
    for (const field of $('#seoForm').elements) {
      if (field.name) field.value = seo[field.name] || '';
    }
  }

  function renderPosts() {
    const posts = state.postFilter === 'all' ? state.posts : state.posts.filter((post) => post.status === state.postFilter);
    $('#postList').innerHTML = posts.map((post) => `
      <button class="row-card ${post.id === state.selectedPost ? 'active' : ''}" data-post="${post.id}" type="button">
        <strong>${post.title} <span class="status-pill status-${post.status}">${post.status}</span></strong>
        <span class="row-path">${new Date(post.publishedAt).toLocaleDateString()} - /blog?post=${post.slug}</span>
        <span class="row-tags">${(post.tags || []).map((tag) => `<span class="tag-chip">${tag}</span>`).join('')}</span>
      </button>
    `).join('') || '<p class="empty-state">No posts in this view.</p>';
    $$('.filters button').forEach((button) => button.classList.toggle('active', button.dataset.postFilter === state.postFilter));
    fillPostForm();
  }

  function fillPostForm() {
    const post = state.posts.find((item) => item.id === state.selectedPost) || {};
    const form = $('#postForm');
    form.title.value = post.title || '';
    form.slug.value = post.slug || '';
    form.publishedAt.value = toDatetimeLocal(post.publishedAt);
    form.excerpt.value = post.excerpt || '';
    form.author.value = post.author || 'ACS Engitech';
    form.tags.value = (post.tags || []).join(', ');
    form.coverImage.value = post.coverImage || '';
    form.coverAlt.value = post.coverAlt || '';
    form.content.value = post.content || '';
    form.metaTitle.value = post.seo?.title || '';
    form.metaDescription.value = post.seo?.description || '';
    form.status.value = post.status || 'published';
    $('#previewPostLink').href = `/blog?post=${post.slug || ''}`;
  }

  function renderJobs() {
    $('#jobList').innerHTML = state.jobs.map((job) => `
      <button class="row-card ${job.id === state.selectedJob ? 'active' : ''}" data-job="${job.id}" type="button">
        <strong>${job.title} <span class="status-pill status-${job.status}">${job.status}</span></strong>
        <span class="row-path">${job.department || ''} - ${job.location || ''}</span>
      </button>
    `).join('') || '<p class="empty-state">No roles yet.</p>';
    fillJobForm();
  }

  function fillJobForm() {
    const job = state.jobs.find((item) => item.id === state.selectedJob) || {};
    const form = $('#jobForm');
    ['title', 'department', 'location', 'type', 'experience', 'qualification', 'description', 'vacancies', 'gender', 'hardSkills', 'softSkills', 'applyEmail'].forEach((name) => {
      form[name].value = job[name] || '';
    });
    form.responsibilities.value = Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : job.responsibilities || '';
    form.status.value = job.status || 'open';
  }

  function renderAnalytics() {
    const analytics = state.analytics || {};
    const devices = analytics.devices || {};
    const tagForm = $('#analyticsTagForm');
    ['gaMeasurementId', 'gtmContainerId'].forEach((name) => {
      tagForm[name].value = state.settings[name] || '';
    });
    $('#analyticsMetrics').innerHTML = [
      metric('Page views', analytics.pageViews || 0, 'chart'),
      metric('Unique visitors', analytics.uniqueVisitors || 0, 'grid'),
      metric('Avg views / day', analytics.avgViewsPerDay || 0, 'clock'),
      metric('Devices', `D ${devices.desktop || 0} / M ${devices.mobile || 0}`, 'devices'),
    ].join('');

    const peak = Math.max(1, ...(analytics.daily || []).map((day) => day.views));
    $('#dailyChart').innerHTML = (analytics.daily || []).length
      ? (analytics.daily || []).map((day) => `<div class="bar" title="${day.date}: ${day.views}" style="height:${Math.max(6, (day.views / peak) * 100)}%"></div>`).join('')
      : '<p class="empty-state">No page views yet.</p>';
    $('#topPages').innerHTML = rows((analytics.topPages || []).map((row) => [row.path, row.views]));
    $('#topReferrers').innerHTML = rows((analytics.topReferrers || []).map((row) => [row.source, row.views]));
  }

  function rows(items) {
    return items.map(([label, value]) => `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`).join('') || '<p class="empty-state">No data yet.</p>';
  }

  function renderSettings() {
    const form = $('#settingsForm');
    ['robotsTxt', 'llmsIntro'].forEach((name) => {
      form[name].value = state.settings[name] || '';
    });
  }

  function render() {
    renderOverview();
    renderSeo();
    renderPosts();
    renderJobs();
    renderAnalytics();
    renderSettings();
  }

  function collectSeo() {
    const form = $('#seoForm');
    state.pageSeo[state.selectedPage] = Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.value.trim()]));
  }

  function collectSettings() {
    return {
      ...state.settings,
      ...collectAnalyticsTags(),
      ...collectCrawlerSettings(),
    };
  }

  function collectAnalyticsTags() {
    const form = $('#analyticsTagForm');
    return Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.value.trim()]));
  }

  function collectCrawlerSettings() {
    const form = $('#settingsForm');
    return Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.value.trim()]));
  }

  function bindEvents() {
    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      state.email = form.email.value.trim();
      state.password = form.password.value;
      if (loginError) loginError.textContent = '';
      setLoginLoading(true);
      try {
        await load();
      } finally {
        setLoginLoading(false);
      }
    });

    $('#logoutBtn')?.addEventListener('click', () => {
      showSignIn('Signed out.');
    });

    $('#pageList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-page]');
      if (!button) return;
      collectSeo();
      state.selectedPage = button.dataset.page;
      renderSeo();
    });

    $('#postList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-post]');
      if (!button) return;
      state.selectedPost = button.dataset.post;
      renderPosts();
    });

    $('#jobList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-job]');
      if (!button) return;
      state.selectedJob = button.dataset.job;
      renderJobs();
    });

    $$('.filters button').forEach((button) => button.addEventListener('click', () => {
      state.postFilter = button.dataset.postFilter;
      renderPosts();
    }));

    $('#newPostBtn').addEventListener('click', () => {
      const post = normalizePost({ id: crypto.randomUUID(), title: 'New ACS Engitech blog post', status: 'draft', publishedAt: new Date().toISOString() });
      state.posts.unshift(post);
      state.selectedPost = post.id;
      renderPosts();
    });

    $('#postForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const post = normalizePost({
        id: state.selectedPost,
        title: form.title.value,
        slug: form.slug.value,
        publishedAt: form.publishedAt.value,
        excerpt: form.excerpt.value,
        author: form.author.value,
        tags: form.tags.value,
        coverImage: form.coverImage.value,
        coverAlt: form.coverAlt.value,
        content: form.content.value,
        status: form.status.value,
        metaTitle: form.metaTitle.value,
        metaDescription: form.metaDescription.value,
      });
      state.posts = [post, ...state.posts.filter((item) => item.id !== post.id)];
      state.selectedPost = post.id;
      await save({ posts: state.posts }, 'Post saved.');
    });

    $('#deletePostBtn').addEventListener('click', async () => {
      if (!state.selectedPost || !confirm('Delete this post?')) return;
      state.posts = state.posts.filter((post) => post.id !== state.selectedPost);
      state.selectedPost = state.posts[0]?.id || null;
      await save({ posts: state.posts }, 'Post deleted.');
    });

    $('#newJobBtn').addEventListener('click', () => {
      const job = { id: crypto.randomUUID(), title: 'New role', department: 'Automation', location: 'Ahmedabad, Gujarat', type: 'Full time', vacancies: '1', gender: 'Open', responsibilities: [], status: 'open', applyEmail: 'sales@acsengitech.com' };
      state.jobs.unshift(job);
      state.selectedJob = job.id;
      renderJobs();
    });

    $('#jobForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const job = {
        id: state.selectedJob || crypto.randomUUID(),
        title: form.title.value.trim(),
        department: form.department.value.trim(),
        location: form.location.value.trim(),
        type: form.type.value.trim(),
        experience: form.experience.value.trim(),
        qualification: form.qualification.value.trim(),
        description: form.description.value.trim(),
        vacancies: form.vacancies.value.trim(),
        gender: form.gender.value.trim(),
        responsibilities: form.responsibilities.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        hardSkills: form.hardSkills.value.trim(),
        softSkills: form.softSkills.value.trim(),
        applyEmail: form.applyEmail.value.trim(),
        status: form.status.value,
      };
      state.jobs = [job, ...state.jobs.filter((item) => item.id !== job.id)];
      state.selectedJob = job.id;
      await save({ jobs: state.jobs }, 'Role saved.');
    });

    $('#deleteJobBtn').addEventListener('click', async () => {
      if (!state.selectedJob || !confirm('Delete this role?')) return;
      state.jobs = state.jobs.filter((job) => job.id !== state.selectedJob);
      state.selectedJob = state.jobs[0]?.id || null;
      await save({ jobs: state.jobs }, 'Role deleted.');
    });

    $('#saveSeoBtn').addEventListener('click', async () => {
      collectSeo();
      await save({ pageSeo: state.pageSeo }, 'SEO saved.');
    });
    $('#saveAnalyticsTagsBtn').addEventListener('click', async () => save({ settings: { ...state.settings, ...collectAnalyticsTags() } }, 'Analytics tags saved.'));
    $('#saveSettingsBtn').addEventListener('click', async () => save({ settings: { ...state.settings, ...collectCrawlerSettings() } }, 'Crawler settings saved.'));
    $('#saveAllTop').addEventListener('click', async () => {
      collectSeo();
      await save({ pageSeo: state.pageSeo, posts: state.posts, jobs: state.jobs, settings: collectSettings() }, 'All changes saved.');
    });
    $('#refreshBtn').addEventListener('click', load);
    $('#analyticsDays').addEventListener('change', load);
  }

  bindEvents();
  load();
}());
