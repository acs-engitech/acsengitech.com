# ACS Admin Workbench Design

## Intent

Make every admin task readable and quick without changing the API, storage model, or public site. The admin should feel like one operational workspace instead of a collection of long forms.

## Goals

- Use one layout language across content, CRM-style records, settings, and analytics.
- Keep the common action visible and move optional configuration behind named disclosure panels.
- Make filters, counts, selections, saves, and errors immediately understandable.
- Preserve every existing CRUD action and keyboard-accessible native control.

## Non-goals

- No copied visual design from the supplied references.
- No database, API, authentication, or public-site changes.
- No decorative dashboard widgets that do not support an admin task.

## Chosen approach

Use a compact workbench shell: grouped navigation, an action-oriented header, reusable command bars, sticky desktop list panes, dense record rows, and collapsible advanced editor sections. This takes the useful interaction patterns from the references while preserving ACS branding and the existing operational model.

## Decisions

- Content editors keep their current full forms but put publishing/SEO or role-detail fields in collapsible sections.
- Enquiries, applications, and partners share the same list-workflow treatment: status chips, one command bar, selection state, and reduced row clutter.
- Saving remains optimistic for row-level changes, with visible non-blocking progress and durable error feedback.
