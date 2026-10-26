const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const template = fs.readFileSync(path.join(__dirname, '..', 'admin-src', 'index.html'), 'utf8');

test('admin template uses shared workbench structure instead of repeated ungrouped sections', () => {
  for (const label of ['Workspace', 'Content', 'Operations', 'Site intelligence']) {
    assert.match(template, new RegExp(`class="nav-group-label"[^>]*>${label}<`));
  }

  assert.equal((template.match(/workspace-toolbar filter-row/g) || []).length, 3);
  assert.equal((template.match(/workspace-bulkbar bulk-row/g) || []).length, 3);
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

test('SEO uses an on-demand page picker so the editor remains a single focused canvas', () => {
  assert.match(template, /id="openSeoPagePicker"/);
  assert.match(template, /<dialog id="seoPageDialog" class="workbench-picker">/);
  assert.match(template, /class="seo-editor-canvas card space-y-5" id="seoForm"/);
});
