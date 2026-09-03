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

## Pre-merge deploy-preview checklist (manual, required)

This gate cannot be automated in CI and must be run by the repo owner
against a live Vercel preview deploy before merging. Confirm all four and
record the result in the PR description:

1. A static public page still loads (e.g. `/about`).
2. `/admin` loads the re-skinned panel.
3. `/admin.html` redirects to `/admin/`.
4. Admin login reaches `/api/admin` (network request returns 200, data loads).
