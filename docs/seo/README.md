# ACS Engitech: SEO, crawlability and agent readiness

Everything in this folder is generated from `lib/acs-defaults.js` by `node scripts/export-seo-docs.js`.
Change titles, descriptions, keywords or schema there, then run `npm run seo:head` (writes the static `<head>` of every page) and the export script.

| File | Use |
| --- | --- |
| `robots.txt` | Paste into **Admin → Robots.txt**, then save. |
| `llms-admin-body.md` | Paste into **Admin → LLMs.txt → llms.txt body**, then save. The "When to use", Pages, Posts and Open positions sections are added automatically. |
| `llms.txt` | Preview of the full `/llms.txt` the site will serve after that save (without blog posts and positions, which come from the database). |
| `schema/*.json` | The JSON-LD on each page (already embedded in the HTML; for reference or for Google's Rich Results Test). |
| `pages.json` | Title, meta description, keywords and schema file for every page. |
| `sitemap-preview.xml` | What `/sitemap.xml` lists (blog posts are added live). |

## Is the site crawlable by Google?

**Yes.** Every public page is served as static HTML with its text in the source, `robots.txt` allows crawling, and the site is on HTTPS with `acsengitech.com` permanently redirecting to `www.acsengitech.com`. The audit found problems that weakened how Google indexes and ranks it; these are fixed in code:

| Found on the live site (22 Oct 2026) | Fix |
| --- | --- |
| Canonical, Open Graph and JSON-LD existed only after JavaScript ran, and most pages had one-word titles ("About", "Trading"). | Every public page now has its full SEO head in the static HTML (`scripts/seo-head.js`). |
| Test SEO edits saved in the admin were being applied on the live site by JavaScript: About page title "About Jaimin" with canonical `/about-us-page-gg`, home title "ACS Engitech" with canonical `/`. | SEO overrides saved before this release are retired; the admin now stores only fields that differ from the defaults and has **Reset to defaults**. Relative or off-site canonicals typed in the admin are ignored. |
| Canonicals and the sitemap used `https://acsengitech.com`, which redirects to `www`. | Every canonical, sitemap entry, schema URL and `llms.txt` link uses `https://www.acsengitech.com`. |
| `/sitemap.xml` contained relative URLs (`<loc>/</loc>`, `<loc>/about-us-page-gg</loc>`) and only 19 of 38 pages. | Sitemap lists all 38 public pages plus live posts, absolute URLs only. |
| `robots.txt` contained test lines ("jaimin test…") and pointed to the apex sitemap. | Use `robots.txt` in this folder. It keeps `/api/public` crawlable (Google needs it to render careers and blog listings) while blocking `/admin` and other APIs. |
| `og:image` URL returned 403. | New 1200×630 share image at `/assets/acs/og-image.jpg`. |
| 44 draft/alternate pages (`*-design`, `*-signal`, `index-console`, `header`, `footer`) were crawlable duplicates. | Served with `X-Robots-Tag: noindex, follow`. |
| `/process-automation-2` and `/smart-data-logger-2` duplicated other pages. | 308 permanent redirects to the main pages. |
| No privacy page; 404s were bare text. | `/privacy` page added (linked from every footer); branded 404 page; Markdown 404 for agents. |

## Agent readiness (Is Agentic / Ora audit items)

| Check | Status after this release |
| --- | --- |
| Agent-friendly 404 | `Accept: text/markdown` on a missing path returns **404** with a Markdown body linking `llms.txt`, the sitemap and contact. |
| Markdown content negotiation | `Accept: text/markdown` on any page (including `/`) returns the page as Markdown with `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`; `Accept: text/html` still returns HTML (also with `Vary: Accept`). Implemented in `middleware.js` + `api/markdown.js`. |
| JSON-LD on homepage | Organization + WebSite + WebPage graph in the static HTML. |
| Agent instructions | `/llms.txt` always includes "When to use ACS Engitech" and "How an agent should engage". |
| Organization completeness | `contactPoint` (sales, email, phone, hours) and `PostalAddress`, plus legal name, founding date, GST number, `knowsAbout`. |
| Metadata | `<html lang>`, canonical, `og:image`, `og:type` on every page. |
| Trust pages | `/about`, `/contact`, `/privacy` each with 500+ characters. |

Verify after deploy:

```
curl -sS -L -i -H 'Accept: text/markdown' https://www.acsengitech.com/
curl -sS -L -i -H 'Accept: text/html' https://www.acsengitech.com/
curl -sS -L -i -H 'Accept: text/markdown' https://www.acsengitech.com/some-path-that-does-not-exist
```

## Keyword map

| Keyword | Page |
| --- | --- |
| Electrical control panel manufacturer India | `/` and `/panel-manufacturer` |
| TTA panel manufacturers in India · IEC 61439 TTA panel manufacturers in India | `/panel-manufacturer` (also home) |
| Schneider Prisma SeT TTA panel manufacturer India · Rittal Ri4 Power TTA panel manufacturer India | `/panel-manufacturer` |
| PLC panel manufacturer in India · Siemens PLC panel manufacturer in India | `/panel-manufacturer` |
| Panel manufacturing partner for international OEMs | `/panel-manufacturer`, `/about` |
| MCC panel manufacturer in India | `/mcc-panel-manufacturer` |
| Intelligent MCC panel manufacturer India | `/imcc-panel-manufacturer` |
| ZLD plant automation panel manufacturer | `/multi-effect-evaporator-plant-automation`, `/process-automation` |
| MEE plant automation panel manufacturer in India | `/multi-effect-evaporator-plant-automation` |
| ETP automation panel manufacturer in India | `/process-automation` |
| Distillery plant automation panel manufacturer in India · CBG plant automation panel manufacturers in India | `/process-automation` (keywords and llms.txt only; see gaps) |
| Aluminium cold rolling mill automation · Skin pass mill automation · Pickling line and tandem cold mill automation · Automation migration for rolling mill (India) | `/machine-plant-automation` |
| Central operation cockpit manufacturer in India | `/centralized-automation` |
| Siemens PLC supplier in India | `/trading` and the 11 Siemens product pages |
| Siemens authorized system integrator in India | `/about`, `/trading`, home |

## Recommendations that need a decision or content

1. **Apply the crawler files** in the admin (`robots.txt`, `llms-admin-body.md`); the database copies currently override the defaults. Delete or unpublish the test blog post ("new jaimin blog") if it is still live.
2. **Write landing pages for keywords with no matching content**: TTA panels (Prisma SeT / Ri4Power), distillery automation, CBG plant automation, and a real Central Operation Cockpit page (`/centralized-automation` currently says "Something Exciting is Coming"). Meta tags alone will not rank thin or missing content.
3. **Contact form**: enquiries are now saved to Neon (`acs_enquiries`) and listed in the admin under **Enquiries**. An email notification to sales@acsengitech.com still needs an email provider and its credentials.
4. **Google Search Console**: verify `https://www.acsengitech.com`, submit `/sitemap.xml`, and check *Pages → Not indexed* for old WordPress URLs that need 301 redirects.
5. **Confirm social profiles** in `sameAs` (LinkedIn, Facebook, Instagram URLs) and the business hours in `contactPoint`; add a Google Business Profile URL if one exists.
6. **Have the privacy policy reviewed** by whoever handles legal for ACS (retention periods are proposed defaults).
7. Internal links use `.html` (e.g. `about.html`), which Vercel redirects to the clean URL; switching links to clean URLs would save a redirect per crawl.
