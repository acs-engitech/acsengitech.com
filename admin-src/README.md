# Admin build (Vercel deploy settings)

The admin panel source lives here (`admin-src/`) and is built by webpack into
`admin/` at the repo root via `npm run build` (script defined in
`package.json`, added in Task 1). Vercel serves the repo root directly, so
the built `admin/` output, the 44 static `.html` pages, and `api/`
(serverless functions) all ship from the same deployment — nothing is moved
or copied at deploy time beyond the build step itself.

**Vercel project settings (dashboard, not repo config):**
- **Build Command:** `npm run build`
- **Output Directory:** leave unset (no override). The root of the repo
  stays the served directory so the static `.html` pages and `api/` keep
  serving alongside the built `admin/` folder. Setting an Output Directory
  override would break the static pages and API routes.
- **`api/`** continues to deploy as serverless functions, unchanged.

### Routing

Routing (`vercel.json`, repo-tracked) is a single trailing-slash contract:
- `/admin` redirects (302) to `/admin/`.
- `/admin.html` redirects (301) to `/admin/` directly (one hop, not via `/admin`).
- `/admin/` is served as `admin/index.html` (Vercel's directory-index
  behavior — no rewrite needed).

The trailing slash is required because the built admin shell uses relative
asset/image paths (`assets/*`, `images/*`); without it those paths resolve
against the wrong base URL. Do not add a rewrite or redirect targeting bare
`/admin` as a destination — every path must land on `/admin/`.

## Required environment variables

Set these on the Vercel project (Project Settings -> Environment Variables):

- `NEON_DATABASE_URL` - Neon Postgres connection string (the `postgresql://...` URL from the Neon console). All admin content, SEO, blog posts, positions, applications and partner registrations are stored here; tables are created on first use. `DATABASE_URL` or `POSTGRES_URL` (the names the Vercel Neon integration creates) are used if `NEON_DATABASE_URL` is not set.
- `BLOB_READ_WRITE_TOKEN` - enables resume/profile file uploads (`/api/apply`, `/api/partner`) via `@vercel/blob`. Enable **Vercel Blob** on the project (Storage tab) and Vercel injects this automatically; no manual value needed. Without it, uploads fall back to a local stub path (`/uploads/...`) and log a warning - fine for local dev, not for production.
- `ACS_ADMIN_EMAIL` / `ACS_ADMIN_PASSWORD_HASH` - optional overrides for the admin login (`ACS_ADMIN_PASSWORD_HASH` is a sha256 hex digest of the password; `ACS_ADMIN_PASSWORD` in plain text also works). Unset, the login is `acsengitech@gmail.com` with the password ACS was given; only its sha256 hash is in the code.
- `ACS_ADMIN_SESSION_SECRET` - HMAC secret used to sign the admin session token that keeps you logged in across page refreshes (12h expiry). Recommended to set explicitly in production; if unset it falls back to `ACS_ADMIN_PASSWORD_HASH` (or the built-in default hash) so sessions work with zero extra config.

## Pre-merge deploy-preview checklist (manual, required)

This gate cannot be automated in CI and must be run by the repo owner
against a live Vercel preview deploy before merging. Confirm all four and
record the result in the PR description:

1. A static public page still loads (e.g. `/about`).
2. `/admin` loads the re-skinned panel.
3. `/admin.html` redirects to `/admin/`.
4. Admin login reaches `/api/admin` (network request returns 200, data loads).

## What the admin manages

- **SEO** - per page: title, meta description (with length counters), focus keyword, keywords, canonical, robots meta (presets for noindex/nofollow), Open Graph (title, description, image, type), Twitter card, sitemap inclusion/priority/change frequency, and JSON-LD (templates for Organization, LocalBusiness, WebPage, Service, BreadcrumbList, FAQPage, JobPosting and Article, plus a format/validate button). A search-result preview, a social-card preview and a checklist update as you type. Public pages apply these through `acs-runtime.js`.
- **Blogs** - drafts, publish dates and a publishing schedule. A post with a future publish date is scheduled and goes live on its own at that time (`/api/public`, `/sitemap.xml` and `/llms.txt` all check the time on each request).
- **Positions** (career listings) and **Applications** (applicant manager with status workflow, notes, filters and CSV export).
- **Partners** (vendor registrations) and **Analytics** (page views plus GA4 / GTM IDs).
- **Robots.txt** - served at `/robots.txt`, with checks and a reset to the recommended rules.
- **LLMs.txt** - served at `/llms.txt`: an editable Markdown body plus optional generated lists of pages, published posts and open positions, with a live preview.
- **Sitemap** - `/sitemap.xml` is generated from the SEO settings (pages not set to noindex or left out) and live blog posts.
