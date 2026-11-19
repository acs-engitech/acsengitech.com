# Moving the site to a new GitHub, Vercel and Neon account

Goal: the same site, admin and data running on a different account, with the old one left untouched until the new
one is proven. Nothing here deletes anything on the old side.

## What lives where

| Thing | Where it lives now | How it moves |
|---|---|---|
| Code | GitHub repo `n8nmonk-wq/acsengitech` | `git push` of the full history to the new repo |
| Site content, team, applications, enquiries, analytics, operations platform | Neon (tables `acs_*` and `ops_*`) | `scripts/migrate-db.js` (exact copy, verified) |
| Team photos | Neon (table `acs_team_photos`) | moves with the database |
| Uploaded resumes and partner profiles | Vercel Blob (public links stored in the database) | `scripts/migrate-blobs.js` |
| Secrets (database URL, admin login, session secret, Blob token) | Old Vercel project > Settings > Environment Variables | typed into the new project by hand |
| Domain acsengitech.com | Old Vercel project > Settings > Domains | removed there, added to the new project |

The code reads these variables: `NEON_DATABASE_URL` (or `DATABASE_URL` / `POSTGRES_URL`), `BLOB_READ_WRITE_TOKEN`,
`ACS_ADMIN_EMAIL`, `ACS_ADMIN_PASSWORD_HASH` (or `ACS_ADMIN_PASSWORD`), `ACS_ADMIN_SESSION_SECRET`. Nothing is stored in
the repo, so all of them have to be read from the old project's settings.

## Order matters

Copy the database **before** anyone opens the new site. The first visit to a new, empty deployment fills the new database
with starter content, and the copy refuses to run into a database that already has rows (that is deliberate).

### 1. New Neon project
Create it in the same region as the site's functions (`vercel.json` pins `bom1`, Mumbai; pick the nearest Neon region).
Copy its connection string (the default one from the dashboard).

### 2. Check, then copy the database
In PowerShell, from the repo folder. The connection strings stay in this terminal session only.

```powershell
$env:OLD_DATABASE_URL = "<old Neon connection string>"
$env:NEW_DATABASE_URL = "<new Neon connection string>"
node scripts/migrate-db.js --dry-run     # reads only: lists tables and row counts, changes nothing
node scripts/migrate-db.js               # creates the tables, copies everything, verifies it
```

The old database is opened read-only, so this cannot change it. At the end every table is compared (row counts, and a
content checksum for tables up to 50,000 rows). Page-view analytics written by the live site during the copy can show as a
small difference; any other mismatch means: do not switch over, empty the new database and run it again.

### 3. New repository
Create an empty repo under the new GitHub account, then:

```powershell
git remote add new git@github.com:<new-account>/<new-repo>.git
git push new main
```

Keep `origin` (the old repo) as it is, as the backup. Vercel's free plan only deploys commits whose author email belongs to
the Vercel account owner, so check `git config user.email` matches the new account before pushing more commits.

### 4. New Vercel project
Import the new repo. Leave the framework as "Other"; the build command (`npm run build`) and output (`.`) come from
`package.json` and `vercel.json`. Then, before the first deploy:

- Storage > create a **Blob** store (this adds `BLOB_READ_WRITE_TOKEN`).
- Environment Variables: `NEON_DATABASE_URL` (the new string), `ACS_ADMIN_EMAIL`, `ACS_ADMIN_PASSWORD_HASH`,
  `ACS_ADMIN_SESSION_SECRET` (copy the old values; everyone signs in again if the secret changes).

### 5. Move the uploaded files
```powershell
$env:NEW_DATABASE_URL = "<new Neon connection string>"
$env:NEW_BLOB_READ_WRITE_TOKEN = "<the new project's Blob token>"
node scripts/migrate-blobs.js --dry-run
node scripts/migrate-blobs.js
```
Old files are only downloaded (never deleted) and the new database is pointed at the copies. Safe to run twice.

### 6. Test on the temporary address
Open the new project's `*.vercel.app` address and check: the home and About pages (team section), `/admin` sign-in, a few
applications with their resume links, the contact form. The old site is still serving visitors meanwhile.

### 7. Switch the domain
Old project > Settings > Domains: remove `acsengitech.com` and `www`. New project > Domains: add both. Vercel may ask for
a verification TXT record because the domain was on another account. The DNS records already point at Vercel, so this is
a quick change, best done at a quiet hour. Contact-form messages and applications that arrive between the database copy
and the switch exist only in the old database, so keep that gap short (run steps 2 and 7 close together) and check the old
admin once afterwards.

### 8. Afterwards
Leave the old Vercel project, Neon project and repo in place for a week or two. To roll back, put the domain back on the
old project. Then delete the old Blob store and database to free the allowance.

## If the new account runs out too

Usage, not the account, is what filled the old one. The likely drivers here: every page view writes one analytics row,
which keeps the Neon database awake around the clock, and the images are served from Vercel. Both can be cut a lot
(batched or sampled analytics, a longer database auto-suspend, smaller images) and are worth doing alongside the move.
