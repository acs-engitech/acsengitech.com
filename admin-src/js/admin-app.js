// Shared with the serverless functions so previews match what /llms.txt and /sitemap.xml serve.
import adminCore from '../../lib/admin-core.js';
import acsDefaults from '../../lib/acs-defaults.js';

(function () {
  const { buildLlmsTxt, buildSitemap, SITE_URL } = adminCore;
  const { DEFAULT_SETTINGS } = acsDefaults;

  const state = {
    pages: [],
    pageSeo: {},
    posts: [],
    positions: [],
    positionTypes: [],
    enquiries: [],
    applications: [],
    partners: [],
    partnerCategories: [],
    settings: {},
    analytics: {},
    selectedPage: '/',
    selectedPost: null,
    selectedPosition: null,
    selectedEnquiry: null,
    selectedApplication: null,
    selectedPartner: null,
    postFilter: 'all',
    postSearch: '',
    positionSearch: '',
    enquiryFilters: { status: 'all', from: '', to: '', search: '' },
    applicationFilters: { status: 'all', positionId: '', from: '', to: '', search: '' },
    partnerFilters: { status: 'all', category: '', from: '', to: '', search: '' },
    enquirySelectedIds: new Set(),
    applicationSelectedIds: new Set(),
    partnerSelectedIds: new Set(),
    seoSearch: '',
    seoGroup: 'all',
    seoEditorTab: 'essentials',
    typeManagerTarget: null, // 'positionTypes' | 'partnerCategories'
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
  let statusTimer;

  function setStatus(message, type) {
    clearTimeout(statusTimer);
    statusBar.textContent = message;
    statusBar.className = `status-bar is-visible ${type || ''}`;
    // Reflow restarts the entry animation for consecutive saves instead of silently
    // leaving the previous success toast hidden or half-faded.
    void statusBar.offsetWidth;
    if (type === 'ok') statusTimer = setTimeout(() => statusBar.classList.remove('is-visible'), 4200);
  }

  // ---------- Session persistence (survives page refresh; never stores the raw password) ----------

  const SESSION_KEY = 'acsAdminSession';

  function getStoredSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.token || !session?.email || !session?.expiresAt) return null;
      if (Date.now() >= session.expiresAt) return null;
      return session;
    } catch {
      return null;
    }
  }

  function hasValidSession() {
    return !!getStoredSession();
  }

  function storeSession(data) {
    if (!data?.sessionToken || !data?.sessionExpiresAt) return;
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ email: state.email, token: data.sessionToken, expiresAt: data.sessionExpiresAt }));
    } catch {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
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
    document.body.classList.add('admin-booted'); // reveal (drop the boot cover) — login is the answer
    document.body.classList.add('admin-locked');
    state.authenticated = false;
    state.email = '';
    state.password = '';
    clearSession();
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
    const session = getStoredSession();
    if (session) return { 'x-admin-session': session.token, 'x-admin-email': session.email };
    if (state.email && state.password) return { 'x-admin-email': state.email, 'x-admin-password': state.password };
    return {};
  }

  function resolveApiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    if (location.protocol === 'file:') {
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
    storeSession(data);
    return data;
  }

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
  }

  function displayPath(value) {
    const path = String(value || '/').replace(/\/index\.html$/i, '/').replace(/\.html$/i, '').replace(/\/$/, '');
    return path || '/';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  }

  // Safe href for user-submitted URLs: escapes for HTML-attribute context AND
  // rejects any scheme that is not http/https (blocks javascript:, data:, etc.).
  function safeHref(value) {
    const raw = String(value ?? '').trim();
    if (!/^https?:\/\//i.test(raw)) return '#';
    return escapeHtml(raw);
  }

  function normalizePost(post) {
    const content = post.content || '';
    const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const publishedAt = post.publishedAt || new Date().toISOString();
    const publishDate = new Date(publishedAt);
    const selectedStatus = post.status || 'published';
    const status = selectedStatus === 'draft' ? 'draft' : publishDate > new Date() ? 'scheduled' : 'published';
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
    if (!state.email || (!state.password && !hasValidSession())) {
      showSignIn();
      return;
    }
    // A valid session is enough to proceed — hide the sign-in screen up front so
    // it never flashes while the (cold-start-slow) initial API call is pending.
    // If the request comes back 401, the catch block re-shows sign-in.
    if (hasValidSession()) hideSignIn();
    setBusy(true, 'Loading admin data...');
    setStatus('Loading admin data...');
    try {
      const days = $('#analyticsDays')?.value || 30;
      const data = await api(`/api/admin?days=${days}`);
      applyData(data);
      state.authenticated = true;
      state.selectedPage ||= state.pages[0]?.path || '/';
      state.selectedPost ||= state.posts[0]?.id || null;
      state.selectedPosition ||= state.positions[0]?.id || null;
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
      document.body.classList.add('admin-booted'); // data resolved (ok or error) — reveal the workspace
      setBusy(false);
    }
  }

  function applyData(data) {
    state.pages = data.pages || state.pages;
    state.pageSeo = Object.fromEntries(state.pages.map((page) => [page.path, page.seo || {}]));
    // A scheduled post whose time has passed is live on the site; show it as published.
    state.posts = (data.posts || state.posts).map((post) => (post.status === 'scheduled' && new Date(post.publishedAt) <= new Date() ? { ...post, status: 'published' } : post));
    state.positions = data.positions || state.positions;
    state.positionTypes = data.positionTypes || state.positionTypes;
    state.enquiries = data.enquiries || state.enquiries;
    state.applications = data.applications || state.applications;
    state.partners = data.partners || state.partners;
    state.partnerCategories = data.partnerCategories || state.partnerCategories;
    state.settings = data.settings || state.settings;
    if (data.analytics) state.analytics = data.analytics;
    if (data.access) applyAccess(data.access);
  }

  // Staff accounts see only their own sections (the server enforces the same split); directors see
  // everything plus the links into the operations platform.
  function applyAccess(access) {
    const all = access.sections === 'all';
    const allowed = new Set(['overview', ...(all ? [] : access.sections)]);
    $$('.nav-btn[data-tab]').forEach((button) => { button.hidden = !all && !allowed.has(button.dataset.tab); });
    $$('.nav-group-label').forEach((label) => {
      let next = label.nextElementSibling;
      let visible = false;
      while (next && !next.classList.contains('nav-group-label')) {
        if (next.matches('.nav-btn[data-tab]') && !next.hidden) visible = true;
        next = next.nextElementSibling;
      }
      if (!label.closest('[data-ops-nav]')) label.hidden = !all && !visible;
    });
    const opsNav = $('[data-ops-nav]');
    if (opsNav) opsNav.hidden = access.role !== 'director';
  }

  async function save(payload, message) {
    setBusy(true, 'Saving changes...');
    setStatus('Saving changes...');
    try {
      const data = await api('/api/admin', { method: 'POST', body: JSON.stringify(payload) });
      applyData(data);
      render();
      setStatus(message || 'Saved.', 'ok');
    } catch (error) {
      if (error.code === 'AUTH_REQUIRED') showSignIn(error.message);
      setStatus(error.message || 'Could not save changes.', 'error');
    } finally {
      setBusy(false);
    }
  }

  // Optimistic mutation: applies the change to `state` and re-renders instantly, then fires the
  // request in the background. No setBusy() here on purpose — that's the blocking full-screen
  // overlay, and optimistic actions should feel instant with no spinner. On failure, reverts.
  async function mutate({ apply, rerender, request, successMessage, revert }) {
    apply();
    rerender();
    setStatus('Saving changes…', 'loading');
    try {
      const data = await request();
      applyData(data);
      rerender();
      setStatus(successMessage || 'Saved.', 'ok');
    } catch (error) {
      if (revert) { revert(); rerender(); }
      if (error.code === 'AUTH_REQUIRED') showSignIn(error.message);
      setStatus(error.message || 'Could not save changes.', 'error');
    }
  }

  const METRIC_ICONS = {
    grid: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 3.25C4.257 3.25 3.25 4.257 3.25 5.5V9c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V5.5c0-1.243-1.007-2.25-2.25-2.25h-3.5Zm9 0c-1.243 0-2.25 1.007-2.25 2.25V9c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V5.5c0-1.243-1.007-2.25-2.25-2.25h-3.5ZM5.5 12.75c-1.243 0-2.25 1.007-2.25 2.25v3.5c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V15c0-1.243-1.007-2.25-2.25-2.25h-3.5Zm9 0c-1.243 0-2.25 1.007-2.25 2.25v3.5c0 1.243 1.007 2.25 2.25 2.25h3.5c1.243 0 2.25-1.007 2.25-2.25V15c0-1.243-1.007-2.25-2.25-2.25h-3.5Z"/>',
    doc: '<path fill-rule="evenodd" clip-rule="evenodd" d="M6.5 3.25C5.257 3.25 4.25 4.257 4.25 5.5v13c0 1.243 1.007 2.25 2.25 2.25h11c1.243 0 2.25-1.007 2.25-2.25V9.31a2.25 2.25 0 0 0-.659-1.591l-3.81-3.81a2.25 2.25 0 0 0-1.591-.659H6.5Zm1.25 8.5a.75.75 0 0 1 .75-.75h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1-.75-.75Zm.75 3.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z"/>',
    clock: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12.75 7a.75.75 0 0 0-1.5 0v5c0 .199.079.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V7Z"/>',
    briefcase: '<path fill-rule="evenodd" clip-rule="evenodd" d="M9 3.75c-1.243 0-2.25 1.007-2.25 2.25v.75H5.5c-1.243 0-2.25 1.007-2.25 2.25v8.25c0 1.243 1.007 2.25 2.25 2.25h13c1.243 0 2.25-1.007 2.25-2.25V9c0-1.243-1.007-2.25-2.25-2.25h-1.25V6c0-1.243-1.007-2.25-2.25-2.25H9Zm6.25 3V6a.75.75 0 0 0-.75-.75H9a.75.75 0 0 0-.75.75v.75h6.5ZM4.75 12.5h14.5v4.5a.75.75 0 0 1-.75.75h-13a.75.75 0 0 1-.75-.75v-4.5Z"/>',
    chart: '<path fill-rule="evenodd" clip-rule="evenodd" d="M5 3.25a.75.75 0 0 1 .75.75v14.5H20a.75.75 0 0 1 0 1.5H5A1.75 1.75 0 0 1 3.25 18.25V4A.75.75 0 0 1 5 3.25ZM18.5 8a1 1 0 0 1 1 1v7.25a.75.75 0 0 1-1.5 0V9a1 1 0 0 1 1-1Zm-4.5 3a1 1 0 0 1 1 1v4.25a.75.75 0 0 1-1.5 0V12a1 1 0 0 1 1-1Zm-4.5 2a1 1 0 0 1 1 1v2.25a.75.75 0 0 1-1.5 0V14a1 1 0 0 1 1-1Z"/>',
    devices: '<path fill-rule="evenodd" clip-rule="evenodd" d="M4.75 5.5c0-1.243 1.007-2.25 2.25-2.25h10c1.243 0 2.25 1.007 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25H13v1.5h2.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5H11v-1.5H7A2.25 2.25 0 0 1 4.75 14.5v-9ZM7 4.75a.75.75 0 0 0-.75.75v8.25c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75V5.5a.75.75 0 0 0-.75-.75H7Z"/>',
    user: '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm-7.25 8a7.25 7.25 0 0 1 14.5 0 .75.75 0 0 1-.75.75H5.5a.75.75 0 0 1-.75-.75Z"/>',
  };

  function metric(label, value, icon, tone) {
    const path = METRIC_ICONS[icon] || METRIC_ICONS.grid;
    const toneClass = 'metric-icon-' + (tone || 'brand');
    return `<article class="metric"><div class="metric-icon ${toneClass}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${path}</svg></div><div class="metric-body"><div><span>${label}</span><strong>${value}</strong></div></div></article>`;
  }

  function renderOverview() {
    const published = state.posts.filter((post) => post.status === 'published').length;
    const scheduled = state.posts.filter((post) => post.status === 'scheduled').length;
    const openPositions = state.positions.filter((position) => position.status !== 'closed').length;
    const newEnquiries = state.enquiries.filter((enquiry) => enquiry.status === 'new').length;
    const newApplications = state.applications.filter((app) => app.status === 'new').length;
    const newPartners = state.partners.filter((partner) => partner.status === 'new').length;
    $('#overviewMetrics').innerHTML = [
      metric('SEO pages', state.pages.length, 'grid', 'brand'),
      metric('Published blogs', published, 'doc', 'success'),
      metric('Scheduled blogs', scheduled, 'clock', 'warning'),
      metric('SEO pages with JSON-LD', state.pages.filter((page) => (state.pageSeo[page.path]?.jsonLd || page.defaults?.jsonLd)).length, 'grid', 'info'),
      metric('Open positions', openPositions, 'briefcase', 'info'),
      metric('New enquiries', newEnquiries, 'doc', 'warning'),
      metric('Total enquiries', state.enquiries.length, 'doc', 'brand'),
      metric('New applications', newApplications, 'user', 'warning'),
      metric('Total applications', state.applications.length, 'user', 'brand'),
      metric('New partner registrations', newPartners, 'briefcase', 'warning'),
      metric('Total partners', state.partners.length, 'briefcase', 'brand'),
    ].join('');
  }

  function seoPageGroup(page) {
    if (page.path === '/trading' || page.path.startsWith('/siemens-') || page.path === '/accessories') return 'trading';
    if (['/blog', '/career', '/partner-with-us', '/contact', '/privacy', '/certificates', '/photo-gallery'].includes(page.path)) return 'content';
    return 'core';
  }

  function renderSeoPageList() {
    const query = state.seoSearch.trim().toLowerCase();
    const pages = state.pages.filter((page) => {
      const searchable = `${page.label} ${page.path} ${page.defaults?.title || ''}`.toLowerCase();
      return (state.seoGroup === 'all' || seoPageGroup(page) === state.seoGroup) && (!query || searchable.includes(query));
    });
    $('#seoPageCount').textContent = `${pages.length} of ${state.pages.length}`;
    $('#pageList').innerHTML = pages.map((page) => `
      <button class="row-card ${page.path === state.selectedPage ? 'active' : ''}" data-page="${page.path}" type="button">
        <strong>${page.label}</strong>
        <span class="row-path">${displayPath(page.path)}</span>
        <span class="block truncate text-gray-500">${(state.pageSeo[page.path]?.title || page.defaults.title || '').slice(0, 90)}</span>
      </button>
    `).join('') || '<p class="empty-state">No pages match this filter.</p>';
  }

  function renderSeo() {
    renderSeoPageList();

    const page = state.pages.find((item) => item.path === state.selectedPage) || state.pages[0];
    const seo = { ...(page?.defaults || {}), ...(state.pageSeo[page?.path] || {}) };
    $('#seoFormTitle').textContent = page ? `${page.label} SEO` : 'Select a page';
    for (const field of $('#seoForm').elements) {
      if (field.name) field.value = seo[field.name] || '';
    }
    $('#seoViewPage').href = page ? (page.path === '/' ? '/' : page.path) : '/';
    $('#jsonLdStatus').textContent = '';
    updateSeoInsights();
    renderSeoEditorTab();
  }

  function renderSeoEditorTab() {
    $$('[data-seo-editor-tab]').forEach((tab) => {
      const active = tab.dataset.seoEditorTab === state.seoEditorTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    $$('[data-seo-editor-panel]').forEach((panel) => {
      const active = panel.dataset.seoEditorPanel === state.seoEditorTab;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
  }

  function seoFormValues() {
    return Object.fromEntries(Array.from($('#seoForm').elements).filter((field) => field.name).map((field) => [field.name, field.value.trim()]));
  }

  // Live feedback while editing: character counts, search and social previews, and a short checklist.
  function updateSeoInsights() {
    const page = state.pages.find((item) => item.path === state.selectedPage) || state.pages[0];
    if (!page) return;
    const seo = seoFormValues();
    const url = seo.canonical || `${SITE_URL}${page.path === '/' ? '/' : page.path}`;
    $$('#seoForm [data-count-for]').forEach((counter) => {
      const length = (seo[counter.dataset.countFor] || '').length;
      const min = Number(counter.dataset.min), max = Number(counter.dataset.max);
      counter.textContent = `${length} / ${max}`;
      counter.className = `char-count ${!length ? 'is-bad' : length > max ? 'is-bad' : length < min ? 'is-warn' : 'is-good'}`;
    });
    const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trim()}…` : text);
    $('#serpUrl').textContent = url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\//g, ' › ');
    $('#serpTitle').textContent = clip(seo.title || page.label, 60);
    $('#serpDesc').textContent = clip(seo.description || 'Add a meta description so search engines show your summary instead of guessing one.', 160);
    const image = seo.ogImage || seo.twitterImage;
    $('#socialImage').style.backgroundImage = /^https?:\/\//.test(image) ? `url("${image.replace(/"/g, '%22')}")` : '';
    $('#socialTitle').textContent = seo.ogTitle || seo.title || page.label;
    $('#socialDesc').textContent = clip(seo.ogDescription || seo.description || '', 120);

    const keyword = seo.focusKeyword.toLowerCase();
    let jsonValid = !seo.jsonLd;
    try { if (seo.jsonLd) { JSON.parse(seo.jsonLd); jsonValid = true; } } catch { jsonValid = false; }
    const checks = [
      [seo.title.length >= 30 && seo.title.length <= 60, 'Title is 30 to 60 characters'],
      [seo.description.length >= 120 && seo.description.length <= 160, 'Meta description is 120 to 160 characters'],
      [!!keyword, 'Focus keyword is set'],
      [!!keyword && seo.title.toLowerCase().includes(keyword), 'Focus keyword appears in the title'],
      [!!keyword && seo.description.toLowerCase().includes(keyword), 'Focus keyword appears in the description'],
      [/^https:\/\//.test(seo.canonical), 'Canonical URL is an absolute https URL'],
      [!/noindex/i.test(seo.robots), 'Page can be indexed'],
      [/^https?:\/\//.test(image || ''), 'Social share image is set'],
      [!!seo.jsonLd && jsonValid, seo.jsonLd && !jsonValid ? 'JSON-LD is not valid JSON' : 'Structured data (JSON-LD) is present'],
    ];
    $('#seoChecks').innerHTML = checks.map(([ok, label]) => `<li class="${ok ? '' : 'is-fail'}">${escapeHtml(label)}</li>`).join('');
    $('#seoScore').textContent = `${checks.filter(([ok]) => ok).length}/${checks.length}`;
  }

  function jsonLdTemplate(type, page, seo) {
    const url = seo.canonical || `${SITE_URL}${page.path === '/' ? '/' : page.path}`;
    const org = { '@type': 'Organization', name: 'ACS Engitech Private Limited', url: SITE_URL, logo: `${SITE_URL}/logo-1.svg` };
    const address = { '@type': 'PostalAddress', streetAddress: 'A-98, Swayam Industrial Park, Opp. Gharda Ghar, Vill-Kuha, Taluka-Daskroi', addressLocality: 'Ahmedabad', addressRegion: 'Gujarat', postalCode: '382433', addressCountry: 'IN' };
    const templates = {
      Organization: { ...org, email: 'sales@acsengitech.com', telephone: '+91 70485 20058', address, sameAs: [] },
      LocalBusiness: { '@type': 'LocalBusiness', name: org.name, url: SITE_URL, image: seo.ogImage || `${SITE_URL}/logo-1.svg`, telephone: '+91 70485 20058', email: 'sales@acsengitech.com', address, openingHours: 'Mo-Sa 10:00-18:00', priceRange: '$$' },
      WebPage: { '@type': 'WebPage', name: seo.title || page.label, description: seo.description, url, isPartOf: { '@type': 'WebSite', name: 'ACS Engitech', url: SITE_URL }, publisher: org },
      Service: { '@type': 'Service', name: page.label, serviceType: page.label, description: seo.description, url, provider: org, areaServed: { '@type': 'Country', name: 'India' } },
      BreadcrumbList: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }, ...(page.path === '/' ? [] : [{ '@type': 'ListItem', position: 2, name: page.label, item: url }])] },
      FAQPage: { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Question?', acceptedAnswer: { '@type': 'Answer', text: 'Answer.' } }] },
      JobPosting: { '@type': 'JobPosting', title: 'Automation Engineer', description: 'Role description', datePosted: new Date().toISOString().slice(0, 10), employmentType: 'FULL_TIME', hiringOrganization: org, jobLocation: { '@type': 'Place', address } },
      Article: { '@type': 'Article', headline: seo.title || page.label, description: seo.description, image: seo.ogImage, author: org, publisher: org, datePublished: new Date().toISOString().slice(0, 10), mainEntityOfPage: url },
    };
    return JSON.stringify({ '@context': 'https://schema.org', ...templates[type] }, null, 2);
  }

  function filteredPosts() {
    const term = state.postSearch.trim().toLowerCase();
    return state.posts.filter((post) => (state.postFilter === 'all' || post.status === state.postFilter)
      && (!term || `${post.title} ${post.slug} ${(post.tags || []).join(' ')}`.toLowerCase().includes(term)));
  }

  function renderPostList() {
    const posts = filteredPosts();
    $('#postList').innerHTML = posts.map((post) => `
      <button class="row-card ${post.id === state.selectedPost ? 'active' : ''}" data-post="${post.id}" type="button">
        <strong>${post.title} <span class="status-pill status-${post.status}">${post.status}</span></strong>
        <span class="row-path">${new Date(post.publishedAt).toLocaleDateString()} - /blog?post=${post.slug}</span>
        <span class="row-tags">${(post.tags || []).map((tag) => `<span class="tag-chip">${tag}</span>`).join('')}</span>
      </button>
    `).join('') || '<p class="empty-state">No posts in this view.</p>';
    $('#postShownCount').textContent = `${posts.length} of ${state.posts.length} shown`;
  }

  function renderPosts() {
    renderPostList();
    $$('.filters button[data-post-filter]').forEach((button) => button.classList.toggle('active', button.dataset.postFilter === state.postFilter));
    renderSchedule();
    fillPostForm();
  }

  // Upcoming posts in publish order; a scheduled post whose time has passed is already live.
  function renderSchedule() {
    const now = Date.now();
    const upcoming = state.posts.filter((post) => post.status !== 'draft' && new Date(post.publishedAt).getTime() > now)
      .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    const relative = (date) => {
      const hours = Math.round((new Date(date).getTime() - now) / 36e5);
      return hours < 24 ? `in ${Math.max(1, hours)} h` : `in ${Math.round(hours / 24)} days`;
    };
    $('#scheduleList').innerHTML = upcoming.map((post) => `<li><button type="button" data-schedule-post="${escapeHtml(post.id)}">${escapeHtml(post.title)}</button><span class="schedule-when">${new Date(post.publishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · ${relative(post.publishedAt)}</span></li>`).join('')
      || '<li class="empty-state">Nothing scheduled. Set a future publish date on a post to schedule it.</li>';
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

  // ---------- Positions ----------

  function filteredPositions() {
    const term = state.positionSearch.trim().toLowerCase();
    return state.positions.filter((position) => !term || `${position.title} ${position.department} ${position.location} ${position.type}`.toLowerCase().includes(term));
  }

  function renderPositionList() {
    const positions = filteredPositions();
    $('#positionList').innerHTML = positions.map((position) => `
      <button class="row-card ${position.id === state.selectedPosition ? 'active' : ''}" data-position="${position.id}" type="button">
        <strong>${escapeHtml(position.title)} <span class="status-pill status-${position.status === 'closed' ? 'closed' : 'open'}">${position.status === 'closed' ? 'closed' : 'live'}</span></strong>
        <span class="row-path">${escapeHtml(position.type || 'Full-time')} - ${escapeHtml(position.department || '')} - ${escapeHtml(position.location || '')}</span>
      </button>
    `).join('') || '<p class="empty-state">No positions yet.</p>';
    $('#positionShownCount').textContent = `${positions.length} of ${state.positions.length} shown`;
  }

  function renderPositions() {
    renderPositionList();
    fillPositionTypeSelect();
    fillPositionForm();
  }

  function fillPositionTypeSelect() {
    const select = $('#positionTypeSelect');
    if (!select) return;
    const current = select.value;
    select.innerHTML = state.positionTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
    if (current) select.value = current;
  }

  function fillPositionForm() {
    const position = state.positions.find((item) => item.id === state.selectedPosition) || {};
    const form = $('#positionForm');
    ['title', 'department', 'location', 'experience', 'qualification', 'description', 'vacancies', 'gender', 'hardSkills', 'softSkills', 'applyEmail'].forEach((name) => {
      form[name].value = position[name] || '';
    });
    form.responsibilities.value = Array.isArray(position.responsibilities) ? position.responsibilities.join('\n') : position.responsibilities || '';
    form.tags.value = Array.isArray(position.tags) ? position.tags.join(', ') : '';
    $('#positionTagChips').innerHTML = (position.tags || []).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('');
    $('#positionTypeSelect').value = position.type || state.positionTypes[0] || 'Full-time';
    const statusValue = position.status === 'closed' ? 'closed' : 'live';
    $$('#positionForm input[name="status"]').forEach((radio) => { radio.checked = radio.value === statusValue; });
  }

  // ---------- Enquiries ----------

  const ENQUIRY_STATUSES = ['new', 'replied', 'closed'];

  function filteredEnquiries() {
    const f = state.enquiryFilters;
    return state.enquiries.filter((enquiry) => {
      if (f.status !== 'all' && enquiry.status !== f.status) return false;
      if (f.from && new Date(enquiry.createdAt) < new Date(f.from)) return false;
      if (f.to && new Date(enquiry.createdAt) > new Date(f.to + 'T23:59:59')) return false;
      if (f.search) {
        const term = f.search.toLowerCase();
        if (!`${enquiry.name} ${enquiry.email} ${enquiry.subject}`.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }

  function renderEnquiryFilterChips() {
    const counts = { all: state.enquiries.length };
    ENQUIRY_STATUSES.forEach((status) => { counts[status] = state.enquiries.filter((e) => e.status === status).length; });
    $('#enquiryWorkflowFilters').innerHTML = ['all', ...ENQUIRY_STATUSES].map((status) => `
      <button class="filter-chip ${state.enquiryFilters.status === status ? 'active' : ''}" data-enquiry-filter="${status}" type="button">
        ${status[0].toUpperCase() + status.slice(1)} (${counts[status] || 0})
      </button>
    `).join('');
  }

  function renderEnquiries() {
    renderEnquiryFilterChips();
    $('#enquiryFromDate').value = state.enquiryFilters.from;
    $('#enquiryToDate').value = state.enquiryFilters.to;
    $('#enquirySearch').value = state.enquiryFilters.search;

    const shown = filteredEnquiries();
    const shownIds = new Set(shown.map((e) => e.id));
    for (const id of Array.from(state.enquirySelectedIds)) {
      if (!shownIds.has(id)) state.enquirySelectedIds.delete(id);
    }

    $('#enquiryList').innerHTML = shown.map((enquiry) => `
      <article class="entity-row" data-enquiry-row="${enquiry.id}">
        <input type="checkbox" class="enquiry-select" data-select-enquiry="${enquiry.id}" ${state.enquirySelectedIds.has(enquiry.id) ? 'checked' : ''}>
        <div class="entity-main">
          <div class="entity-title">${escapeHtml(enquiry.name)} <span class="status-pill status-${enquiry.status === 'new' ? 'open' : enquiry.status === 'closed' ? 'closed' : 'scheduled'}">${enquiry.status}</span></div>
          <div class="entity-sub">${escapeHtml(enquiry.subject)}</div>
          <div class="entity-sub">${escapeHtml(enquiry.email)} - ${new Date(enquiry.createdAt).toLocaleString()}</div>
        </div>
        <div class="entity-actions">
          <a href="${escapeHtml('mailto:' + encodeURI(enquiry.email) + '?subject=' + encodeURIComponent('Re: ' + enquiry.subject))}" class="btn-secondary">Reply</a>
          <select class="field-input enquiry-status-select" data-enquiry-status="${enquiry.id}">
            ${ENQUIRY_STATUSES.map((s) => `<option value="${s}" ${s === enquiry.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button type="button" class="btn-secondary" data-enquiry-details="${enquiry.id}">Details</button>
          <button type="button" class="btn-danger danger" data-enquiry-delete="${enquiry.id}">Delete</button>
        </div>
      </article>
    `).join('') || '<p class="empty-state">No enquiries match this view.</p>';

    $('#enquiryShownCount').textContent = `${shown.length} of ${state.enquiries.length} shown`;
    $('#enquirySelectedCount').textContent = `${state.enquirySelectedIds.size} selected`;
    $('#enquirySelectAll').checked = shown.length > 0 && shown.every((e) => state.enquirySelectedIds.has(e.id));
  }

  function openEnquiryDrawer(id) {
    const enquiry = state.enquiries.find((e) => e.id === id);
    if (!enquiry) return;
    state.selectedEnquiry = id;
    $('#enquiryDrawerBody').innerHTML = [
      ['Name', enquiry.name], ['Email', enquiry.email], ['Subject', enquiry.subject],
      ['Status', enquiry.status], ['Submitted', new Date(enquiry.createdAt).toLocaleString()],
      ['Message', enquiry.message],
    ].map(([label, value]) => `<div class="drawer-field"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
    $('#enquiryNotesField').value = enquiry.adminNotes || '';
    $('#enquiryDrawer').classList.add('is-open');
    $('#enquiryDrawer').setAttribute('aria-hidden', 'false');
  }

  // ---------- Applications ----------

  const APPLICATION_STATUSES = ['new', 'reviewed', 'shortlisted', 'rejected'];

  function filteredApplications() {
    const f = state.applicationFilters;
    return state.applications.filter((app) => {
      if (f.status !== 'all' && app.status !== f.status) return false;
      if (f.positionId && app.positionId !== f.positionId) return false;
      if (f.from && new Date(app.createdAt) < new Date(f.from)) return false;
      if (f.to && new Date(app.createdAt) > new Date(f.to + 'T23:59:59')) return false;
      if (f.search) {
        const term = f.search.toLowerCase();
        if (!`${app.name} ${app.email}`.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }

  function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  function renderApplicationFilterChips() {
    const counts = { all: state.applications.length };
    APPLICATION_STATUSES.forEach((status) => { counts[status] = state.applications.filter((a) => a.status === status).length; });
    $('#applicationWorkflowFilters').innerHTML = ['all', ...APPLICATION_STATUSES].map((status) => `
      <button class="filter-chip ${state.applicationFilters.status === status ? 'active' : ''}" data-app-filter="${status}" type="button">
        ${status[0].toUpperCase() + status.slice(1)} (${counts[status] || 0})
      </button>
    `).join('');
  }

  function renderApplications() {
    renderApplicationFilterChips();
    const positionSelect = $('#applicationPositionFilter');
    positionSelect.innerHTML = '<option value="">All positions</option>' + state.positions.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    positionSelect.value = state.applicationFilters.positionId;
    $('#applicationFromDate').value = state.applicationFilters.from;
    $('#applicationToDate').value = state.applicationFilters.to;
    $('#applicationSearch').value = state.applicationFilters.search;

    const shown = filteredApplications();
    const shownIds = new Set(shown.map((a) => a.id));
    for (const id of Array.from(state.applicationSelectedIds)) {
      if (!shownIds.has(id)) state.applicationSelectedIds.delete(id);
    }

    $('#applicationList').innerHTML = shown.map((app) => `
      <article class="entity-row" data-application-row="${app.id}">
        <input type="checkbox" class="application-select" data-select-application="${app.id}" ${state.applicationSelectedIds.has(app.id) ? 'checked' : ''}>
        <div class="entity-main">
          <div class="entity-title">${escapeHtml(app.name)} <span class="status-pill status-${app.status === 'new' ? 'open' : app.status === 'rejected' ? 'closed' : 'scheduled'}">${app.status}</span></div>
          <div class="entity-sub">${escapeHtml(app.positionTitle || 'General application')}</div>
          <div class="entity-sub">${escapeHtml(app.email)} ${app.phone ? '- ' + escapeHtml(app.phone) : ''} ${app.yearsExperience ? '- ' + escapeHtml(app.yearsExperience) : ''}</div>
        </div>
        <div class="entity-actions">
          ${app.resumeUrl ? `<a href="${safeHref(app.resumeUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Resume${app.resumeSize ? ' (' + formatBytes(app.resumeSize) + ')' : ''}</a>` : '<span class="text-xs text-gray-400">No resume</span>'}
          <select class="field-input application-status-select" data-application-status="${app.id}">
            ${APPLICATION_STATUSES.map((s) => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button type="button" class="btn-secondary" data-application-details="${app.id}">Details</button>
          <button type="button" class="btn-danger danger" data-application-delete="${app.id}">Delete</button>
        </div>
      </article>
    `).join('') || '<p class="empty-state">No applications match this view.</p>';

    $('#applicationShownCount').textContent = `${shown.length} of ${state.applications.length} shown`;
    $('#applicationSelectedCount').textContent = `${state.applicationSelectedIds.size} selected`;
    $('#applicationSelectAll').checked = shown.length > 0 && shown.every((a) => state.applicationSelectedIds.has(a.id));
  }

  function openApplicationDrawer(id) {
    const app = state.applications.find((a) => a.id === id);
    if (!app) return;
    state.selectedApplication = id;
    $('#applicationDrawerBody').innerHTML = [
      ['Name', app.name], ['Email', app.email], ['Phone', app.phone || '-'],
      ['Position', app.positionTitle || '-'], ['Experience', app.yearsExperience || '-'],
      ['Status', app.status], ['Submitted', new Date(app.createdAt).toLocaleString()],
      ['Message', app.message || '-'],
    ].map(([label, value]) => `<div class="drawer-field"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')
      + (app.resumeUrl ? `<p class="mt-3"><a href="${safeHref(app.resumeUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Open resume</a></p>` : '');
    $('#applicationNotesField').value = app.adminNotes || '';
    $('#applicationDrawer').classList.add('is-open');
    $('#applicationDrawer').setAttribute('aria-hidden', 'false');
  }

  // ---------- Partners ----------

  function filteredPartners() {
    const f = state.partnerFilters;
    return state.partners.filter((p) => {
      if (f.status !== 'all' && p.status !== f.status) return false;
      if (f.category && p.category !== f.category) return false;
      if (f.from && new Date(p.createdAt) < new Date(f.from)) return false;
      if (f.to && new Date(p.createdAt) > new Date(f.to + 'T23:59:59')) return false;
      if (f.search) {
        const term = f.search.toLowerCase();
        if (!`${p.name} ${p.email}`.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }

  function renderPartnerFilterChips() {
    const counts = { all: state.partners.length };
    APPLICATION_STATUSES.forEach((status) => { counts[status] = state.partners.filter((p) => p.status === status).length; });
    $('#partnerWorkflowFilters').innerHTML = ['all', ...APPLICATION_STATUSES].map((status) => `
      <button class="filter-chip ${state.partnerFilters.status === status ? 'active' : ''}" data-partner-filter="${status}" type="button">
        ${status[0].toUpperCase() + status.slice(1)} (${counts[status] || 0})
      </button>
    `).join('');
  }

  function renderPartners() {
    renderPartnerFilterChips();
    const categorySelect = $('#partnerCategoryFilter');
    categorySelect.innerHTML = '<option value="">All categories</option>' + state.partnerCategories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    categorySelect.value = state.partnerFilters.category;
    $('#partnerFromDate').value = state.partnerFilters.from;
    $('#partnerToDate').value = state.partnerFilters.to;
    $('#partnerSearch').value = state.partnerFilters.search;

    const shown = filteredPartners();
    const shownIds = new Set(shown.map((p) => p.id));
    for (const id of Array.from(state.partnerSelectedIds)) {
      if (!shownIds.has(id)) state.partnerSelectedIds.delete(id);
    }

    $('#partnerList').innerHTML = shown.map((p) => `
      <article class="entity-row" data-partner-row="${p.id}">
        <input type="checkbox" class="partner-select" data-select-partner="${p.id}" ${state.partnerSelectedIds.has(p.id) ? 'checked' : ''}>
        <div class="entity-main">
          <div class="entity-title">${escapeHtml(p.name)} <span class="status-pill status-${p.status === 'new' ? 'open' : p.status === 'rejected' ? 'closed' : 'scheduled'}">${p.status}</span></div>
          <div class="entity-sub">${escapeHtml(p.category || 'Uncategorized')} - ${escapeHtml(p.city || '')} - ${escapeHtml(p.entityType || '')} - ${escapeHtml(p.yearsExperience || '')}</div>
          <div class="entity-sub">${escapeHtml(p.email)} ${p.phone ? '- ' + escapeHtml(p.phone) : ''}</div>
          <div class="entity-sub">${(p.portfolioUrls || []).map((url) => `<a href="${safeHref(url)}" target="_blank" rel="noopener noreferrer" class="text-brand-600">${escapeHtml(url)}</a>`).join(', ')}</div>
          <div class="entity-sub">${new Date(p.createdAt).toLocaleDateString()}</div>
        </div>
        <div class="entity-actions">
          ${p.profileUrl ? `<a href="${safeHref(p.profileUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Profile${p.profileSize ? ' (' + formatBytes(p.profileSize) + ')' : ''}</a>` : '<span class="text-xs text-gray-400">No profile file</span>'}
          <select class="field-input partner-status-select" data-partner-status="${p.id}">
            ${APPLICATION_STATUSES.map((s) => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button type="button" class="btn-secondary" data-partner-details="${p.id}">Details</button>
          <button type="button" class="btn-danger danger" data-partner-delete="${p.id}">Delete</button>
        </div>
      </article>
    `).join('') || '<p class="empty-state">No partners match this view.</p>';

    $('#partnerShownCount').textContent = `${shown.length} of ${state.partners.length} shown`;
    $('#partnerSelectedCount').textContent = `${state.partnerSelectedIds.size} selected`;
    $('#partnerSelectAll').checked = shown.length > 0 && shown.every((p) => state.partnerSelectedIds.has(p.id));
  }

  function openPartnerDrawer(id) {
    const p = state.partners.find((item) => item.id === id);
    if (!p) return;
    state.selectedPartner = id;
    $('#partnerDrawerBody').innerHTML = [
      ['Name', p.name], ['Email', p.email], ['Phone', p.phone || '-'],
      ['Category', p.category || '-'], ['City', p.city || '-'], ['Entity type', p.entityType || '-'],
      ['Experience', p.yearsExperience || '-'], ['Status', p.status], ['Submitted', new Date(p.createdAt).toLocaleString()],
      ['Description', p.description || '-'],
    ].map(([label, value]) => `<div class="drawer-field"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join('')
      + ((p.portfolioUrls || []).length ? `<p class="mt-3">${p.portfolioUrls.map((url) => `<a href="${safeHref(url)}" target="_blank" rel="noopener noreferrer" class="block text-brand-600">${escapeHtml(url)}</a>`).join('')}</p>` : '')
      + (p.profileUrl ? `<p class="mt-3"><a href="${safeHref(p.profileUrl)}" target="_blank" rel="noopener noreferrer" class="btn-secondary">Open profile file</a></p>` : '');
    $('#partnerNotesField').value = p.adminNotes || '';
    $('#partnerDrawer').classList.add('is-open');
    $('#partnerDrawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawers() {
    $$('.drawer.is-open').forEach((drawer) => { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); });
  }

  // ---------- Type / category manager ----------

  function openTypeManager(target) {
    state.typeManagerTarget = target;
    $('#typeManagerTitle').textContent = target === 'positionTypes' ? 'Manage position types' : 'Manage partner categories';
    renderTypeManager();
    $('#typeManagerModal').classList.add('is-open');
    $('#typeManagerModal').setAttribute('aria-hidden', 'false');
  }

  function closeTypeManager() {
    $('#typeManagerModal').classList.remove('is-open');
    $('#typeManagerModal').setAttribute('aria-hidden', 'true');
  }

  function renderTypeManager() {
    const list = state[state.typeManagerTarget] || [];
    $('#typeManagerList').innerHTML = list.map((item, index) => `
      <div class="type-row"><span>${escapeHtml(item)}</span><button type="button" class="btn-danger danger" data-remove-type="${index}">Remove</button></div>
    `).join('') || '<p class="empty-state">No entries yet.</p>';
  }

  function exportCsv(rows, columns, filename) {
    const header = columns.map((c) => c.label).join(',');
    const lines = rows.map((row) => columns.map((c) => `"${String(c.value(row) ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Analytics / settings (unchanged) ----------

  function renderAnalytics() {
    const analytics = state.analytics || {};
    const devices = analytics.devices || {};
    const tagForm = $('#analyticsTagForm');
    ['gaMeasurementId', 'gtmContainerId'].forEach((name) => {
      tagForm[name].value = state.settings[name] || '';
    });
    $('#analyticsMetrics').innerHTML = [
      metric('Page views', analytics.pageViews || 0, 'chart', 'brand'),
      metric('Unique visitors', analytics.uniqueVisitors || 0, 'grid', 'success'),
      metric('Avg views / day', analytics.avgViewsPerDay || 0, 'clock', 'warning'),
      metric('Desktop / Mobile', `${devices.desktop || 0} / ${devices.mobile || 0}`, 'devices', 'info'),
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
    $('#settingsForm').robotsTxt.value = state.settings.robotsTxt || '';
    const llms = $('#llmsForm');
    llms.llmsIntro.value = state.settings.llmsIntro || '';
    llms.llmsFooter.value = state.settings.llmsFooter || '';
    ['llmsIncludePages', 'llmsIncludePosts', 'llmsIncludePositions'].forEach((name) => { llms[name].checked = state.settings[name] !== false; });
    updateCrawlerInsights();
  }

  function previewData() {
    return { settings: { ...state.settings, ...collectCrawlerSettings(), ...collectLlmsSettings() }, pages: state.pages.map((page) => ({ ...page, seo: state.pageSeo[page.path] || {} })), posts: state.posts, positions: state.positions };
  }

  function updateCrawlerInsights() {
    const robots = $('#settingsForm').robotsTxt.value;
    const lines = robots.split(/\r?\n/).map((line) => line.trim());
    const blocksAll = lines.some((line, i) => /^disallow:\s*\/\s*$/i.test(line) && lines.slice(0, i).reverse().find((l) => /^user-agent:/i.test(l))?.match(/:\s*\*/));
    const checks = [
      [/^user-agent:/im.test(robots), 'Has at least one User-agent group'],
      [!blocksAll, 'Does not block the whole site for all crawlers'],
      [/^sitemap:\s*https:\/\/\S+sitemap\.xml/im.test(robots), 'Points crawlers to the sitemap'],
      [/^disallow:\s*\/admin/im.test(robots), 'Keeps /admin out of search'],
      [/^disallow:\s*\/api\//im.test(robots), 'Keeps /api/ out of search'],
    ];
    $('#robotsChecks').innerHTML = checks.map(([ok, label]) => `<li class="${ok ? '' : 'is-fail'}">${label}</li>`).join('');
    const data = previewData();
    $('#sitemapCount').textContent = (buildSitemap(data).match(/<url>/g) || []).length;
    $('#llmsPreview').textContent = buildLlmsTxt(data);
  }

  function render() {
    renderOverview();
    renderSeo();
    renderPosts();
    renderPositions();
    renderEnquiries();
    renderApplications();
    renderPartners();
    renderAnalytics();
    renderSettings();
  }

  // Only fields that differ from the page's built-in defaults are stored, so improved defaults keep reaching the site.
  function collectSeo() {
    const page = state.pages.find((item) => item.path === state.selectedPage);
    if (!page) return;
    const defaults = page.defaults || {};
    const overrides = {};
    for (const [name, value] of Object.entries(seoFormValues())) {
      if (value && value !== String(defaults[name] ?? '').trim()) overrides[name] = value;
    }
    state.pageSeo[state.selectedPage] = overrides;
  }

  function collectSettings() {
    return {
      ...state.settings,
      ...collectAnalyticsTags(),
      ...collectCrawlerSettings(),
      ...collectLlmsSettings(),
    };
  }

  function collectAnalyticsTags() {
    const form = $('#analyticsTagForm');
    return Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.value.trim()]));
  }

  function collectCrawlerSettings() {
    return { robotsTxt: $('#settingsForm').robotsTxt.value.trim() };
  }

  function collectLlmsSettings() {
    const form = $('#llmsForm');
    return Object.fromEntries(Array.from(form.elements).filter((field) => field.name).map((field) => [field.name, field.type === 'checkbox' ? field.checked : field.value.trim()]));
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

    $$('[data-seo-editor-tab]').forEach((tab) => tab.addEventListener('click', () => {
      state.seoEditorTab = tab.dataset.seoEditorTab;
      renderSeoEditorTab();
    }));

    $('#pageSearch').addEventListener('input', (event) => {
      state.seoSearch = event.target.value;
      renderSeoPageList();
    });
    $('#pageGroup').addEventListener('change', (event) => {
      state.seoGroup = event.target.value;
      renderSeoPageList();
    });

    $('#postList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-post]');
      if (!button) return;
      state.selectedPost = button.dataset.post;
      renderPosts();
    });

    $$('.filters button[data-post-filter]').forEach((button) => button.addEventListener('click', () => {
      state.postFilter = button.dataset.postFilter;
      renderPosts();
    }));

    $('#postSearch').addEventListener('input', (event) => {
      state.postSearch = event.target.value;
      renderPostList();
    });

    $('#newPostBtn').addEventListener('click', () => {
      const post = normalizePost({ id: crypto.randomUUID(), title: 'New ACS Engitech blog post', status: 'draft', publishedAt: new Date().toISOString() });
      state.posts.unshift(post);
      state.selectedPost = post.id;
      renderPosts();
    });

    $('#postForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const previousPosts = state.posts;
      const previousSelected = state.selectedPost;
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
      await mutate({
        apply: () => {
          state.posts = [post, ...state.posts.filter((item) => item.id !== post.id)];
          state.selectedPost = post.id;
        },
        rerender: () => { renderPosts(); renderOverview(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ posts: state.posts }) }),
        successMessage: 'Post saved.',
        revert: () => { state.posts = previousPosts; state.selectedPost = previousSelected; },
      });
    });

    $('#deletePostBtn').addEventListener('click', async () => {
      if (!state.selectedPost || !confirm('Delete this post?')) return;
      const previousPosts = state.posts;
      const previousSelected = state.selectedPost;
      await mutate({
        apply: () => {
          state.posts = state.posts.filter((post) => post.id !== state.selectedPost);
          state.selectedPost = state.posts[0]?.id || null;
        },
        rerender: () => { renderPosts(); renderOverview(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ posts: state.posts }) }),
        successMessage: 'Post deleted.',
        revert: () => { state.posts = previousPosts; state.selectedPost = previousSelected; },
      });
    });

    // ---- Positions ----

    $('#positionList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-position]');
      if (!button) return;
      state.selectedPosition = button.dataset.position;
      renderPositions();
    });

    $('#positionSearch').addEventListener('input', (event) => {
      state.positionSearch = event.target.value;
      renderPositionList();
    });

    $('#newPositionBtn').addEventListener('click', () => {
      const position = { id: crypto.randomUUID(), title: 'New position', department: 'Automation', location: 'Ahmedabad, Gujarat', type: state.positionTypes[0] || 'Full-time', tags: [], vacancies: '1', gender: 'Open', responsibilities: [], status: 'live', applyEmail: 'sales@acsengitech.com' };
      state.positions.unshift(position);
      state.selectedPosition = position.id;
      renderPositions();
    });

    $('#positionForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const statusValue = form.querySelector('input[name="status"]:checked')?.value || 'live';
      const position = {
        id: state.selectedPosition || crypto.randomUUID(),
        title: form.title.value.trim(),
        department: form.department.value.trim(),
        location: form.location.value.trim(),
        type: $('#positionTypeSelect').value,
        experience: form.experience.value.trim(),
        qualification: form.qualification.value.trim(),
        description: form.description.value.trim(),
        vacancies: form.vacancies.value.trim(),
        gender: form.gender.value.trim(),
        tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
        responsibilities: form.responsibilities.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        hardSkills: form.hardSkills.value.trim(),
        softSkills: form.softSkills.value.trim(),
        applyEmail: form.applyEmail.value.trim(),
        status: statusValue,
      };
      const previousPositions = state.positions;
      const previousSelected = state.selectedPosition;
      await mutate({
        apply: () => {
          state.positions = [position, ...state.positions.filter((item) => item.id !== position.id)];
          state.selectedPosition = position.id;
        },
        rerender: () => { renderPositions(); renderOverview(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ positions: state.positions }) }),
        successMessage: 'Position saved.',
        revert: () => { state.positions = previousPositions; state.selectedPosition = previousSelected; },
      });
    });

    $('#deletePositionBtn').addEventListener('click', async () => {
      if (!state.selectedPosition || !confirm('Delete this position?')) return;
      const previousPositions = state.positions;
      const previousSelected = state.selectedPosition;
      await mutate({
        apply: () => {
          state.positions = state.positions.filter((position) => position.id !== state.selectedPosition);
          state.selectedPosition = state.positions[0]?.id || null;
        },
        rerender: () => { renderPositions(); renderOverview(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ positions: state.positions }) }),
        successMessage: 'Position deleted.',
        revert: () => { state.positions = previousPositions; state.selectedPosition = previousSelected; },
      });
    });

    $('#managePositionTypesBtn').addEventListener('click', () => openTypeManager('positionTypes'));
    $('#positionTypeManageLink').addEventListener('click', (event) => { event.preventDefault(); openTypeManager('positionTypes'); });
    $('#managePartnerCategoriesBtn').addEventListener('click', () => openTypeManager('partnerCategories'));

    $('#typeManagerForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = $('#typeManagerInput');
      const value = input.value.trim();
      if (!value) return;
      const key = state.typeManagerTarget;
      const previous = state[key];
      input.value = '';
      await mutate({
        apply: () => { if (!state[key].includes(value)) state[key] = [...state[key], value]; },
        rerender: () => { renderTypeManager(); fillPositionTypeSelect(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ [key]: state[key] }) }),
        successMessage: key === 'positionTypes' ? 'Position types saved.' : 'Partner categories saved.',
        revert: () => { state[key] = previous; },
      });
    });

    $('#typeManagerList').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-remove-type]');
      if (!button) return;
      const key = state.typeManagerTarget;
      const index = Number(button.dataset.removeType);
      const previous = state[key];
      await mutate({
        apply: () => { state[key] = state[key].filter((_, i) => i !== index); },
        rerender: () => { renderTypeManager(); fillPositionTypeSelect(); },
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ [key]: state[key] }) }),
        successMessage: key === 'positionTypes' ? 'Position types saved.' : 'Partner categories saved.',
        revert: () => { state[key] = previous; },
      });
    });

    $$('[data-modal-close]').forEach((el) => el.addEventListener('click', closeTypeManager));

    // ---- Enquiries ----

    $('#enquiryWorkflowFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-enquiry-filter]');
      if (!button) return;
      state.enquiryFilters.status = button.dataset.enquiryFilter;
      renderEnquiries();
    });
    $('#enquiryFromDate').addEventListener('change', (event) => { state.enquiryFilters.from = event.target.value; renderEnquiries(); });
    $('#enquiryToDate').addEventListener('change', (event) => { state.enquiryFilters.to = event.target.value; renderEnquiries(); });
    $('#enquirySearch').addEventListener('input', (event) => { state.enquiryFilters.search = event.target.value; renderEnquiries(); });
    $('#clearEnquiryFiltersBtn').addEventListener('click', () => {
      state.enquiryFilters = { status: 'all', from: '', to: '', search: '' };
      renderEnquiries();
    });
    $('#refreshEnquiriesBtn').addEventListener('click', load);
    $('#exportEnquiriesBtn').addEventListener('click', () => {
      exportCsv(filteredEnquiries(), [
        { label: 'First name', value: (e) => e.firstName }, { label: 'Last name', value: (e) => e.lastName }, { label: 'Email', value: (e) => e.email },
        { label: 'Subject', value: (e) => e.subject }, { label: 'Message', value: (e) => e.message },
        { label: 'Status', value: (e) => e.status }, { label: 'Submitted', value: (e) => e.createdAt },
      ], 'enquiries.csv');
    });

    $('#enquirySelectAll').addEventListener('change', (event) => {
      const shown = filteredEnquiries();
      if (event.target.checked) shown.forEach((e) => state.enquirySelectedIds.add(e.id));
      else shown.forEach((e) => state.enquirySelectedIds.delete(e.id));
      renderEnquiries();
    });

    $('#enquiryList').addEventListener('click', (event) => {
      const select = event.target.closest('[data-select-enquiry]');
      if (select) {
        const id = select.dataset.selectEnquiry;
        if (select.checked) state.enquirySelectedIds.add(id); else state.enquirySelectedIds.delete(id);
        renderEnquiries();
        return;
      }
      const details = event.target.closest('[data-enquiry-details]');
      if (details) { openEnquiryDrawer(details.dataset.enquiryDetails); return; }
      const del = event.target.closest('[data-enquiry-delete]');
      if (del) {
        if (!confirm('Delete this enquiry?')) return;
        const id = del.dataset.enquiryDelete;
        const previousEnquiries = state.enquiries;
        mutate({
          apply: () => {
            state.enquiries = state.enquiries.filter((e) => e.id !== id);
            state.enquirySelectedIds.delete(id);
          },
          rerender: renderEnquiries,
          request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'enquiry.delete', ids: [id] }) }),
          successMessage: 'Enquiry deleted.',
          revert: () => { state.enquiries = previousEnquiries; },
        });
      }
    });

    $('#enquiryList').addEventListener('change', (event) => {
      const select = event.target.closest('[data-enquiry-status]');
      if (!select) return;
      const id = select.dataset.enquiryStatus;
      const enquiry = state.enquiries.find((e) => e.id === id);
      if (!enquiry) return;
      const previousStatus = enquiry.status;
      const nextStatus = select.value;
      mutate({
        apply: () => { enquiry.status = nextStatus; },
        rerender: renderEnquiries,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'enquiry.update', id, patch: { status: nextStatus } }) }),
        successMessage: 'Status updated.',
        revert: () => { enquiry.status = previousStatus; },
      });
    });

    $('#deleteEnquiriesBtn').addEventListener('click', () => {
      const ids = Array.from(state.enquirySelectedIds);
      if (!ids.length || !confirm(`Delete ${ids.length} selected enquiry(s)?`)) return;
      const previousEnquiries = state.enquiries;
      const idSet = new Set(ids);
      mutate({
        apply: () => {
          state.enquiries = state.enquiries.filter((e) => !idSet.has(e.id));
          state.enquirySelectedIds.clear();
        },
        rerender: renderEnquiries,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'enquiry.delete', ids }) }),
        successMessage: 'Enquiries deleted.',
        revert: () => { state.enquiries = previousEnquiries; },
      });
    });

    $('#saveEnquiryNotesBtn').addEventListener('click', () => {
      if (!state.selectedEnquiry) return;
      const id = state.selectedEnquiry;
      const enquiry = state.enquiries.find((e) => e.id === id);
      const notes = $('#enquiryNotesField').value;
      const previousNotes = enquiry?.adminNotes;
      mutate({
        apply: () => { if (enquiry) enquiry.adminNotes = notes; },
        rerender: () => {},
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'enquiry.update', id, patch: { adminNotes: notes } }) }),
        successMessage: 'Notes saved.',
        revert: () => { if (enquiry) enquiry.adminNotes = previousNotes; },
      });
    });

    // ---- Applications ----

    $('#applicationWorkflowFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-app-filter]');
      if (!button) return;
      state.applicationFilters.status = button.dataset.appFilter;
      renderApplications();
    });
    $('#applicationPositionFilter').addEventListener('change', (event) => { state.applicationFilters.positionId = event.target.value; renderApplications(); });
    $('#applicationFromDate').addEventListener('change', (event) => { state.applicationFilters.from = event.target.value; renderApplications(); });
    $('#applicationToDate').addEventListener('change', (event) => { state.applicationFilters.to = event.target.value; renderApplications(); });
    $('#applicationSearch').addEventListener('input', (event) => { state.applicationFilters.search = event.target.value; renderApplications(); });
    $('#clearApplicationFiltersBtn').addEventListener('click', () => {
      state.applicationFilters = { status: 'all', positionId: '', from: '', to: '', search: '' };
      renderApplications();
    });
    $('#refreshApplicationsBtn').addEventListener('click', load);
    $('#exportApplicationsBtn').addEventListener('click', () => {
      exportCsv(filteredApplications(), [
        { label: 'Name', value: (a) => a.name }, { label: 'Email', value: (a) => a.email }, { label: 'Phone', value: (a) => a.phone },
        { label: 'Position', value: (a) => a.positionTitle }, { label: 'Experience', value: (a) => a.yearsExperience },
        { label: 'Status', value: (a) => a.status }, { label: 'Submitted', value: (a) => a.createdAt },
      ], 'applications.csv');
    });

    $('#applicationSelectAll').addEventListener('change', (event) => {
      const shown = filteredApplications();
      if (event.target.checked) shown.forEach((a) => state.applicationSelectedIds.add(a.id));
      else shown.forEach((a) => state.applicationSelectedIds.delete(a.id));
      renderApplications();
    });

    $('#applicationList').addEventListener('click', (event) => {
      const select = event.target.closest('[data-select-application]');
      if (select) {
        const id = select.dataset.selectApplication;
        if (select.checked) state.applicationSelectedIds.add(id); else state.applicationSelectedIds.delete(id);
        renderApplications();
        return;
      }
      const details = event.target.closest('[data-application-details]');
      if (details) { openApplicationDrawer(details.dataset.applicationDetails); return; }
      const del = event.target.closest('[data-application-delete]');
      if (del) {
        if (!confirm('Delete this application?')) return;
        const id = del.dataset.applicationDelete;
        const previousApplications = state.applications;
        mutate({
          apply: () => {
            state.applications = state.applications.filter((a) => a.id !== id);
            state.applicationSelectedIds.delete(id);
          },
          rerender: renderApplications,
          request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'application.delete', ids: [id] }) }),
          successMessage: 'Application deleted.',
          revert: () => { state.applications = previousApplications; },
        });
      }
    });

    $('#applicationList').addEventListener('change', (event) => {
      const select = event.target.closest('[data-application-status]');
      if (!select) return;
      const id = select.dataset.applicationStatus;
      const app = state.applications.find((a) => a.id === id);
      if (!app) return;
      const previousStatus = app.status;
      const nextStatus = select.value;
      mutate({
        apply: () => { app.status = nextStatus; },
        rerender: renderApplications,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'application.update', id, patch: { status: nextStatus } }) }),
        successMessage: 'Status updated.',
        revert: () => { app.status = previousStatus; },
      });
    });

    $('#deleteApplicationsBtn').addEventListener('click', () => {
      const ids = Array.from(state.applicationSelectedIds);
      if (!ids.length || !confirm(`Delete ${ids.length} selected application(s)?`)) return;
      const previousApplications = state.applications;
      const idSet = new Set(ids);
      mutate({
        apply: () => {
          state.applications = state.applications.filter((a) => !idSet.has(a.id));
          state.applicationSelectedIds.clear();
        },
        rerender: renderApplications,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'application.delete', ids }) }),
        successMessage: 'Applications deleted.',
        revert: () => { state.applications = previousApplications; },
      });
    });

    $('#saveApplicationNotesBtn').addEventListener('click', () => {
      if (!state.selectedApplication) return;
      const id = state.selectedApplication;
      const app = state.applications.find((a) => a.id === id);
      const notes = $('#applicationNotesField').value;
      const previousNotes = app?.adminNotes;
      mutate({
        apply: () => { if (app) app.adminNotes = notes; },
        rerender: () => {},
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'application.update', id, patch: { adminNotes: notes } }) }),
        successMessage: 'Notes saved.',
        revert: () => { if (app) app.adminNotes = previousNotes; },
      });
    });

    // ---- Partners ----

    $('#partnerWorkflowFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-partner-filter]');
      if (!button) return;
      state.partnerFilters.status = button.dataset.partnerFilter;
      renderPartners();
    });
    $('#partnerCategoryFilter').addEventListener('change', (event) => { state.partnerFilters.category = event.target.value; renderPartners(); });
    $('#partnerFromDate').addEventListener('change', (event) => { state.partnerFilters.from = event.target.value; renderPartners(); });
    $('#partnerToDate').addEventListener('change', (event) => { state.partnerFilters.to = event.target.value; renderPartners(); });
    $('#partnerSearch').addEventListener('input', (event) => { state.partnerFilters.search = event.target.value; renderPartners(); });
    $('#clearPartnerFiltersBtn').addEventListener('click', () => {
      state.partnerFilters = { status: 'all', category: '', from: '', to: '', search: '' };
      renderPartners();
    });
    $('#refreshPartnersBtn').addEventListener('click', load);
    $('#exportPartnersBtn').addEventListener('click', () => {
      exportCsv(filteredPartners(), [
        { label: 'Name', value: (p) => p.name }, { label: 'Email', value: (p) => p.email }, { label: 'Phone', value: (p) => p.phone },
        { label: 'Category', value: (p) => p.category }, { label: 'City', value: (p) => p.city }, { label: 'Entity type', value: (p) => p.entityType },
        { label: 'Status', value: (p) => p.status }, { label: 'Submitted', value: (p) => p.createdAt },
      ], 'partners.csv');
    });

    $('#partnerSelectAll').addEventListener('change', (event) => {
      const shown = filteredPartners();
      if (event.target.checked) shown.forEach((p) => state.partnerSelectedIds.add(p.id));
      else shown.forEach((p) => state.partnerSelectedIds.delete(p.id));
      renderPartners();
    });

    $('#partnerList').addEventListener('click', (event) => {
      const select = event.target.closest('[data-select-partner]');
      if (select) {
        const id = select.dataset.selectPartner;
        if (select.checked) state.partnerSelectedIds.add(id); else state.partnerSelectedIds.delete(id);
        renderPartners();
        return;
      }
      const details = event.target.closest('[data-partner-details]');
      if (details) { openPartnerDrawer(details.dataset.partnerDetails); return; }
      const del = event.target.closest('[data-partner-delete]');
      if (del) {
        if (!confirm('Delete this partner?')) return;
        const id = del.dataset.partnerDelete;
        const previousPartners = state.partners;
        mutate({
          apply: () => {
            state.partners = state.partners.filter((p) => p.id !== id);
            state.partnerSelectedIds.delete(id);
          },
          rerender: renderPartners,
          request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'partner.delete', ids: [id] }) }),
          successMessage: 'Partner deleted.',
          revert: () => { state.partners = previousPartners; },
        });
      }
    });

    $('#partnerList').addEventListener('change', (event) => {
      const select = event.target.closest('[data-partner-status]');
      if (!select) return;
      const id = select.dataset.partnerStatus;
      const partner = state.partners.find((p) => p.id === id);
      if (!partner) return;
      const previousStatus = partner.status;
      const nextStatus = select.value;
      mutate({
        apply: () => { partner.status = nextStatus; },
        rerender: renderPartners,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'partner.update', id, patch: { status: nextStatus } }) }),
        successMessage: 'Status updated.',
        revert: () => { partner.status = previousStatus; },
      });
    });

    $('#deletePartnersBtn').addEventListener('click', () => {
      const ids = Array.from(state.partnerSelectedIds);
      if (!ids.length || !confirm(`Delete ${ids.length} selected partner(s)?`)) return;
      const previousPartners = state.partners;
      const idSet = new Set(ids);
      mutate({
        apply: () => {
          state.partners = state.partners.filter((p) => !idSet.has(p.id));
          state.partnerSelectedIds.clear();
        },
        rerender: renderPartners,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'partner.delete', ids }) }),
        successMessage: 'Partners deleted.',
        revert: () => { state.partners = previousPartners; },
      });
    });

    $('#savePartnerNotesBtn').addEventListener('click', () => {
      if (!state.selectedPartner) return;
      const id = state.selectedPartner;
      const partner = state.partners.find((p) => p.id === id);
      const notes = $('#partnerNotesField').value;
      const previousNotes = partner?.adminNotes;
      mutate({
        apply: () => { if (partner) partner.adminNotes = notes; },
        rerender: () => {},
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'partner.update', id, patch: { adminNotes: notes } }) }),
        successMessage: 'Notes saved.',
        revert: () => { if (partner) partner.adminNotes = previousNotes; },
      });
    });

    $$('[data-drawer-close]').forEach((el) => el.addEventListener('click', closeDrawers));

    $('#saveSeoBtn').addEventListener('click', async () => {
      collectSeo();
      await mutate({
        apply: () => {},
        rerender: renderSeo,
        request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ pageSeo: state.pageSeo }) }),
        successMessage: 'SEO saved.',
      });
    });
    $('#saveAnalyticsTagsBtn').addEventListener('click', async () => mutate({
      apply: () => {},
      rerender: renderAnalytics,
      request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ settings: { ...state.settings, ...collectAnalyticsTags() } }) }),
      successMessage: 'Analytics tags saved.',
    }));
    $('#saveSettingsBtn').addEventListener('click', async () => mutate({
      apply: () => {},
      rerender: renderSettings,
      request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ settings: { ...state.settings, ...collectCrawlerSettings() } }) }),
      successMessage: 'robots.txt saved.',
    }));
    $('#saveLlmsBtn').addEventListener('click', async () => mutate({
      apply: () => {},
      rerender: renderSettings,
      request: () => api('/api/admin', { method: 'POST', body: JSON.stringify({ settings: { ...state.settings, ...collectLlmsSettings() } }) }),
      successMessage: 'llms.txt saved.',
    }));
    $('#resetRobotsBtn').addEventListener('click', () => {
      if (!confirm('Replace robots.txt with the recommended rules? Save to publish.')) return;
      $('#settingsForm').robotsTxt.value = DEFAULT_SETTINGS.robotsTxt;
      updateCrawlerInsights();
    });
    $('#settingsForm').addEventListener('input', updateCrawlerInsights);
    $('#llmsForm').addEventListener('input', updateCrawlerInsights);
    $('#llmsForm').addEventListener('change', updateCrawlerInsights);

    $('#seoForm').addEventListener('input', updateSeoInsights);
    $('#seoForm').addEventListener('change', updateSeoInsights);
    $('#resetSeoBtn').addEventListener('click', () => {
      if (!confirm('Reset this page to its default SEO? Save SEO to publish.')) return;
      state.pageSeo[state.selectedPage] = {};
      renderSeo();
    });
    $('#robotsPreset').addEventListener('change', (event) => {
      if (!event.target.value) return;
      $('#seoForm').robots.value = event.target.value;
      event.target.value = '';
      updateSeoInsights();
    });
    $('#jsonLdTemplate').addEventListener('change', (event) => {
      const type = event.target.value;
      event.target.value = '';
      if (!type) return;
      const field = $('#seoForm').jsonLd;
      if (field.value.trim() && !confirm(`Replace the current JSON-LD with a ${type} template?`)) return;
      const page = state.pages.find((item) => item.path === state.selectedPage) || state.pages[0];
      field.value = jsonLdTemplate(type, page, seoFormValues());
      updateSeoInsights();
    });
    $('#formatJsonLdBtn').addEventListener('click', () => {
      const field = $('#seoForm').jsonLd;
      const status = $('#jsonLdStatus');
      if (!field.value.trim()) { status.textContent = 'No JSON-LD to check.'; status.className = 'jsonld-status'; return; }
      try {
        const parsed = JSON.parse(field.value);
        field.value = JSON.stringify(parsed, null, 2);
        const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
        const missing = items.filter((item) => !item['@type']).length;
        status.textContent = missing ? `Valid JSON, but ${missing} item(s) have no @type.` : `Valid JSON-LD: ${items.map((item) => item['@type']).join(', ')}`;
        status.className = `jsonld-status ${missing ? 'is-bad' : 'is-good'}`;
      } catch (error) {
        status.textContent = `Invalid JSON: ${error.message}`;
        status.className = 'jsonld-status is-bad';
      }
      updateSeoInsights();
    });

    $('#scheduleList').addEventListener('click', (event) => {
      const button = event.target.closest('[data-schedule-post]');
      if (!button) return;
      state.selectedPost = button.dataset.schedulePost;
      renderPosts();
      $('#postForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#saveAllTop').addEventListener('click', async () => {
      collectSeo();
      await save({ pageSeo: state.pageSeo, posts: state.posts, positions: state.positions, settings: collectSettings() }, 'All changes saved.');
    });
    $('#refreshBtn').addEventListener('click', load);
    $('#analyticsDays').addEventListener('change', load);
  }

  // Restore email from a still-valid session so a page refresh doesn't force re-login. The
  // password itself is never persisted, so state.password stays empty until the next login.
  // Unlock the shell immediately (before the slow initial fetch) so the sign-in screen never
  // flashes on refresh; load() re-locks only if the API actually returns 401.
  const restoredSession = getStoredSession();
  if (restoredSession) {
    state.email = restoredSession.email;
    document.body.classList.remove('admin-locked');
  }

  bindEvents();
  load();
}());
