# ACS operations platform

Trading, purchasing, shared inventory, dispatch, the customer portal and the directors' command center,
built into the existing site (static pages + Vercel functions + Neon + Alpine/Tailwind).

## Where things are

| Path | What |
|---|---|
| `/admin/command` | Director command center: KPIs, cross-module pipeline (Kanban), approvals, exceptions, analytics per module, lifecycle drawer |
| `/ops/trading`, `/ops/trading/<id>` | Enquiries, website inbox, customers; enquiry record with stock options, sourcing, quotation versions, order |
| `/ops/purchase` | Procurement requests, RFQs, ranked supplier offers, purchase orders, receipts, suppliers |
| `/ops/inventory` | Shared stock (production vs customer vs free vs incoming), counts, production plan, movement ledger |
| `/ops/dispatch` | Reserved stock → shipment → delivery, partial shipments, exceptions |
| `/ops/sales` | Reserved; intentionally empty |
| `/ops/people` | Staff and customer accounts (directors only) |
| `/portal/<slug>` | Customer portal: own enquiries, sent quotations (accept / request changes / decline), order and delivery status |
| `/admin/` | Existing website admin, now role-scoped: HR sees positions/applications/contact messages, Content sees SEO/blogs/analytics/robots/llms |

The public `/trading` page is an SEO page, so the operational workspaces live under `/ops/*`.

## Code

- `lib/ops/schema.js` — tables (`ops_*`), created idempotently on first use.
- `lib/ops/rules.js` — pure rules: stock position / available-to-promise, fulfilment options, supplier ranking, totals, order status, pipeline stage.
- `lib/ops/service.js` — every workflow command, one transaction each, with permission check, state check, stock ledger move and audit event.
- `lib/ops/queries.js` — read models per workspace and the command-center metrics.
- `lib/ops/rbac.js` — roles and permissions (server-enforced).
- `lib/ops/auth.js` — staff/customer accounts (scrypt), session tokens; the existing superadmin login is the director.
- `api/ops.js` — `GET /api/ops?view=…`, `POST /api/ops { action, input }`.
- `ops-src/` — the UI bundle (built to `ops/`, git-ignored like `admin/`).

## Business rules enforced in code

- Stock changes only through `ops_stock_moves` (receipt, adjustment, reservation, reallocation, dispatch). `production_reserved + customer_reserved <= on_hand` is also a database CHECK.
- A supplier quote never adds stock; only a goods receipt does. Received units are allocated to the order line or production need they were bought for; the rest is free.
- Production stock goes to a customer only through a director-approved reallocation, which creates the production replenishment request automatically.
- Every quotation is approved by a director before it can be sent; every purchase order is approved before it counts as incoming.
- One order per enquiry; one live quotation version per enquiry (new revisions supersede).
- Choosing a supplier offer that is not top-ranked requires a written reason.
- Supplier costs and margins never reach customers or the dispatch role.

## Configuration

Production uses the same Neon database as the site (`NEON_DATABASE_URL` / `DATABASE_URL` / `POSTGRES_URL`) through
`@neondatabase/serverless`'s `Pool` (WebSocket) so commands get real transactions. No new environment variables are required;
`ACS_ADMIN_SESSION_SECRET` (already recommended) also signs operations sessions.

Build: `npm run build` now also runs `webpack --config ops-src/webpack.config.js`.

## Local development

```
npm run ops:seed-demo -- --reset   # demo company in .data/ops-pglite (refuses to run against Neon)
npm run dev                        # http://localhost:3000/admin/command
```

Without a Neon URL, `local-dev-server.js` points the operations platform at an embedded Postgres (PGlite) under `.data/`.
Demo logins are listed at the top of `scripts/ops-seed-demo.js`.

## Tests

`node --test` runs `tests/ops-workflow.test.js` (full workflows on a real Postgres engine: reallocation, sourcing → PO → partial receipts,
partial dispatch, cancellations, permissions, concurrency, metrics) and `tests/admin-roles.test.js` (role-scoped `/admin`).
