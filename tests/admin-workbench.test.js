const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '..', 'admin-src', 'index.html'), 'utf8');
const stylesheet = fs.readFileSync(path.join(__dirname, '..', 'admin-src', 'css', 'style.css'), 'utf8');

test('admin template uses shared workbench structure instead of repeated ungrouped sections', () => {
  for (const label of ['Workspace', 'Content', 'Operations', 'Site intelligence']) {
    assert.match(template, new RegExp(`class="nav-group-label"[^>]*>${label}<`));
  }

  // Enquiries, applications and partners each render one table: toolbar, bulk bar, column header and rows.
  assert.equal((template.match(/class="dt-toolbar filter-row"/g) || []).length, 3);
  assert.equal((template.match(/class="dt-bulk bulk-row"/g) || []).length, 3);
  assert.equal((template.match(/class="dt-cols"/g) || []).length, 3);
});

test('long-form editors keep secondary fields out of the default reading path', () => {
  assert.match(template, /<details class="editor-section" id="postPublishingSection">/);
  assert.match(template, /<details class="editor-section" id="postSeoSection">/);
  assert.match(template, /<details class="editor-section" id="positionDetailsSection">/);
  assert.match(template, /<details class="editor-section" id="positionSkillsSection">/);
});

test('content workspaces expose focused search instead of forcing users to scan every row', () => {
  assert.match(template, /id="postSearch"/);
  assert.match(template, /id="postShownCount"/);
  assert.match(template, /id="positionSearch"/);
  assert.match(template, /id="positionShownCount"/);
});

test('SEO keeps page selection visible and divides editing into task-sized tabs', () => {
  assert.match(template, /class="seo-page-nav card" aria-label="Page selection"/);
  for (const tab of ['essentials', 'social', 'sitemap', 'schema']) {
    assert.match(template, new RegExp(`data-seo-editor-tab="${tab}"`));
    assert.match(template, new RegExp(`data-seo-editor-panel="${tab}"`));
  }
  assert.doesNotMatch(template, /id="seoPageDialog"/);
});

test('admin uses the redesigned dashboard frame instead of the legacy flat shell', () => {
  assert.match(template, /class="admin-app admin-dashboard-frame"/);
  assert.match(template, /class="admin-topbar dashboard-command-bar"/);
  assert.match(template, /class="rail-profile"/);
  assert.match(template, /class="tailadmin-sidebar admin-nav dashboard-rail/);
});

test('dashboard shell never traps tall panels in a nested scroll area', () => {
  assert.doesNotMatch(stylesheet, /body:not\(\.admin-locked\) \{[^}]*overflow: hidden/);
  assert.doesNotMatch(stylesheet, /\.dashboard-canvas \{[^}]*overflow-y: auto/);
});
