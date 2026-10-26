# ACS Admin Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered admin layouts with one compact, accessible workbench while retaining existing behavior.

**Architecture:** Keep the static HTML and vanilla renderer. Add semantic workspace hooks in the admin template, use the existing render functions for counts and records, and centralize appearance in the admin stylesheet.

**Tech Stack:** HTML, vanilla JavaScript, Tailwind CSS, Playwright, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-26-admin-workbench-design.md`

## Global Constraints

- Preserve all current API actions and form field names.
- Use the ACS visual identity; references inform patterns only.
- Keep native controls and status announcements accessible.

## Review Focus

- Narrow desktop and mobile layouts keep controls reachable.
- Filtering and opening panels never discards unsaved form values.
- Bulk operations remain explicit and never become visually hidden.
- Advanced sections are available without being in the default scan path.
- Save/error feedback remains visible long enough to act on.

### Task 1: Establish reusable workbench structure

**Files:**
- Modify: `admin-src/index.html`, `admin-src/css/style.css`
- Test: `tests/admin-workbench.spec.js`

- [ ] Write a failing browser test for grouped navigation, compact workspace command bars, and default-closed advanced editor sections.
- [ ] Implement shared shell and workspace hooks without changing controls or IDs.
- [ ] Run the browser test and production build.

### Task 2: Consolidate content and operational workflows

**Files:**
- Modify: `admin-src/index.html`, `admin-src/js/admin-app.js`, `admin-src/css/style.css`
- Test: `tests/admin-workbench.spec.js`

- [ ] Write a failing browser test that filters operational records and confirms a sticky active-selection summary.
- [ ] Implement compact command bars, counts, dense rows, and progressive editor sections.
- [ ] Run the browser test and targeted Node CRUD tests.

### Task 3: Verify and release

**Files:**
- Modify: `tests/admin-workbench.spec.js`

- [ ] Run the production build and the full relevant Node test suite.
- [ ] Perform a source and accessibility self-review against the spec.
- [ ] Commit and publish only after verification.
