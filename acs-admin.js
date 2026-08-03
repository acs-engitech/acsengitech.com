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
    email: localStorage.getItem('acsAdminEmail') || 'acs.mmo@gmail.com',
    password: localStorage.getItem('acsAdminPassword') || '',
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const statusBar = $('#statusBar');

  function setStatus(message, type) {
    statusBar.textContent = message;
    statusBar.className = `status-bar ${type || ''}`;
  }

  function authHeaders() {
    return state.email && state.password ? { 'x-admin-email': state.email, 'x-admin-password': state.password } : {};
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json();
    if (response.status === 401) {
      const email = window.prompt('Enter ACS admin email', state.email || 'acs.mmo@gmail.com');
      const password = email ? window.prompt('Enter ACS admin password') : '';
      if (email && password) {
        state.email = email.trim();
        state.password = password;
        localStorage.setItem('acsAdminEmail', state.email);
        localStorage.setItem('acsAdminPassword', password);
        return api(path, options);
      }
    }
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function slugify(value) {
    return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
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
      state.selectedPage ||= state.pages[0]?.path || '/';
      state.selectedPost ||= state.posts[0]?.id || null;
      state.selectedJob ||= state.jobs[0]?.id || null;
      render();
      setStatus('All changes are loaded.', 'ok');
    } catch (error) {
      render();
      setStatus('Admin data could not be loaded. Start the local dev server or check the Neon/Vercel connection.', 'error');
    }
  }

  async function save(payload, message) {
    setStatus('Saving changes...');
    const data = await api('/api/admin', { method: 'POST', body: JSON.stringify(payload) });
    state.pages = data.pages || state.pages;
    state.pageSeo = Object.fromEntries(state.pages.map((page) => [page.path, page.seo || {}]));
    state.posts = data.posts || state.posts;
    state.jobs = data.jobs || state.jobs;
    state.settings = data.settings || state.settings;
    render();
    setStatus(message || 'Saved.', 'ok');
  }

  function metric(label, value) {
    return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
  }

  function renderOverview() {
    const published = state.posts.filter((post) => post.status === 'published').length;
    const scheduled = state.posts.filter((post) => post.status === 'scheduled').length;
    const openJobs = state.jobs.filter((job) => job.status === 'open').length;
    $('#overviewMetrics').innerHTML = [
      metric('SEO pages', state.pages.length),
      metric('Published blogs', published),
      metric('Scheduled blogs', scheduled),
      metric('Open roles', openJobs),
    ].join('');
  }

  function renderSeo() {
    $('#pageList').innerHTML = state.pages.map((page) => `
      <button class="row-card ${page.path === state.selectedPage ? 'active' : ''}" data-page="${page.path}" type="button">
        <strong>${page.label}</strong>
        <span>${page.path} - ${(state.pageSeo[page.path]?.title || page.defaults.title || '').slice(0, 90)}</span>
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
        <strong>${post.title} <small>${post.status}</small></strong>
        <span>${new Date(post.publishedAt).toLocaleDateString()} - /blog?post=${post.slug}</span>
        <span>${(post.tags || []).join(', ')}</span>
      </button>
    `).join('') || '<p>No posts in this view.</p>';
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
    $('#previewPostLink').href = `blog.html?post=${post.slug || ''}`;
  }

  function renderJobs() {
    $('#jobList').innerHTML = state.jobs.map((job) => `
      <button class="row-card ${job.id === state.selectedJob ? 'active' : ''}" data-job="${job.id}" type="button">
        <strong>${job.title} <small>${job.status}</small></strong>
        <span>${job.department || ''} - ${job.location || ''}</span>
      </button>
    `).join('') || '<p>No roles yet.</p>';
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
      metric('Page views', analytics.pageViews || 0),
      metric('Unique visitors', analytics.uniqueVisitors || 0),
      metric('Avg views / day', analytics.avgViewsPerDay || 0),
      metric('Devices', `D ${devices.desktop || 0} / M ${devices.mobile || 0}`),
    ].join('');

    const peak = Math.max(1, ...(analytics.daily || []).map((day) => day.views));
    $('#dailyChart').innerHTML = (analytics.daily || []).length
      ? (analytics.daily || []).map((day) => `<div class="bar" title="${day.date}: ${day.views}" style="height:${Math.max(6, (day.views / peak) * 100)}%"></div>`).join('')
      : '<p class="empty-state">No page views yet.</p>';
    $('#topPages').innerHTML = rows((analytics.topPages || []).map((row) => [row.path, row.views]));
    $('#topReferrers').innerHTML = rows((analytics.topReferrers || []).map((row) => [row.source, row.views]));
  }

  function rows(items) {
    return items.map(([label, value]) => `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`).join('') || '<p>No data yet.</p>';
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
    $$('.admin-nav button').forEach((button) => button.addEventListener('click', () => {
      $$('.admin-nav button').forEach((item) => item.classList.remove('active'));
      $$('.panel').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      $(`#${button.dataset.tab}`).classList.add('active');
    }));

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
