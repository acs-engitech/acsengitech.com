# ACS Engitech — Operations ERP & Management System

## Objective

Extend the existing ACS platform into a **unified, role-based operations system** covering trading, purchasing, inventory, dispatch, customer enquiries and director-level monitoring.

Build an accurate, efficient, visually premium business application—not disconnected dashboards or duplicated ERP functionality.

**Three outcomes:**
1. Role-based administration and independent operational workspaces.
2. Connected enquiry-to-procurement-to-delivery workflows with shared inventory.
3. A director's command center showing live operational status, exceptions, financial exposure and actionable insights.

## 1. Source of Truth & Execution

Work inside the existing ACS repository. Read the relevant instructions, architecture, conventions and business context from the local Obsidian vault first.

**Do not assume previous conversation memory is authoritative.** Verify the actual codebase, database, existing modules and integrations.

Use available skills, orchestration, subagents and validation tools selectively when they improve accuracy or reduce implementation effort. Avoid redundant agent calls and prolonged planning cycles.

The business rules below define the intended workflow. Where implementation details are missing, resolve them against existing architecture; raise only genuinely blocking decisions.

## 2. Roles & Workspaces

### Existing `/admin`

- **Superadmin / Directors:** full authorized system visibility, operational approvals, reporting and user management.
- **HR:** positions, job applications and assigned enquiries.
- **Content/SEO Manager:** page SEO, blog publishing and related content management. Current placeholder identity is *John Doe*; role must be independent of username.

Enforce permissions server-side, not merely through hidden UI elements.

### New operational modules

| Workspace | Responsibility |
|---|---|
| `/trading` | Customer enquiries, quotations, revisions, approval/rejection, commercial coordination |
| `/purchase` | Supplier management, RFQs, supplier quotations, comparisons, negotiations, purchasing and receipts |
| `/dispatch` | Fulfilment, shipment planning, dispatch records, tracking, delivery confirmation |
| `/sales` | Reserved for future development; do not invent business workflows now |
| Customer portal | Authenticated customer access to their enquiries, proposals, quotation revisions and order/dispatch status |

Use secure customer routes such as `/portal/<username>` or an equivalent structure compatible with existing routing. Never expose another customer's data through predictable usernames or URLs.

Each operational module needs appropriate authentication, permissions, task views, tables, searchable records, attachments, audit history, analytics and dashboards.

All modules must operate on **connected business records**, not isolated copies.

## 3. Trading Workflow

Customer enquiry → product identification → stock/availability check → quotation preparation → internal commercial review → customer quotation → accepted/rejected/revision requested.

Support multiple quotation versions, pricing, quantities, validity periods, attachments, comments and activity history.

When stock is insufficient or supplier pricing is required, create a linked procurement request.

Purchasing provides approved supplier costs and availability back to Trading. Trading prepares or updates the customer-facing proposal.

A customer acceptance creates an actionable fulfilment requirement, subject to configured approval/payment rules.

**Keep supplier costs internal.** Customer-facing proposals show approved selling prices only.

## 4. Purchasing Workflow

Procurement request → supplier RFQs → supplier offers → comparison/negotiation → selected supplier → purchase approval → purchase order → goods receipt → stock update.

Maintain supplier profiles, product mappings, pricing history, lead times, taxes, payment terms, delivery commitments and supporting documents.

Supplier evaluation must consider landed cost, lead time, availability and reliability—not lowest quoted price alone.

Purchasing must communicate confirmed costs, expected availability and receipt status to Trading and Dispatch.

A supplier quote is **not** received inventory. Stock increases only through a valid receipt/adjustment transaction.

## 5. Shared Inventory — Critical Business Rule

Inventory supports both:

- ACS internal production requirements.
- External trading/customer orders.

Track at minimum:

**On-hand, production-reserved, customer-reserved, available-to-promise, incoming, reorder requirement and stock movement history.**

Example:

ACS has 15 Siemens units, with 15 required/reserved for production. A customer requests 5 units.

The system must not silently treat those 15 units as freely saleable.

An authorized user can approve reallocating 5 units to Trading, leaving 10 physically allocated to production and creating a **5-unit production replenishment requirement**.

Alternatively, procure the customer's 5 units without disturbing production allocation.

The UI must clearly show both options, the effect on production availability, supplier lead time and approval responsibility.

**Never allow duplicate reservations, negative availability through normal workflows, or untraceable inventory changes.**

Support partial fulfilment, cancellations, supplier delays and stock reconciliation.

## 6. Dispatch Workflow

Approved customer order → fulfilment readiness → stock allocation/receipt confirmation → pick/pack → shipment → tracking → delivery confirmation.

Capture customer, linked quotation/order, supplier or stock source, quantities, warehouse/location, shipment documents, courier/transporter, dispatch date and delivery status.

Support partial shipments and exceptions.

Dispatch should consume confirmed order, stock and purchase data automatically rather than requiring repeated manual entry.

## 7. Director Command Center — `/admin`

This is the central operational intelligence layer, not a collection of unrelated dashboards.

Create a single coherent monitoring experience with:

- Cross-module Kanban/pipeline showing where each enquiry/order currently stands.
- Module tabs: Trading, Purchasing, Inventory, Dispatch, HR and future Sales.
- Linked lifecycle view showing each transaction's complete journey.
- KPI summaries with trends and comparisons.
- Graphs for enquiry conversion, quotation value, procurement spend, supplier performance, stock availability, order fulfilment and dispatch delays.
- Bottleneck detection, overdue approvals, low stock, supplier delays and operational exceptions.
- Drill-down from every metric or Kanban item to its underlying records.
- Role-aware filtering, date ranges, search, export and actionable alerts.

Prioritize **operational clarity over chart quantity**.

Metrics must come from real source data and clearly distinguish real-time, periodically refreshed and historical information.

No fabricated analytics, decorative graphs or misleading placeholder statistics.

## 8. Visual UX & Design System

The entire application should feel like one premium, modern industrial operations platform.

Design principles:

- Clear **What / Why / How** at every workflow stage.
- Information-dense but readable screens.
- Professional typography, disciplined spacing and consistent component hierarchy.
- Strong tables, status indicators, timelines, Kanban, comparisons and contextual actions.
- Different workspaces, one coherent design language.
- Meaningful micro-interactions and fast navigation.
- Responsive layouts, accessible controls, loading/empty/error states.
- Explicit confirmations and undo/recovery where appropriate.
- No generic AI-generated dashboard appearance, excessive cards or ornamental animations.

Create shared UI primitives and a consistent design system without sacrificing module-specific functionality.

## 9. Open-Source Resources

Evaluate:

- ERPNext: https://github.com/frappe/erpnext
- Frappe UI: https://github.com/frappe/frappe-ui

Reuse proven ERP workflow patterns and compatible components where appropriate.

**Do not blindly install, migrate to or embed ERPNext.**

First identify the existing stack, data ownership and integration boundaries. Choose the least disruptive architecture capable of supporting the required workflows reliably.

If Frappe UI is incompatible with the current TailAdmin stack, adapt its design patterns or select suitable open-source components instead of triggering unnecessary framework migration.

Preserve applicable licensing obligations.

## 10. Data Integrity & Security

Required across modules:

- Central product/item identity and consistent units.
- Linked enquiry, quotation, procurement, inventory, order and shipment records.
- Role-based and record-level authorization.
- Auditable stock, pricing, approval and status changes.
- Controlled state transitions and rollback/recovery.
- Validations preventing duplicate orders, incorrect reservations and inconsistent fulfilment.
- Protected supplier pricing and customer data.
- No exposed credentials or unsecured public operational endpoints.

Preserve existing production functionality, admin records, public website, SEO, forms and integrations unless a verified requirement demands a compatible change.

## 11. Delivery Strategy

This is an **outcome-driven implementation**, not an endless concept/prototype exercise.

First perform a focused architecture and workflow audit. Establish the existing implementation, reusable components, missing entities, dependencies and migration risks.

Then execute in a dependency-safe sequence:

1. Shared identity, permissions, data model and inventory rules.
2. Trading and customer quotation lifecycle.
3. Purchasing and supplier procurement lifecycle.
4. Customer portal and linked approvals.
5. Dispatch and fulfilment.
6. Director monitoring and analytics.
7. Full-system UX polish and verification.

Implement usable connected vertical slices, not disconnected frontends.

Use checkpoints, migrations, tests and clear completion criteria. Do not replace working functionality unnecessarily.

The reserved `/sales` module must remain untouched until its requirements are defined.

## 12. Verification & Completion

Verify real workflows end to end:

- Enquiry → quotation → customer approval/revision.
- Shortfall → supplier comparison → purchase approval → receipt.
- Production stock reservation → authorized reallocation → replenishment.
- Approved order → dispatch → delivery.
- Directors see correctly synchronized statuses across modules.
- Unauthorized users cannot access restricted records or actions.

Test permissions, calculations, partial quantities, competing stock reservations, failures, responsiveness, navigation and existing feature regressions.

**Do not claim completion without executing the relevant tests and checking the resulting application.**

## Final Instruction

Own the architecture and implementation decisions within these business constraints.

Use the existing Obsidian context and repository to avoid rediscovery. Make informed choices, preserve working systems and prioritize the highest-value deliverables.

Avoid repeated approval gates for ordinary engineering decisions. Request confirmation only for material business-policy decisions, destructive migrations or security-sensitive changes.

**The objective is one dependable, interconnected ACS operations platform where employees can execute work and directors can understand and control the entire business from a unified visual command center.**

Report actual implementation progress, verified outcomes, blockers and remaining work accurately. Never present an incomplete workflow as finished.
