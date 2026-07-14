# Design: SEO-perfect Husägarens handbok

**Date:** 2026-07-14
**Status:** Approved design → implementation planning
**Goal:** Make the published handbook maximally discoverable by both search engines and AI agents/answer engines, without losing the search/browse UX.

## Problem

The site is a client-rendered single-page app with **hash routing** (`#/amne/<id>`).
Consequences for discoverability:

1. **One indexable URL.** All 59 subjects share `https://rhorno.github.io/husagarens-handbok/`. Crawlers ignore hash fragments, so there is effectively one page, not sixty.
2. **JS-only content.** `<main>` is empty in the HTML source; content is injected via `innerHTML` from a 2.62 MB `data.js`. Googlebot can render JS, but most AI crawlers (ClaudeBot, GPTBot, PerplexityBot, etc.) do not — they see nothing.
3. **No SEO head/metadata.** No meta description, canonical, Open Graph, structured data, sitemap, or robots directives.

## Decisions (locked with user)

- The historical hard requirement that the site run over `file://` is **dropped**. Target is GitHub Pages; SEO wins.
- **Navigation:** true multi-page site with plain `<a href>` links (full page loads). No client-side routing.
- **Search index loading:** lazy — the index downloads only on first search interaction.
- **Meta descriptions:** auto-derived from each subject's *Översikt* section (~155 chars).
- **Hosting:** stay on `rhorno.github.io/husagarens-handbok/` for now; `BASE_URL` isolated so a custom-domain switch is a one-line change. Custom domain recorded as a future upgrade (see below).

## Architecture

`build.mjs` grows from "emit `data.js`" into a static-site generator. It parses/validates content (unchanged), builds the in-memory `HANDBOK` object (unchanged), then **renders static output**:

```
site/
  index.html                 # home: intro + all categories + all subject links (pre-rendered)
  amne/<id>/index.html       # 59 subject pages — full content baked into <main>
  kategori/<id>/index.html   # 7 category hub pages
  search-index.js            # slim, TEXT-ONLY search data (lazy-loaded)
  404.html                   # branded not-found page
  sitemap.xml
  robots.txt
  llms.txt                   # Markdown index of the handbook for LLM/agent consumption
  llms-full.txt              # full plain-text of all subjects, concatenated
  assets/og-default.png      # 1200×630 social card (committed asset)
  app.js  search.js  styles.css  .nojekyll
```

- **URLs:** clean directory style with trailing slash — `/amne/tak/`, `/kategori/husets-skal/`. Canonical URLs are absolute (`BASE_URL` + path).
- **`data.js` is removed** from the site. Its runtime role (client rendering + search) is replaced by pre-rendered HTML + the slim `search-index.js`. The `HANDBOK` object still exists in-memory during the build.
- **Sidebar is pre-rendered** into every page (7 categories + 59 subject links) — real anchors, a strong internal-linking signal. Active state (`aria-current="page"`) is set at build time per page. `app.js` keeps only collapse/mobile-toggle behavior.
- **Path prefix:** all internal `href`s use an absolute path prefix derived from `BASE_URL` (e.g. `/husagarens-handbok/amne/tak/`). Deriving it from `BASE_URL` means a custom-domain switch changes one constant.

### Components (each small, independently testable)

| Module | Responsibility |
|---|---|
| `build/base-url.mjs` (or a const in `build.mjs`) | `BASE_URL`, derived `PATH_PREFIX`, URL/href helpers |
| `build/describe.mjs` | Derive meta description from a subject's Översikt section |
| `build/page-template.mjs` | Render `<head>` (title, meta, canonical, OG/Twitter, JSON-LD) + shared shell (header, pre-rendered sidebar, breadcrumbs, footer) |
| `build/render-pages.mjs` | Render home, 59 subject pages, 7 category pages from `HANDBOK` |
| `build/search-index.mjs` | Emit slim `search-index.js` (text-only) |
| `build/discovery.mjs` | Emit `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, `404.html` |

`build.mjs` orchestrates: validate → build `HANDBOK` → render pages → write search index → write discovery files.

## Per-page `<head>`

Every generated page includes:

- Unique `<title>` (subject: `"<Titel> — Husägarens handbok"`; category: `"<Kategori> — Husägarens handbok"`; home: `"Husägarens handbok — …"`).
- `<meta name="description">` — subject/category derived; home is hand-written.
- `<link rel="canonical" href="<absolute>">`.
- Open Graph: `og:type` (`article` for subjects, `website` for home/category), `og:title`, `og:description`, `og:url`, `og:site_name` (`Husägarens handbok`), `og:locale` (`sv_SE`), `og:image` (`assets/og-default.png`, absolute).
- Twitter: `twitter:card=summary_large_image`, title/description/image.
- `<meta name="robots" content="index,follow">`.
- `lang="sv"` on `<html>` (already present).
- The existing pre-paint theme script and favicon are preserved.

## Structured data (JSON-LD)

Emitted inline in each page's `<head>`. Serves Google rich results **and** gives AI answer engines clean, attributable facts.

- **Home:** `WebSite` (with `SearchAction`/sitelinks search box pointing at the on-site search) + `Organization`/publisher (name `Husägarens handbok`).
- **Subject pages:** `TechArticle` — `headline`, `description`, `inLanguage: "sv-SE"`, `datePublished`, `dateModified`, `publisher`, `mainEntityOfPage`, and `citation` entries built from the subject's Källor (title + url). Plus a separate `BreadcrumbList` (Hem › Kategori › Ämne).
- **Category pages:** `CollectionPage` listing member subjects + `BreadcrumbList`.
- **Dates:** `dateModified` = git last-commit date of the content `.md` (fallback: build time); `datePublished` = git first-commit date of the file (fallback: same as modified). Computed in the build.

## Visible breadcrumbs

Each subject and category page renders a visible breadcrumb trail (`Hem › <Kategori> › <Ämne>`) above the `<h1>`, matching the `BreadcrumbList` JSON-LD. Small CSS addition to `styles.css`.

## Discovery files

- **`sitemap.xml`** — all 67 URLs (home + 7 categories + 59 subjects) with `<lastmod>` from the build.
- **`robots.txt`** — `User-agent: *` / `Allow: /`, plus `Sitemap: <BASE_URL>/sitemap.xml`.
- **`llms.txt`** — Markdown: H1 title, blockquote summary, then subjects grouped by category as `[Titel](url) — <description>` links. (Emerging convention for LLM/agent consumption.)
- **`llms-full.txt`** — every subject's title + plain text concatenated, for agents that want the full corpus in one fetch.

> **Subpath caveat:** on a GitHub Pages *project* site, crawlers only honor `robots.txt`/`llms.txt` at the host root (`rhorno.github.io/…`), which is a different repo. At our subpath these files are non-authoritative (harmless, still useful if the site later moves to root/custom domain). The `sitemap.xml` remains submittable via Search Console regardless.

## Search behaviour changes

- `search-index.js` sets a global with **text-only** entries: `{ id, titel, kategori, nyckelord, sections: [{ title, level, text }] }`. Drops all rendered HTML (≈ the 1.39 M chars of `html`), keeping ≈ 0.97 M chars of `text`; gzipped by Pages this roughly halves the transfer vs today's `data.js`.
- `app.js` lazy-loads `search-index.js` on the first `focus`/input of the search box, then builds the index via the existing `SearchLib.buildIndex` and runs searches as today.
- Selecting a result navigates to the real URL `<PATH_PREFIX>/amne/<id>/#sec-<idx>` (full page load). Pre-rendered subject pages keep `id="sec-<idx>"` on each section so the anchor jump works.
- `search.js` / `SearchLib` logic is unchanged (still consumes `{sections:[{title,level,text}]}`).

## Back-compat for old hash links

`index.html` carries a tiny inline script: if `location.hash` matches `#/amne/<id>(/<sec>)?`, `location.replace()` to `<PATH_PREFIX>/amne/<id>/(#sec-<sec>)`. Preserves any external links/bookmarks to the old SPA.

## `og:default.png` asset

A single 1200×630 branded social card (`site/assets/og-default.png`), referenced by all pages. Generated once locally (e.g. render an HTML card via the available `playwright-cli` and save the PNG) and **committed** — CI does not run a browser, so this asset is not regenerated in CI.

## Build outputs & git

CI (`.github/workflows/pages.yml`) already runs `node build.mjs` before deploying `./site`, so derived files need not be committed.

- **Gitignore** the generated artifacts: `site/index.html`, `site/amne/`, `site/kategori/`, `site/search-index.js`, `site/sitemap.xml`, `site/robots.txt`, `site/llms.txt`, `site/llms-full.txt`, `site/404.html`.
- **Remove** the now-obsolete committed `site/data.js` (untrack + delete; regenerated role gone).
- **Committed and kept:** `site/app.js`, `site/search.js`, `site/styles.css`, `site/.nojekyll`, `site/assets/og-default.png`.
- The Pages workflow gains no new steps (build already produces everything); the test step stays.

## Testing (TDD, extends existing `tests/*.test.mjs`)

New/extended tests:

- **Description derivation** (`describe.mjs`): given a subject with an Översikt section, produces a trimmed ≤~155-char description; handles short/empty Översikt.
- **Page rendering:** each subject page contains its `<h1>` title, all section bodies (content present in HTML source), a correct absolute `<link rel="canonical">`, `TechArticle` + `BreadcrumbList` JSON-LD, and the pre-rendered sidebar with 59 links.
- **Category pages:** contain member subjects and `CollectionPage`/breadcrumb JSON-LD.
- **Sitemap:** contains exactly the 67 expected URLs with `lastmod`.
- **Search index:** text-only shape (no `html` key), one entry per subject, sections carry `text`.
- **Path prefix / BASE_URL:** internal hrefs and canonical/OG/sitemap URLs all derive from `BASE_URL` (change `BASE_URL` → all URLs change consistently).
- Existing 59 content tests remain green.

## Out of scope / future upgrades

- **Custom domain** (e.g. `husagarenshandbok.se`): unlocks authoritative root-level `robots.txt`/`llms.txt`/`sitemap.xml` and drops the `/husagarens-handbok/` path prefix. Biggest structural SEO upgrade beyond this work; implemented later by adding a `CNAME` and changing `BASE_URL`.
- Per-page unique `og:image` cards (dynamic generation).
- FAQ/HowTo structured data (would require restructuring content into Q&A/step form).
- Submitting the sitemap to Google Search Console / Bing Webmaster Tools (operational, not code).
```
