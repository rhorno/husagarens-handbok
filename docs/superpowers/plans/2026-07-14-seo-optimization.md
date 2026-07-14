# SEO-perfect Husägarens handbok — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the client-rendered hash-routed SPA into a pre-rendered multi-page static site so every subject is an independently crawlable URL with full content, metadata, and structured data in the HTML source.

**Architecture:** `build.mjs` becomes a static-site generator. It keeps building the in-memory `HANDBOK` object (unchanged `buildData`), then renders: a home page, 7 category pages, 59 subject pages (full content baked into `<main>`), a slim text-only `search-index.js` (lazy-loaded by the client), plus `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`, and `404.html`. `site/app.js` drops routing/content-rendering and keeps only theme, sidebar interaction, scroll-spy, footnote jumps, and lazy search. All URLs derive from a single `BASE_URL`.

**Tech Stack:** Node 22 ESM (build), vanilla classic-script browser JS (site), `node:test`, no external dependencies. Hosted on GitHub Pages project path.

## Global Constraints

- **No external/runtime dependencies.** Build is Node-only ESM; site JS is classic `<script>` (no imports/modules). (Verbatim from repo convention.)
- **Node version:** 22 (matches `.github/workflows/pages.yml`).
- **Single URL source of truth:** every absolute URL and internal href derives from `BASE_URL = "https://rhorno.github.io/husagarens-handbok"`. Switching to a custom domain must be a one-constant change.
- **Language:** all user-facing copy is Swedish; `<html lang="sv">`; `inLanguage: "sv-SE"`.
- **Tests:** `node --test tests/*.test.mjs` must stay green (existing 59-subject content tests included).
- **Section anchors:** each rendered subject section keeps `id="sec-<idx>"` and `data-sec-idx="<idx>"` (idx = position in `amne.sections`, Källor included), matching today's app.js so in-page anchors and scroll-spy work.
- **Search index global:** the lazy index file sets `globalThis.HANDBOK_SEARCH` to an array consumable by the existing `SearchLib.buildIndex(subjects)` — i.e. `[{id, titel, nyckelord, sections:[{title, level, text}]}]`.

---

### Task 1: URL helpers (`build/site-url.mjs`)

Foundation for every generated URL. A `createUrls(baseUrl)` factory (testable with any base) plus default bindings for the real `BASE_URL`.

**Files:**
- Create: `build/site-url.mjs`
- Test: `tests/site-url.test.mjs`

**Interfaces:**
- Produces:
  - `BASE_URL: string`
  - `createUrls(baseUrl) -> { PATH_PREFIX, href(path), absUrl(path), subjectPath(id), categoryPath(id), HOME_PATH }`
  - Default bindings (bound to `BASE_URL`): `PATH_PREFIX`, `href`, `absUrl`, `subjectPath`, `categoryPath`, `HOME_PATH`
  - `href('/x')` → `PATH_PREFIX + '/x'` (root-relative, path-prefixed). `absUrl('/x')` → `baseUrl + '/x'`. `subjectPath('tak')` → `'/amne/tak/'`. `categoryPath('inomhus')` → `'/kategori/inomhus/'`. `HOME_PATH` → `'/'`.

- [ ] **Step 1: Write the failing test**

```js
// tests/site-url.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_URL, createUrls, absUrl, href, subjectPath, categoryPath } from '../build/site-url.mjs';

test('BASE_URL has no trailing slash', () => {
  assert.equal(BASE_URL.endsWith('/'), false);
});

test('subjectPath and categoryPath build directory-style paths', () => {
  assert.equal(subjectPath('tak'), '/amne/tak/');
  assert.equal(categoryPath('inomhus'), '/kategori/inomhus/');
});

test('project-path base keeps the prefix in href but not in absUrl host path duplication', () => {
  const u = createUrls('https://rhorno.github.io/husagarens-handbok');
  assert.equal(u.PATH_PREFIX, '/husagarens-handbok');
  assert.equal(u.href('/amne/tak/'), '/husagarens-handbok/amne/tak/');
  assert.equal(u.absUrl('/amne/tak/'), 'https://rhorno.github.io/husagarens-handbok/amne/tak/');
  assert.equal(u.absUrl('/'), 'https://rhorno.github.io/husagarens-handbok/');
});

test('root-domain base yields empty prefix (custom-domain swap is one line)', () => {
  const u = createUrls('https://husagarenshandbok.se');
  assert.equal(u.PATH_PREFIX, '');
  assert.equal(u.href('/amne/tak/'), '/amne/tak/');
  assert.equal(u.absUrl('/amne/tak/'), 'https://husagarenshandbok.se/amne/tak/');
});

test('default href/absUrl are bound to BASE_URL', () => {
  assert.equal(href('/styles.css'), createUrls(BASE_URL).href('/styles.css'));
  assert.equal(absUrl('/'), createUrls(BASE_URL).absUrl('/'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site-url.test.mjs`
Expected: FAIL — cannot find module `../build/site-url.mjs`.

- [ ] **Step 3: Implement**

```js
// build/site-url.mjs
// Single source of truth for every URL the site emits. Switching to a custom
// domain is a one-line change to BASE_URL.

export const BASE_URL = 'https://rhorno.github.io/husagarens-handbok';

export function createUrls(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const PATH_PREFIX = new URL(trimmed).pathname.replace(/\/+$/, ''); // '' for root domains
  const HOME_PATH = '/';
  const href = (path) => PATH_PREFIX + path;      // root-relative, path-prefixed
  const absUrl = (path) => trimmed + path;         // absolute
  const subjectPath = (id) => `/amne/${id}/`;
  const categoryPath = (id) => `/kategori/${id}/`;
  return { PATH_PREFIX, HOME_PATH, href, absUrl, subjectPath, categoryPath };
}

const _default = createUrls(BASE_URL);
export const PATH_PREFIX = _default.PATH_PREFIX;
export const HOME_PATH = _default.HOME_PATH;
export const href = _default.href;
export const absUrl = _default.absUrl;
export const subjectPath = _default.subjectPath;
export const categoryPath = _default.categoryPath;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site-url.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add build/site-url.mjs tests/site-url.test.mjs
git commit -m "feat: URL helpers with single BASE_URL source"
```

---

### Task 2: Meta-description deriver (`build/describe.mjs`)

**Files:**
- Create: `build/describe.mjs`
- Test: `tests/describe.test.mjs`

**Interfaces:**
- Produces: `deriveDescription(text, maxLen = 155) -> string` — collapses whitespace; returns text unchanged if ≤ maxLen; otherwise cuts at the last word boundary within maxLen, strips trailing punctuation, appends `…`. Empty/nullish → `''`.

- [ ] **Step 1: Write the failing test**

```js
// tests/describe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDescription } from '../build/describe.mjs';

test('empty or nullish yields empty string', () => {
  assert.equal(deriveDescription(''), '');
  assert.equal(deriveDescription(null), '');
  assert.equal(deriveDescription(undefined), '');
});

test('short text is returned unchanged with whitespace collapsed', () => {
  assert.equal(deriveDescription('Ett  kort\ntext.'), 'Ett kort text.');
});

test('long text is cut at a word boundary and gets an ellipsis', () => {
  const long = 'a'.repeat(10) + ' ' + 'b'.repeat(200);
  const out = deriveDescription(long, 155);
  assert.ok(out.length <= 156, `len ${out.length}`);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('b'.repeat(200)));
  // does not cut mid-word: the piece before the ellipsis has no trailing partial 'b' run glued to 'a's
  assert.ok(out.startsWith('aaaaaaaaaa'));
});

test('trailing punctuation is stripped before the ellipsis', () => {
  const out = deriveDescription('Hej hej hej, ' + 'x'.repeat(200), 16);
  assert.ok(!/[,\s]…$/.test(out));
  assert.ok(out.endsWith('…'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/describe.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/describe.mjs
// Derives a meta description from a subject's Översikt plain text.

export function deriveDescription(text, maxLen = 155) {
  const clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  const slice = clean.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s.,;:!?–—-]+$/, '') + '…';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/describe.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/describe.mjs tests/describe.test.mjs
git commit -m "feat: meta-description deriver"
```

---

### Task 3: Publish/modified dates (`build/dates.mjs`)

**Files:**
- Create: `build/dates.mjs`
- Test: `tests/dates.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeDates(createdRaw, modifiedRaw, fallback) -> { datePublished, dateModified }` — trims inputs; empty `created` → `fallback`; empty `modified` → `created` (or `fallback`).
  - `gitDates(absPath, fallback) -> { datePublished, dateModified }` — reads git add/last-commit short dates (`%cs`, `YYYY-MM-DD`) for the file; on any failure falls back via `normalizeDates('', '', fallback)`. (Not unit-tested; exercised via build.)

- [ ] **Step 1: Write the failing test**

```js
// tests/dates.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDates } from '../build/dates.mjs';

test('uses raw values when present', () => {
  assert.deepEqual(normalizeDates('2026-01-02', '2026-03-04', '2026-07-14'),
    { datePublished: '2026-01-02', dateModified: '2026-03-04' });
});

test('empty modified falls back to created', () => {
  assert.deepEqual(normalizeDates('2026-01-02', '', '2026-07-14'),
    { datePublished: '2026-01-02', dateModified: '2026-01-02' });
});

test('empty created falls back to the build date for both', () => {
  assert.deepEqual(normalizeDates('', '', '2026-07-14'),
    { datePublished: '2026-07-14', dateModified: '2026-07-14' });
});

test('whitespace-only inputs are treated as empty', () => {
  assert.deepEqual(normalizeDates('  ', '\n', '2026-07-14'),
    { datePublished: '2026-07-14', dateModified: '2026-07-14' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dates.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/dates.mjs
// Publish/modified dates for a content file, from git history, with a build-date fallback.
import { execFileSync } from 'node:child_process';

export function normalizeDates(createdRaw, modifiedRaw, fallback) {
  const created = String(createdRaw || '').trim() || fallback;
  const modified = String(modifiedRaw || '').trim() || created;
  return { datePublished: created, dateModified: modified };
}

function gitRun(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

export function gitDates(absPath, fallback) {
  let created = '';
  let modified = '';
  try {
    const adds = gitRun(['log', '--diff-filter=A', '--follow', '--format=%cs', '--', absPath])
      .trim().split('\n').filter(Boolean);
    created = adds.length ? adds[adds.length - 1] : '';
    modified = gitRun(['log', '-1', '--format=%cs', '--', absPath]).trim();
  } catch {
    // git unavailable or file untracked — fall through to fallback.
  }
  return normalizeDates(created, modified, fallback);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dates.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/dates.mjs tests/dates.test.mjs
git commit -m "feat: git-based publish/modified dates with fallback"
```

---

### Task 4: JSON-LD builders (`build/jsonld.mjs`)

**Files:**
- Create: `build/jsonld.mjs`
- Test: `tests/jsonld.test.mjs`

**Interfaces:**
- Consumes: `absUrl`, `subjectPath`, `categoryPath` from `build/site-url.mjs`.
- Produces (all return plain objects):
  - `websiteJsonLd({ description }) -> object` (`WebSite` + `SearchAction` + `publisher`)
  - `techArticleJsonLd(amne, { description, datePublished, dateModified }) -> object` (`amne` has `id, titel, sources`)
  - `breadcrumbJsonLd(items) -> object` — `items: [{name, url|null}]`; last item may omit url
  - `collectionPageJsonLd(kat, subs) -> object` — `kat:{id,titel}`, `subs:[{id,titel}]`

- [ ] **Step 1: Write the failing test**

```js
// tests/jsonld.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteJsonLd, techArticleJsonLd, breadcrumbJsonLd, collectionPageJsonLd } from '../build/jsonld.mjs';

test('website JSON-LD has a working SearchAction target', () => {
  const ld = websiteJsonLd({ description: 'D' });
  assert.equal(ld['@type'], 'WebSite');
  assert.equal(ld.inLanguage, 'sv-SE');
  assert.match(ld.potentialAction.target.urlTemplate, /\?q=\{search_term_string\}$/);
});

test('TechArticle JSON-LD carries dates, canonical @id and citations from sources', () => {
  const amne = { id: 'tak', titel: 'Tak', sources: [{ n: 1, titel: 'Boverket', url: 'https://b.se' }] };
  const ld = techArticleJsonLd(amne, { description: 'Om tak', datePublished: '2026-01-01', dateModified: '2026-02-02' });
  assert.equal(ld['@type'], 'TechArticle');
  assert.equal(ld.headline, 'Tak');
  assert.equal(ld.datePublished, '2026-01-01');
  assert.equal(ld.dateModified, '2026-02-02');
  assert.equal(ld.inLanguage, 'sv-SE');
  assert.match(ld.mainEntityOfPage['@id'], /\/amne\/tak\/$/);
  assert.deepEqual(ld.citation, [{ '@type': 'CreativeWork', name: 'Boverket', url: 'https://b.se' }]);
});

test('breadcrumb JSON-LD numbers items and omits item URL on the last entry', () => {
  const ld = breadcrumbJsonLd([
    { name: 'Hem', url: 'https://x/' },
    { name: 'Tak', url: null },
  ]);
  assert.equal(ld['@type'], 'BreadcrumbList');
  assert.equal(ld.itemListElement[0].position, 1);
  assert.equal(ld.itemListElement[0].item, 'https://x/');
  assert.equal(ld.itemListElement[1].position, 2);
  assert.ok(!('item' in ld.itemListElement[1]));
});

test('collection page JSON-LD lists its member subjects', () => {
  const ld = collectionPageJsonLd({ id: 'inomhus', titel: 'Inomhus' }, [{ id: 'golv', titel: 'Golv' }]);
  assert.equal(ld['@type'], 'CollectionPage');
  assert.match(ld.url, /\/kategori\/inomhus\/$/);
  assert.equal(ld.hasPart.length, 1);
  assert.match(ld.hasPart[0].url, /\/amne\/golv\/$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/jsonld.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/jsonld.mjs
// Schema.org JSON-LD builders. Return plain objects; serialized by the page template.
import { absUrl, subjectPath, categoryPath } from './site-url.mjs';

const PUBLISHER = { '@type': 'Organization', name: 'Husägarens handbok', url: absUrl('/') };

export function websiteJsonLd({ description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Husägarens handbok',
    url: absUrl('/'),
    inLanguage: 'sv-SE',
    description,
    publisher: PUBLISHER,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: absUrl('/') + '?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function techArticleJsonLd(amne, { description, datePublished, dateModified }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: amne.titel,
    description,
    inLanguage: 'sv-SE',
    datePublished,
    dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(subjectPath(amne.id)) },
    author: PUBLISHER,
    publisher: PUBLISHER,
    citation: (amne.sources || []).map((s) => ({ '@type': 'CreativeWork', name: s.titel, url: s.url })),
  };
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => {
      const el = { '@type': 'ListItem', position: i + 1, name: it.name };
      if (it.url) el.item = it.url;
      return el;
    }),
  };
}

export function collectionPageJsonLd(kat, subs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${kat.titel} — Husägarens handbok`,
    url: absUrl(categoryPath(kat.id)),
    inLanguage: 'sv-SE',
    hasPart: subs.map((a) => ({ '@type': 'TechArticle', headline: a.titel, url: absUrl(subjectPath(a.id)) })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/jsonld.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/jsonld.mjs tests/jsonld.test.mjs
git commit -m "feat: schema.org JSON-LD builders"
```

---

### Task 5: Page template (`build/page-template.mjs`)

Assembles the full HTML document: SEO `<head>`, header (with search box), pre-rendered sidebar, breadcrumbs, main, and end-of-body scripts (`search.js` + `app.js`; **not** `data.js`).

**Files:**
- Create: `build/page-template.mjs`
- Test: `tests/page-template.test.mjs`

**Interfaces:**
- Consumes: `href`, `absUrl`, `subjectPath`, `PATH_PREFIX` from `build/site-url.mjs`.
- Produces:
  - `escapeHtml(v) -> string`
  - `sidebarHtml({ kategorier, amnenByKategori, activeSubjectId }) -> string` — `amnenByKategori: Map<katId, [{id,titel}]>`; sets `aria-current="page"` + `active` class on the active link.
  - `breadcrumbHtml(items) -> string` — `items:[{name, href|null}]`; renders `<nav class="breadcrumbs">`; last item plain text.
  - `pageHtml(opts) -> string` — full `<!DOCTYPE html>…` document. `opts`: `{ title, description, canonicalPath, ogType, jsonLd (array), headExtra='', sidebarHtml, breadcrumbHtml='', mainHtml, tocHtml='' }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/page-template.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, sidebarHtml, breadcrumbHtml, pageHtml } from '../build/page-template.mjs';

const KAT = [{ id: 'inomhus', titel: 'Inomhus' }];
const BYKAT = new Map([['inomhus', [{ id: 'golv', titel: 'Golv' }]]]);

test('escapeHtml escapes the five entities', () => {
  assert.equal(escapeHtml(`<a>&"'`), '&lt;a&gt;&amp;&quot;&#39;');
});

test('sidebar marks the active subject with aria-current', () => {
  const html = sidebarHtml({ kategorier: KAT, amnenByKategori: BYKAT, activeSubjectId: 'golv' });
  assert.match(html, /href="\/husagarens-handbok\/amne\/golv\/"/);
  assert.match(html, /aria-current="page"/);
});

test('breadcrumb renders links then a plain last crumb', () => {
  const html = breadcrumbHtml([{ name: 'Hem', href: '/husagarens-handbok/' }, { name: 'Tak', href: null }]);
  assert.match(html, /<a href="\/husagarens-handbok\/">Hem<\/a>/);
  assert.match(html, /Tak<\/span>|Tak<\/li>/);
  assert.ok(!/href="[^"]*">Tak/.test(html));
});

test('pageHtml emits canonical, description, OG, JSON-LD and site scripts but not data.js', () => {
  const html = pageHtml({
    title: 'Tak — Husägarens handbok',
    description: 'Om tak',
    canonicalPath: '/amne/tak/',
    ogType: 'article',
    jsonLd: [{ '@type': 'TechArticle' }],
    sidebarHtml: '<nav></nav>',
    breadcrumbHtml: '<nav class="breadcrumbs"></nav>',
    mainHtml: '<article><h1>Tak</h1></article>',
    tocHtml: '<ul></ul>',
  });
  assert.match(html, /<link rel="canonical" href="https:\/\/rhorno\.github\.io\/husagarens-handbok\/amne\/tak\/">/);
  assert.match(html, /<meta name="description" content="Om tak">/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /<meta name="robots" content="index,follow">/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"TechArticle"/);
  assert.match(html, /src="\/husagarens-handbok\/search\.js"/);
  assert.match(html, /src="\/husagarens-handbok\/app\.js"/);
  assert.ok(!/data\.js/.test(html));
  assert.match(html, /window\.SITE=/);
  assert.match(html, /<html lang="sv">/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/page-template.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/page-template.mjs
// Renders full HTML documents for the static site.
import { href, absUrl, PATH_PREFIX } from './site-url.mjs';

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sidebarHtml({ kategorier, amnenByKategori, activeSubjectId }) {
  const cats = kategorier.map((kat) => {
    const subs = amnenByKategori.get(kat.id) || [];
    const items = subs.map((a) => {
      const active = a.id === activeSubjectId;
      return '<li><a href="' + href('/amne/' + a.id + '/') + '" data-subject-id="' + a.id + '"' +
        (active ? ' class="active" aria-current="page"' : '') + '>' + escapeHtml(a.titel) + '</a></li>';
    }).join('');
    return (
      '<div class="sidebar-category" data-kat="' + kat.id + '">' +
        '<button class="sidebar-cat-toggle" type="button" aria-expanded="true">' +
          '<span class="chevron" aria-hidden="true">▾</span>' +
          '<span>' + escapeHtml(kat.titel) + '</span>' +
        '</button>' +
        '<ul class="sidebar-sub-list">' + items + '</ul>' +
      '</div>'
    );
  }).join('');
  return cats;
}

export function breadcrumbHtml(items) {
  const parts = items.map((it, i) => {
    const last = i === items.length - 1;
    if (last || !it.href) return '<span aria-current="page">' + escapeHtml(it.name) + '</span>';
    return '<a href="' + it.href + '">' + escapeHtml(it.name) + '</a>';
  }).join('<span class="crumb-sep" aria-hidden="true">›</span>');
  return '<nav class="breadcrumbs" aria-label="Brödsmulor">' + parts + '</nav>';
}

const THEME_SCRIPT =
  '(function(){try{var s=localStorage.getItem("handbok-theme");' +
  'if(s==="light"||s==="dark")document.documentElement.setAttribute("data-theme",s);}catch(e){}})();';

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8F%A0%3C/text%3E%3C/svg%3E";

function headerHtml() {
  return (
    '<header class="site-header"><div class="header-inner">' +
      '<button id="sidebar-toggle" class="icon-btn sidebar-toggle" type="button" ' +
        'aria-label="Visa eller dölj kategorier" aria-expanded="false" aria-controls="sidebar">' +
        '<span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '</button>' +
      '<a href="' + href('/') + '" class="brand">Husägarens <span>handbok</span></a>' +
      '<div class="search-wrap" role="search">' +
        '<label for="search-input" class="visually-hidden">Sök i handboken</label>' +
        '<svg class="search-icon" aria-hidden="true" viewBox="0 0 20 20" width="16" height="16">' +
          '<circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.6"></circle>' +
          '<line x1="13.2" y1="13.2" x2="18" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>' +
        '</svg>' +
        '<input id="search-input" type="search" autocomplete="off" spellcheck="false" ' +
          'placeholder="Sök i handboken…  ( / )" role="combobox" aria-expanded="false" ' +
          'aria-controls="search-results" aria-autocomplete="list">' +
        '<ul id="search-results" class="search-results" role="listbox" aria-label="Sökresultat" hidden></ul>' +
      '</div>' +
      '<button id="theme-toggle" class="icon-btn" type="button" aria-label="Växla mellan ljust och mörkt tema">' +
        '<span id="theme-icon" aria-hidden="true">🌙</span>' +
      '</button>' +
    '</div></header>'
  );
}

export function pageHtml(opts) {
  const {
    title, description, canonicalPath, ogType, jsonLd = [],
    headExtra = '', sidebarHtml: sidebar, breadcrumbHtml: crumbs = '', mainHtml, tocHtml = '',
  } = opts;

  const canonical = absUrl(canonicalPath);
  const ogImage = absUrl('/assets/og-default.png');
  const siteConfig = 'window.SITE=' + JSON.stringify({ prefix: PATH_PREFIX, searchIndexUrl: href('/search-index.js') }) + ';';
  const ldScripts = jsonLd.map((o) => '<script type="application/ld+json">' + JSON.stringify(o) + '</script>').join('\n');

  const aside = tocHtml
    ? '<aside class="toc" id="toc" aria-label="På sidan">' + tocHtml + '</aside>'
    : '<aside class="toc" id="toc" aria-label="På sidan" hidden></aside>';

  return (
    '<!DOCTYPE html>\n<html lang="sv">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + escapeHtml(title) + '</title>\n' +
    '<meta name="description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="robots" content="index,follow">\n' +
    '<link rel="canonical" href="' + canonical + '">\n' +
    '<meta property="og:type" content="' + ogType + '">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:url" content="' + canonical + '">\n' +
    '<meta property="og:site_name" content="Husägarens handbok">\n' +
    '<meta property="og:locale" content="sv_SE">\n' +
    '<meta property="og:image" content="' + ogImage + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">\n' +
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">\n' +
    '<meta name="twitter:image" content="' + ogImage + '">\n' +
    '<link rel="icon" href="' + FAVICON + '">\n' +
    '<script>' + THEME_SCRIPT + '</script>\n' +
    '<script>' + siteConfig + '</script>\n' +
    (headExtra ? headExtra + '\n' : '') +
    '<link rel="stylesheet" href="' + href('/styles.css') + '">\n' +
    ldScripts + '\n' +
    '</head>\n<body>\n' +
    '<a class="skip-link" href="#content">Hoppa till innehållet</a>\n' +
    headerHtml() + '\n' +
    '<div id="backdrop" class="backdrop" hidden></div>\n' +
    '<div class="app-layout" id="app-layout">\n' +
    '<nav class="sidebar" id="sidebar" aria-label="Kategorier">' + sidebar + '</nav>\n' +
    '<main class="content" id="content" tabindex="-1">' + crumbs + mainHtml + '</main>\n' +
    aside + '\n' +
    '</div>\n' +
    '<script src="' + href('/search.js') + '"></script>\n' +
    '<script src="' + href('/app.js') + '"></script>\n' +
    '</body>\n</html>\n'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/page-template.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/page-template.mjs tests/page-template.test.mjs
git commit -m "feat: full-document page template with SEO head"
```

---

### Task 6: Page renderers (`build/render-pages.mjs`)

Builds the `<main>` content + JSON-LD + breadcrumbs + TOC for home, category, subject, and 404 pages, then calls `pageHtml`.

**Files:**
- Create: `build/render-pages.mjs`
- Test: `tests/render-pages.test.mjs`

**Interfaces:**
- Consumes: `pageHtml`, `sidebarHtml`, `breadcrumbHtml`, `escapeHtml` (page-template); `href`, `subjectPath`, `categoryPath` (site-url); JSON-LD builders (jsonld); `deriveDescription` (describe).
- Produces:
  - `renderHomePage(ctx) -> string`
  - `renderCategoryPage(kat, subs, ctx) -> string`
  - `renderSubjectPage(amne, dates, ctx) -> string` — `dates:{datePublished,dateModified}`
  - `render404(ctx) -> string`
  - where `ctx = { kategorier, amnenByKategori, katTitelById }`, `amnenByKategori: Map<katId,[amne]>`, `katTitelById: Map<katId,titel>`.

- [ ] **Step 1: Write the failing test**

```js
// tests/render-pages.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHomePage, renderCategoryPage, renderSubjectPage, render404 } from '../build/render-pages.mjs';

const KAT = [{ id: 'inomhus', titel: 'Inomhus' }];
const GOLV = {
  id: 'golv', titel: 'Golv', kategori: 'inomhus', nyckelord: ['parkett'],
  sections: [
    { title: 'Översikt', level: null, html: '<p>Golv är ytan man går på.</p>', text: 'Golv är ytan man går på.' },
    { title: 'Källor', level: null, html: '', text: '' },
  ],
  sources: [{ n: 1, titel: 'Boverket', url: 'https://b.se' }],
  relaterade: [],
};
const CTX = {
  kategorier: KAT,
  amnenByKategori: new Map([['inomhus', [GOLV]]]),
  katTitelById: new Map([['inomhus', 'Inomhus']]),
};

test('subject page bakes content, canonical, breadcrumbs and TechArticle+Breadcrumb JSON-LD', () => {
  const html = renderSubjectPage(GOLV, { datePublished: '2026-01-01', dateModified: '2026-02-02' }, CTX);
  assert.match(html, /<h1[^>]*>Golv<\/h1>/);
  assert.match(html, /Golv är ytan man går på\./);              // content present in source
  assert.match(html, /rel="canonical" href="[^"]*\/amne\/golv\/"/);
  assert.match(html, /"@type":"TechArticle"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /id="sec-0"/);                              // section anchors kept
  assert.match(html, /data-subject-id="golv"[^>]*aria-current="page"/); // sidebar active
  assert.match(html, /<meta name="description" content="Golv är ytan man går på\.">/);
});

test('category page lists members and emits CollectionPage JSON-LD', () => {
  const html = renderCategoryPage(KAT[0], [GOLV], CTX);
  assert.match(html, /<h1[^>]*>Inomhus<\/h1>/);
  assert.match(html, /href="[^"]*\/amne\/golv\/"/);
  assert.match(html, /"@type":"CollectionPage"/);
  assert.match(html, /rel="canonical" href="[^"]*\/kategori\/inomhus\/"/);
});

test('home page emits WebSite JSON-LD, hash-redirect script and links every subject', () => {
  const html = renderHomePage(CTX);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /href="[^"]*\/amne\/golv\/"/);
  assert.match(html, /location\.hash/);        // back-compat redirect present on home only
  assert.match(html, /rel="canonical" href="[^"]*\/husagarens-handbok\/"/);
});

test('404 page is noindex and links home', () => {
  const html = render404(CTX);
  assert.match(html, /404/);
  assert.match(html, /href="[^"]*\/husagarens-handbok\/"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/render-pages.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/render-pages.mjs
// Renders the <main> content + metadata for each page type and wraps it via pageHtml.
import { pageHtml, sidebarHtml, breadcrumbHtml, escapeHtml } from './page-template.mjs';
import { href, subjectPath, categoryPath } from './site-url.mjs';
import { deriveDescription } from './describe.mjs';
import { websiteJsonLd, techArticleJsonLd, breadcrumbJsonLd, collectionPageJsonLd } from './jsonld.mjs';

const SITE_NAME = 'Husägarens handbok';
const LEVEL_LABELS = { 'nybörjare': 'Nybörjare', 'mellan': 'Mellan', 'avancerad': 'Avancerad' };
const HOME_DESCRIPTION =
  'En samlad, sökbar och faktagranskad guide till att äga och sköta ett hus i Sverige — ' +
  'ekonomi, juridik, husets skal, installationer, inomhus, trädgård, teknik, säkerhet och drift.';

function levelBadge(level) {
  const label = LEVEL_LABELS[level];
  return label ? ' <span class="level-badge level-' + level + '">' + label + '</span>' : '';
}

function overviewText(amne) {
  const o = (amne.sections || []).find((s) => s.title === 'Översikt');
  return o ? o.text : '';
}

function sectionHtml(section, idx) {
  if (section.title === 'Källor') {
    // Rendered from sources so the list carries id="kalla-N" anchors for footnotes.
    return '';
  }
  return (
    '<section class="doc-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
      '<h2>' + escapeHtml(section.title) + levelBadge(section.level) + '</h2>' +
      '<div class="section-body">' + section.html + '</div>' +
    '</section>'
  );
}

function kallorSectionHtml(amne, idx) {
  const items = (amne.sources || []).map((s) =>
    '<li id="kalla-' + s.n + '"><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' +
    escapeHtml(s.titel) + '</a></li>').join('');
  return (
    '<section class="doc-section kallor-section" id="sec-' + idx + '" data-sec-idx="' + idx + '">' +
      '<h2>Källor</h2><ol class="kallor-list">' + items + '</ol>' +
    '</section>'
  );
}

function seAvenHtml(amne) {
  const related = amne.relaterade || [];
  if (!related.length) return '';
  const chips = related.map((r) =>
    '<li><a class="chip" href="' + href(subjectPath(r.id)) + '">' + escapeHtml(r.titel) + '</a></li>').join('');
  return '<section class="doc-section se-aven-section" id="se-aven"><h2>Se även</h2><ul class="chip-list">' + chips + '</ul></section>';
}

function tocHtml(amne) {
  const items = amne.sections.map((s, i) =>
    '<li><a href="#sec-' + i + '" data-sec-idx="' + i + '">' + escapeHtml(s.title) + '</a></li>').join('');
  return '<h2 class="toc-heading">På sidan</h2><ul class="toc-list">' + items + '</ul>';
}

export function renderSubjectPage(amne, dates, ctx) {
  const description = deriveDescription(overviewText(amne));
  const katTitel = ctx.katTitelById.get(amne.kategori) || '';
  const sections = amne.sections.map((s, i) => (s.title === 'Källor' ? kallorSectionHtml(amne, i) : sectionHtml(s, i))).join('');
  const mainHtml = '<article class="subject"><h1 tabindex="-1">' + escapeHtml(amne.titel) + '</h1>' + sections + seAvenHtml(amne) + '</article>';

  const crumbs = [
    { name: 'Hem', href: href('/') },
    { name: katTitel, href: href(categoryPath(amne.kategori)) },
    { name: amne.titel, href: null },
  ];

  return pageHtml({
    title: amne.titel + ' — ' + SITE_NAME,
    description,
    canonicalPath: subjectPath(amne.id),
    ogType: 'article',
    jsonLd: [
      techArticleJsonLd(amne, { description, datePublished: dates.datePublished, dateModified: dates.dateModified }),
      breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: c.href ? c.href.replace(/^/, '') : null }))),
    ],
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: amne.id }),
    breadcrumbHtml: breadcrumbHtml(crumbs),
    mainHtml,
    tocHtml: tocHtml(amne),
  });
}

export function renderCategoryPage(kat, subs, ctx) {
  const description = deriveDescription('Alla ämnen i kategorin ' + kat.titel + ': ' + subs.map((a) => a.titel).join(', ') + '.');
  const items = subs.map((a) =>
    '<li><a href="' + href(subjectPath(a.id)) + '">' + escapeHtml(a.titel) + '</a></li>').join('');
  const mainHtml =
    '<div class="category-view"><h1 tabindex="-1">' + escapeHtml(kat.titel) + '</h1>' +
    '<ul class="category-subject-list">' + items + '</ul></div>';

  const crumbs = [{ name: 'Hem', href: href('/') }, { name: kat.titel, href: null }];

  return pageHtml({
    title: kat.titel + ' — ' + SITE_NAME,
    description,
    canonicalPath: categoryPath(kat.id),
    ogType: 'website',
    jsonLd: [collectionPageJsonLd(kat, subs), breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, url: c.href || null })))],
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: breadcrumbHtml(crumbs),
    mainHtml,
    tocHtml: '',
  });
}

const HASH_REDIRECT =
  '<script>(function(){var m=(location.hash||"").match(/^#\\/amne\\/([^\\/]+)(?:\\/(\\d+))?$/);' +
  'if(m){var u=window.SITE.prefix+"/amne/"+m[1]+"/"+(m[2]!==undefined?"#sec-"+m[2]:"");location.replace(u);}})();</script>';

export function renderHomePage(ctx) {
  const cards = ctx.kategorier.map((kat) => {
    const subs = ctx.amnenByKategori.get(kat.id) || [];
    const items = subs.map((a) => '<li><a href="' + href(subjectPath(a.id)) + '">' + escapeHtml(a.titel) + '</a></li>').join('');
    return '<section class="category-card"><h2><a href="' + href(categoryPath(kat.id)) + '">' + escapeHtml(kat.titel) + '</a></h2><ul>' + items + '</ul></section>';
  }).join('');

  const total = [...ctx.amnenByKategori.values()].reduce((n, a) => n + a.length, 0);
  const mainHtml =
    '<div class="start-view"><h1 tabindex="-1">' + SITE_NAME + '</h1>' +
    '<p class="lead">' + escapeHtml(HOME_DESCRIPTION) + '</p>' +
    '<p class="meta-note">' + total + ' ämnen fördelade på ' + ctx.kategorier.length + ' kategorier. ' +
    'Använd sökfältet ovan eller bläddra i kategorierna till vänster.</p>' +
    '<div class="category-cards">' + cards + '</div></div>';

  return pageHtml({
    title: SITE_NAME + ' — komplett guide för husägare i Sverige',
    description: HOME_DESCRIPTION,
    canonicalPath: '/',
    ogType: 'website',
    jsonLd: [websiteJsonLd({ description: HOME_DESCRIPTION })],
    headExtra: HASH_REDIRECT,
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: '',
    mainHtml,
    tocHtml: '',
  });
}

export function render404(ctx) {
  const mainHtml =
    '<div class="start-view"><h1 tabindex="-1">404 — sidan hittades inte</h1>' +
    '<p class="lead">Sidan du sökte finns inte. Gå till <a href="' + href('/') + '">startsidan</a> eller använd sökfältet ovan.</p></div>';
  return pageHtml({
    title: '404 — ' + SITE_NAME,
    description: 'Sidan kunde inte hittas.',
    canonicalPath: '/404.html',
    ogType: 'website',
    jsonLd: [],
    headExtra: '<meta name="robots" content="noindex,follow">',
    sidebarHtml: sidebarHtml({ kategorier: ctx.kategorier, amnenByKategori: ctx.amnenByKategori, activeSubjectId: null }),
    breadcrumbHtml: '',
    mainHtml,
    tocHtml: '',
  });
}
```

> Note on breadcrumb JSON-LD URLs: `href()` returns a root-relative path; `breadcrumbJsonLd` wants absolute URLs. In `renderSubjectPage`/`renderCategoryPage` above, pass **absolute** URLs to `breadcrumbJsonLd`. Adjust the `crumbs.map(...)` to use `absUrl(...)`: import `absUrl` and build breadcrumb JSON-LD items as `{ name, url: c.name === last ? null : absUrl(path) }`. See Step 3b.

- [ ] **Step 3b: Fix breadcrumb JSON-LD to use absolute URLs**

Import `absUrl` and pass absolute URLs to `breadcrumbJsonLd` (the visible `breadcrumbHtml` keeps using `href`). Replace the two `breadcrumbJsonLd(crumbs.map(...))` calls:

```js
// add to imports
import { href, absUrl, subjectPath, categoryPath } from './site-url.mjs';

// subject page:
breadcrumbJsonLd([
  { name: 'Hem', url: absUrl('/') },
  { name: katTitel, url: absUrl(categoryPath(amne.kategori)) },
  { name: amne.titel, url: null },
]),

// category page:
breadcrumbJsonLd([
  { name: 'Hem', url: absUrl('/') },
  { name: kat.titel, url: null },
]),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/render-pages.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/render-pages.mjs tests/render-pages.test.mjs
git commit -m "feat: home/category/subject/404 page renderers"
```

---

### Task 7: Slim search index (`build/search-index.mjs`)

**Files:**
- Create: `build/search-index.mjs`
- Test: `tests/search-index.test.mjs`

**Interfaces:**
- Produces:
  - `buildSearchIndex(handbok) -> [{id, titel, nyckelord, sections:[{title, level, text}]}]` (drops `html`, `sources`, `relaterade`, `kategori`).
  - `renderSearchIndexJs(handbok) -> string` — `globalThis.HANDBOK_SEARCH = <json>;\n`.

- [ ] **Step 1: Write the failing test**

```js
// tests/search-index.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, renderSearchIndexJs } from '../build/search-index.mjs';

const HANDBOK = {
  amnen: [{
    id: 'tak', titel: 'Tak', kategori: 'husets-skal', nyckelord: ['takpannor'],
    sections: [{ title: 'Översikt', level: null, html: '<p>x</p>', text: 'x' }],
    sources: [{ n: 1, titel: 'B', url: 'https://b.se' }], relaterade: [],
  }],
};

test('search index is text-only (no rendered html)', () => {
  const idx = buildSearchIndex(HANDBOK);
  assert.equal(idx.length, 1);
  assert.deepEqual(Object.keys(idx[0]).sort(), ['id', 'nyckelord', 'sections', 'titel']);
  assert.deepEqual(Object.keys(idx[0].sections[0]).sort(), ['level', 'text', 'title']);
  assert.ok(!('html' in idx[0].sections[0]));
});

test('rendered JS assigns the HANDBOK_SEARCH global', () => {
  const js = renderSearchIndexJs(HANDBOK);
  assert.match(js, /^globalThis\.HANDBOK_SEARCH = \[/);
  assert.match(js, /"titel":"Tak"/);
  assert.ok(!/"html"/.test(js));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/search-index.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/search-index.mjs
// Slim, text-only search payload consumed by SearchLib.buildIndex on the client.

export function buildSearchIndex(handbok) {
  return handbok.amnen.map((a) => ({
    id: a.id,
    titel: a.titel,
    nyckelord: a.nyckelord,
    sections: a.sections.map((s) => ({ title: s.title, level: s.level, text: s.text })),
  }));
}

export function renderSearchIndexJs(handbok) {
  return `globalThis.HANDBOK_SEARCH = ${JSON.stringify(buildSearchIndex(handbok))};\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/search-index.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add build/search-index.mjs tests/search-index.test.mjs
git commit -m "feat: slim text-only search index builder"
```

---

### Task 8: Discovery files (`build/discovery.mjs`)

**Files:**
- Create: `build/discovery.mjs`
- Test: `tests/discovery.test.mjs`

**Interfaces:**
- Produces:
  - `renderSitemap(urls) -> string` — `urls:[{loc, lastmod}]`.
  - `renderRobots(sitemapUrl) -> string`.
  - `renderLlmsTxt({ title, summary, homeUrl, categories }) -> string` — `categories:[{titel, subjects:[{titel, url, description}]}]`.
  - `renderLlmsFullTxt({ title, subjects }) -> string` — `subjects:[{titel, url, text}]`.

- [ ] **Step 1: Write the failing test**

```js
// tests/discovery.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSitemap, renderRobots, renderLlmsTxt, renderLlmsFullTxt } from '../build/discovery.mjs';

test('sitemap lists every url with a lastmod', () => {
  const xml = renderSitemap([{ loc: 'https://x/', lastmod: '2026-07-14' }, { loc: 'https://x/amne/tak/', lastmod: '2026-07-10' }]);
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<loc>https:\/\/x\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/x\/amne\/tak\/<\/loc>/);
  assert.equal((xml.match(/<url>/g) || []).length, 2);
});

test('robots allows all and points at the sitemap', () => {
  const txt = renderRobots('https://x/sitemap.xml');
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, /Allow: \//);
  assert.match(txt, /Sitemap: https:\/\/x\/sitemap\.xml/);
});

test('llms.txt groups subjects under categories as markdown links', () => {
  const txt = renderLlmsTxt({
    title: 'Husägarens handbok', summary: 'Guide', homeUrl: 'https://x/',
    categories: [{ titel: 'Inomhus', subjects: [{ titel: 'Golv', url: 'https://x/amne/golv/', description: 'Om golv' }] }],
  });
  assert.match(txt, /^# Husägarens handbok/);
  assert.match(txt, /## Inomhus/);
  assert.match(txt, /- \[Golv\]\(https:\/\/x\/amne\/golv\/\): Om golv/);
});

test('llms-full.txt concatenates full subject text', () => {
  const txt = renderLlmsFullTxt({ title: 'H', subjects: [{ titel: 'Golv', url: 'https://x/amne/golv/', text: 'Golv är ...' }] });
  assert.match(txt, /# Golv/);
  assert.match(txt, /Golv är \.\.\./);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/discovery.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// build/discovery.mjs
// Sitemap, robots, and llms.txt/llms-full.txt generators.

export function renderSitemap(urls) {
  const items = urls.map((u) =>
    '  <url>\n    <loc>' + u.loc + '</loc>\n    <lastmod>' + u.lastmod + '</lastmod>\n  </url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + items + '\n</urlset>\n';
}

export function renderRobots(sitemapUrl) {
  return 'User-agent: *\nAllow: /\n\nSitemap: ' + sitemapUrl + '\n';
}

export function renderLlmsTxt({ title, summary, homeUrl, categories }) {
  let out = '# ' + title + '\n\n> ' + summary + '\n\nWebbplats: ' + homeUrl + '\n';
  for (const cat of categories) {
    out += '\n## ' + cat.titel + '\n\n';
    for (const s of cat.subjects) out += '- [' + s.titel + '](' + s.url + '): ' + s.description + '\n';
  }
  return out;
}

export function renderLlmsFullTxt({ title, subjects }) {
  let out = '# ' + title + '\n';
  for (const s of subjects) out += '\n\n# ' + s.titel + '\n' + s.url + '\n\n' + s.text + '\n';
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/discovery.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add build/discovery.mjs tests/discovery.test.mjs
git commit -m "feat: sitemap, robots, and llms.txt generators"
```

---

### Task 9: Wire up the build (`build.mjs`)

Rewrite `main()` to generate the whole static site. `buildData` (and its tests) stay untouched.

**Files:**
- Modify: `build.mjs:98-130` (the `main()` function and the final write)
- Test: `tests/build-output.test.mjs` (new integration test that runs the generator into a temp dir)

**Interfaces:**
- Consumes: everything from Tasks 1–8, plus existing `parseSubjectFile`, `validateSubject`, `renderMarkdown`, `stripToText`, `buildData`.
- Produces: a new exported `generateSite(handbok, { outDir, contentDir, buildDate }) -> { fileCount }` that writes all files, so it can be tested without touching the real `site/`.

- [ ] **Step 1: Write the failing test**

```js
// tests/build-output.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSite } from '../build.mjs';

const HANDBOK = {
  kategorier: [{ id: 'inomhus', titel: 'Inomhus' }],
  amnen: [{
    id: 'golv', titel: 'Golv', kategori: 'inomhus', nyckelord: ['parkett'],
    sections: [
      { title: 'Översikt', level: null, html: '<p>Golv.</p>', text: 'Golv.' },
      { title: 'Källor', level: null, html: '', text: '' },
    ],
    sources: [{ n: 1, titel: 'B', url: 'https://b.se' }], relaterade: [],
  }],
};

test('generateSite writes home, category, subject, index and discovery files', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'hb-'));
  const res = generateSite(HANDBOK, { outDir, contentDir: '/nonexistent', buildDate: '2026-07-14' });
  assert.ok(existsSync(join(outDir, 'index.html')));
  assert.ok(existsSync(join(outDir, 'amne', 'golv', 'index.html')));
  assert.ok(existsSync(join(outDir, 'kategori', 'inomhus', 'index.html')));
  assert.ok(existsSync(join(outDir, 'search-index.js')));
  assert.ok(existsSync(join(outDir, 'sitemap.xml')));
  assert.ok(existsSync(join(outDir, 'robots.txt')));
  assert.ok(existsSync(join(outDir, 'llms.txt')));
  assert.ok(existsSync(join(outDir, 'llms-full.txt')));
  assert.ok(existsSync(join(outDir, '404.html')));
  assert.ok(!existsSync(join(outDir, 'data.js')));

  const subject = readFileSync(join(outDir, 'amne', 'golv', 'index.html'), 'utf8');
  assert.match(subject, /Golv\./);
  assert.match(subject, /"@type":"TechArticle"/);

  const sitemap = readFileSync(join(outDir, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /\/amne\/golv\/</);
  assert.match(sitemap, /\/kategori\/inomhus\/</);
  assert.ok(res.fileCount >= 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-output.test.mjs`
Expected: FAIL — `generateSite` is not exported.

- [ ] **Step 3: Implement — add `generateSite` and rewrite `main()`**

Add these imports at the top of `build.mjs` (below the existing imports):

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { BASE_URL, absUrl, subjectPath, categoryPath } from './build/site-url.mjs';
import { renderHomePage, renderCategoryPage, renderSubjectPage, render404 } from './build/render-pages.mjs';
import { renderSearchIndexJs } from './build/search-index.mjs';
import { renderSitemap, renderRobots, renderLlmsTxt, renderLlmsFullTxt } from './build/discovery.mjs';
import { deriveDescription } from './build/describe.mjs';
import { gitDates } from './build/dates.mjs';
```

(Note: `readFileSync`, `writeFileSync`, `join`, `dirname`, `fileURLToPath` are already imported at the top — keep them; add only what's missing: `mkdirSync`, and `writeFileSync` is already present.)

Add the generator (place before `main()`):

```js
function buildContext(handbok) {
  const amnenByKategori = new Map(handbok.kategorier.map((k) => [k.id, []]));
  for (const a of handbok.amnen) {
    if (!amnenByKategori.has(a.kategori)) amnenByKategori.set(a.kategori, []);
    amnenByKategori.get(a.kategori).push(a);
  }
  const katTitelById = new Map(handbok.kategorier.map((k) => [k.id, k.titel]));
  return { kategorier: handbok.kategorier, amnenByKategori, katTitelById };
}

function writeFile(outDir, relPath, contents) {
  const full = join(outDir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

export function generateSite(handbok, { outDir, contentDir, buildDate }) {
  const ctx = buildContext(handbok);
  let fileCount = 0;
  const write = (rel, c) => { writeFile(outDir, rel, c); fileCount++; };

  // Home
  write('index.html', renderHomePage(ctx));

  // Category pages
  for (const kat of handbok.kategorier) {
    const subs = ctx.amnenByKategori.get(kat.id) || [];
    write(join('kategori', kat.id, 'index.html'), renderCategoryPage(kat, subs, ctx));
  }

  // Subject pages
  const dateByAmne = new Map();
  for (const a of handbok.amnen) {
    const dates = gitDates(join(contentDir, a.kategori, a.id + '.md'), buildDate);
    dateByAmne.set(a.id, dates);
    write(join('amne', a.id, 'index.html'), renderSubjectPage(a, dates, ctx));
  }

  // Search index
  write('search-index.js', renderSearchIndexJs(handbok));

  // 404
  write('404.html', render404(ctx));

  // Sitemap
  const urls = [{ loc: absUrl('/'), lastmod: buildDate }];
  for (const kat of handbok.kategorier) urls.push({ loc: absUrl(categoryPath(kat.id)), lastmod: buildDate });
  for (const a of handbok.amnen) urls.push({ loc: absUrl(subjectPath(a.id)), lastmod: dateByAmne.get(a.id).dateModified });
  write('sitemap.xml', renderSitemap(urls));

  // robots.txt
  write('robots.txt', renderRobots(absUrl('/sitemap.xml')));

  // llms.txt
  write('llms.txt', renderLlmsTxt({
    title: 'Husägarens handbok',
    summary: 'Komplett, faktagranskad och sökbar guide för husägare i Sverige.',
    homeUrl: absUrl('/'),
    categories: handbok.kategorier.map((kat) => ({
      titel: kat.titel,
      subjects: (ctx.amnenByKategori.get(kat.id) || []).map((a) => ({
        titel: a.titel,
        url: absUrl(subjectPath(a.id)),
        description: deriveDescription((a.sections.find((s) => s.title === 'Översikt') || {}).text || ''),
      })),
    })),
  }));

  // llms-full.txt
  write('llms-full.txt', renderLlmsFullTxt({
    title: 'Husägarens handbok — fullständig text',
    subjects: handbok.amnen.map((a) => ({
      titel: a.titel,
      url: absUrl(subjectPath(a.id)),
      text: a.sections.map((s) => s.title + '\n' + s.text).join('\n\n'),
    })),
  }));

  return { fileCount };
}
```

Replace the body of `main()` (the part after `data` is built) — remove the `data.js` write and call `generateSite`:

```js
function main() {
  const manifest = JSON.parse(readFileSync(join(root, 'subjects.json'), 'utf8'));

  const files = new Map();
  for (const entry of manifest.amnen) {
    const filePath = join(root, 'content', entry.kategori, `${entry.id}.md`);
    try {
      files.set(entry.id, readFileSync(filePath, 'utf8'));
    } catch {
      // Leave missing — buildData will report "FILEN SAKNAS".
    }
  }

  let crossrefs;
  try {
    crossrefs = JSON.parse(readFileSync(join(root, 'crossrefs.json'), 'utf8'));
  } catch {
    crossrefs = { relationer: {} };
  }

  let data;
  try {
    data = buildData(manifest, files, crossrefs);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }

  const buildDate = new Date().toISOString().slice(0, 10);
  const { fileCount } = generateSite(data, {
    outDir: join(root, 'site'),
    contentDir: join(root, 'content'),
    buildDate,
  });
  console.log(`OK: ${data.amnen.length} ämnen, ${fileCount} filer genererade (${BASE_URL})`);
}
```

- [ ] **Step 4: Run the new test + full suite**

Run: `node --test tests/build-output.test.mjs`
Expected: PASS.
Run: `node --test tests/*.test.mjs`
Expected: PASS (all existing + new).

- [ ] **Step 5: Run the real build and sanity-check output**

Run: `node build.mjs`
Expected: `OK: 59 ämnen, 73 filer genererade (...)` and `site/amne/`, `site/kategori/`, `site/sitemap.xml`, etc. exist; `site/data.js` no longer regenerated.

Verify a real page has content in source:
Run: `grep -c 'application/ld+json' site/amne/tak/index.html`
Expected: `1` (at least).

- [ ] **Step 6: Commit**

```bash
git add build.mjs tests/build-output.test.mjs
git commit -m "feat: generate full static site (pages, search index, sitemap, robots, llms)"
```

---

### Task 10: Refactor the client (`site/app.js`)

Strip routing + content rendering (now pre-rendered). Keep theme, sidebar interactions, scroll-spy, footnote jumps, `/` shortcut. Add lazy search-index loading, real-URL result navigation, and `?q=` deep-link handling.

**Files:**
- Modify: `site/app.js` (full rewrite of the file)
- Verify: browser via playwright-cli (Task 13)

**Interfaces:**
- Consumes: `window.SITE = { prefix, searchIndexUrl }` (injected by page template), `globalThis.HANDBOK_SEARCH` (lazy), `SearchLib` (from `search.js`), pre-rendered DOM (`#sidebar`, `#content`, `#toc`, `#search-input`, …).

- [ ] **Step 1: Replace `site/app.js` with the refactored client**

```js
// Classic script (no import/export) — client behaviour for the pre-rendered site.
// Content, sidebar and TOC are already in the HTML; this handles theme, sidebar
// interaction, scroll-spy, footnote jumps and (lazily-loaded) search.
(function () {
  'use strict';

  var LEVEL_LABELS = { 'nybörjare': 'Nybörjare', 'mellan': 'Mellan', 'avancerad': 'Avancerad' };
  var THEME_KEY = 'handbok-theme';
  var HEADER_H_FALLBACK = 64;

  var sidebarEl = document.getElementById('sidebar');
  var contentEl = document.getElementById('content');
  var tocEl = document.getElementById('toc');
  var searchInput = document.getElementById('search-input');
  var searchResultsEl = document.getElementById('search-results');
  var themeToggleBtn = document.getElementById('theme-toggle');
  var themeIconEl = document.getElementById('theme-icon');
  var sidebarToggleBtn = document.getElementById('sidebar-toggle');
  var backdropEl = document.getElementById('backdrop');

  var SITE = window.SITE || { prefix: '', searchIndexUrl: 'search-index.js' };

  // --- helpers ---
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isTypingTarget(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
  }
  function headerHeightPx() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
    var n = parseInt(raw, 10);
    return isNaN(n) ? HEADER_H_FALLBACK : n;
  }
  function flashHighlight(el) {
    if (!el) return;
    el.classList.remove('flash-highlight');
    void el.offsetWidth;
    el.classList.add('flash-highlight');
    clearTimeout(el.__flashTimer);
    el.__flashTimer = setTimeout(function () { el.classList.remove('flash-highlight'); }, 1800);
  }
  function levelBadgeHtml(level) {
    var label = LEVEL_LABELS[level];
    return label ? ' <span class="level-badge level-' + level + '">' + label + '</span>' : '';
  }

  // --- scroll spy (operates on pre-rendered sections + toc links) ---
  var spyObserver = null;
  function setupScrollSpy() {
    var sectionEls = Array.prototype.slice.call(contentEl.querySelectorAll('[data-sec-idx]'));
    var tocLinks = Array.prototype.slice.call(tocEl.querySelectorAll('[data-sec-idx]'));
    if (!sectionEls.length || !tocLinks.length) return;
    var linkByIdx = new Map(tocLinks.map(function (a) { return [a.dataset.secIdx, a]; }));
    var visible = new Set();
    var topOffset = headerHeightPx() + 24;
    spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var idx = e.target.dataset.secIdx;
        if (e.isIntersecting) visible.add(idx); else visible.delete(idx);
      });
      tocLinks.forEach(function (a) { a.classList.remove('active'); });
      if (visible.size) {
        var activeIdx = Array.from(visible).sort(function (a, b) { return Number(a) - Number(b); })[0];
        var link = linkByIdx.get(activeIdx);
        if (link) link.classList.add('active');
      }
    }, { root: null, rootMargin: '-' + topOffset + 'px 0px -60% 0px', threshold: 0 });
    sectionEls.forEach(function (el) { spyObserver.observe(el); });
  }

  // --- sidebar interactions (links are pre-rendered) ---
  sidebarEl.addEventListener('click', function (e) {
    var toggle = e.target.closest('.sidebar-cat-toggle');
    if (toggle) {
      var cat = toggle.closest('.sidebar-category');
      var collapsed = cat.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      return;
    }
    if (e.target.closest('a[data-subject-id]')) closeMobileSidebar();
  });

  function openMobileSidebar() {
    document.body.classList.add('sidebar-open');
    sidebarToggleBtn.setAttribute('aria-expanded', 'true');
    backdropEl.hidden = false;
  }
  function closeMobileSidebar() {
    document.body.classList.remove('sidebar-open');
    sidebarToggleBtn.setAttribute('aria-expanded', 'false');
    backdropEl.hidden = true;
  }
  sidebarToggleBtn.addEventListener('click', function () {
    if (document.body.classList.contains('sidebar-open')) closeMobileSidebar(); else openMobileSidebar();
  });
  backdropEl.addEventListener('click', closeMobileSidebar);

  // --- footnote / källa jumps (no hash rewrite) ---
  contentEl.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#kalla-"]');
    if (!a) return;
    e.preventDefault();
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); flashHighlight(target); }
  });

  // --- theme ---
  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || getSystemTheme(); }
  function updateThemeIcon(theme) { themeIconEl.textContent = theme === 'dark' ? '☀️' : '🌙'; }
  themeToggleBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    updateThemeIcon(next);
  });
  updateThemeIcon(currentTheme());

  // --- lazy search index ---
  var searchIndex = null, searchLoading = false, searchLoadCbs = [];
  function ensureSearchIndex(cb) {
    if (searchIndex) { cb(); return; }
    searchLoadCbs.push(cb);
    if (searchLoading) return;
    searchLoading = true;
    var s = document.createElement('script');
    s.src = SITE.searchIndexUrl;
    s.onload = function () {
      searchIndex = SearchLib.buildIndex(globalThis.HANDBOK_SEARCH || []);
      var cbs = searchLoadCbs; searchLoadCbs = [];
      cbs.forEach(function (f) { f(); });
    };
    s.onerror = function () { searchLoading = false; };
    document.head.appendChild(s);
  }

  // --- search UI ---
  var searchResults = [], searchActiveIdx = -1;
  function renderSearchResults() {
    if (!searchResults.length) {
      searchResultsEl.innerHTML = '<li class="search-empty" role="presentation">Inga träffar</li>';
      searchResultsEl.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      return;
    }
    searchResultsEl.innerHTML = searchResults.map(function (r, i) {
      var badge = levelBadgeHtml(r.level);
      var sn = r.snippet || { before: '', match: '', after: '' };
      var has = Boolean(sn.before || sn.match || sn.after);
      var snHtml = has
        ? escapeHtml(sn.before) + '<mark>' + escapeHtml(sn.match) + '</mark>' + escapeHtml(sn.after)
        : '<span class="search-result-snippet-fallback">Träff via nyckelord</span>';
      var active = i === searchActiveIdx ? ' is-active' : '';
      return '<li role="option" id="search-opt-' + i + '" class="search-result' + active + '" ' +
        'aria-selected="' + (i === searchActiveIdx) + '" data-idx="' + i + '">' +
        '<div class="search-result-head">' +
          '<span class="search-result-title">' + escapeHtml(r.subjectTitle) + '</span>' +
          '<span class="search-result-section">' + escapeHtml(r.sectionTitle) + '</span>' + badge +
        '</div><p class="search-result-snippet">' + snHtml + '</p></li>';
    }).join('');
    searchResultsEl.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    if (searchActiveIdx >= 0) searchInput.setAttribute('aria-activedescendant', 'search-opt-' + searchActiveIdx);
    else searchInput.removeAttribute('aria-activedescendant');
  }
  function closeSearchResults() {
    searchResultsEl.hidden = true; searchResultsEl.innerHTML = '';
    searchResults = []; searchActiveIdx = -1;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
  }
  function runSearch(q) {
    ensureSearchIndex(function () {
      searchResults = SearchLib.search(searchIndex, q, 20);
      searchActiveIdx = -1;
      renderSearchResults();
    });
  }
  function openSearchResult(i) {
    var r = searchResults[i];
    if (!r) return;
    window.location.href = SITE.prefix + '/amne/' + r.subjectId + '/#sec-' + r.sectionIdx;
  }
  function scrollActiveIntoView() {
    var el = searchResultsEl.querySelector('.search-result.is-active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  searchInput.addEventListener('focus', function () { ensureSearchIndex(function () {}); });
  searchInput.addEventListener('input', function () {
    var q = searchInput.value;
    if (!q.trim()) { closeSearchResults(); return; }
    runSearch(q);
  });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.min(searchActiveIdx + 1, searchResults.length - 1);
      renderSearchResults(); scrollActiveIntoView();
    } else if (e.key === 'ArrowUp') {
      if (!searchResults.length) return;
      e.preventDefault();
      searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
      renderSearchResults(); scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      if (searchResults.length) { e.preventDefault(); openSearchResult(searchActiveIdx >= 0 ? searchActiveIdx : 0); }
    } else if (e.key === 'Escape') {
      if (searchInput.value || searchResults.length) { e.preventDefault(); searchInput.value = ''; closeSearchResults(); }
    }
  });
  searchResultsEl.addEventListener('click', function (e) {
    var li = e.target.closest('.search-result');
    if (li) openSearchResult(Number(li.dataset.idx));
  });
  searchInput.addEventListener('blur', function () { setTimeout(closeSearchResults, 150); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !isTypingTarget(document.activeElement)) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  });

  // --- ?q= deep link (makes the WebSite SearchAction real) ---
  function handleQueryParam() {
    var m = window.location.search.match(/[?&]q=([^&]*)/);
    if (!m) return;
    var q = decodeURIComponent(m[1].replace(/\+/g, ' '));
    if (!q.trim()) return;
    searchInput.value = q;
    searchInput.focus();
    runSearch(q);
  }

  // --- init ---
  setupScrollSpy();
  handleQueryParam();
})();
```

- [ ] **Step 2: Build and smoke-check that content still renders**

Run: `node build.mjs`
Then verify the generated subject page references the refactored client and no `data.js`:
Run: `grep -o 'src="[^"]*app.js"' site/amne/tak/index.html && grep -c 'data.js' site/index.html`
Expected: `src=".../app.js"` printed and `0` for data.js.

(Full interactive verification — search lazy-load, theme, nav — happens in Task 13.)

- [ ] **Step 3: Commit**

```bash
git add site/app.js
git commit -m "refactor: client for pre-rendered multi-page site with lazy search"
```

---

### Task 11: Styles, gitignore, and remove `data.js`

**Files:**
- Modify: `site/styles.css` (append breadcrumb + category-view styles)
- Modify: `.gitignore` (ignore generated artifacts)
- Delete: `site/data.js` (untrack)

- [ ] **Step 1: Append styles**

Add to the end of `site/styles.css`:

```css
/* Breadcrumbs */
.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--muted, #667);
  margin: 0 0 1rem;
}
.breadcrumbs a { color: inherit; text-decoration: none; }
.breadcrumbs a:hover { text-decoration: underline; }
.breadcrumbs .crumb-sep { opacity: 0.5; }
.breadcrumbs [aria-current="page"] { color: var(--text, inherit); font-weight: 600; }

/* Category landing page */
.category-view .category-subject-list {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.5rem;
}
.category-view .category-subject-list a { text-decoration: none; }
.category-view .category-subject-list a:hover { text-decoration: underline; }
```

> If `--muted`/`--text` variables don't exist under those names in `:root`, use the actual variable names already defined at the top of `styles.css` (check with `grep -n '\-\-' site/styles.css | head`). Match existing tokens; don't introduce new ones.

- [ ] **Step 2: Ignore generated artifacts**

Add to `.gitignore`:

```
# Generated static-site output (rebuilt by `node build.mjs` / CI on deploy)
site/index.html
site/404.html
site/amne/
site/kategori/
site/search-index.js
site/sitemap.xml
site/robots.txt
site/llms.txt
site/llms-full.txt
site/data.js
```

- [ ] **Step 3: Untrack the obsolete files**

Run:
```bash
git rm --cached site/data.js site/index.html
```
Expected: both removed from the index (they remain on disk / regenerated by build).

- [ ] **Step 4: Rebuild and confirm clean status for generated files**

Run: `node build.mjs && git status --short`
Expected: generated files (`site/amne/…`, `site/index.html`, `site/sitemap.xml`, …) do NOT appear in `git status` (ignored). Only `site/styles.css` and `.gitignore` show as modified.

- [ ] **Step 5: Commit**

```bash
git add site/styles.css .gitignore
git commit -m "chore: breadcrumb/category styles; ignore generated site output; drop data.js"
```

---

### Task 12: Social card asset (`site/assets/og-default.png`)

A single committed 1200×630 card referenced by every page's `og:image`/`twitter:image`.

**Files:**
- Create: `site/assets/og-default.png` (committed binary)
- Temp: an HTML card in the scratchpad (not committed)

- [ ] **Step 1: Write the card HTML** to the scratchpad:

```html
<!doctype html><html lang="sv"><head><meta charset="utf-8"><style>
  html,body{margin:0}
  .card{width:1200px;height:630px;box-sizing:border-box;padding:90px;
    background:linear-gradient(135deg,#1f6f54,#0d3b2e);color:#fff;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;
    flex-direction:column;justify-content:center}
  .kicker{font-size:34px;opacity:.85;letter-spacing:.04em}
  h1{font-size:104px;margin:.1em 0;line-height:1.02}
  .sub{font-size:38px;opacity:.9;max-width:900px}
  .emoji{font-size:96px;margin-bottom:20px}
</style></head><body>
  <div class="card">
    <div class="emoji">🏠</div>
    <div class="kicker">HUSÄGARENS HANDBOK</div>
    <h1>Guide för husägare i Sverige</h1>
    <p class="sub">Faktagranskad, sökbar dokumentation — ekonomi, el, tak, trädgård, teknik och drift.</p>
  </div>
</body></html>
```

- [ ] **Step 2: Render it to PNG at 1200×630 using `playwright-cli`**

Invoke the `playwright-cli` skill to open the local HTML file with a viewport of exactly 1200×630 and screenshot the `.card` element (or full page) to `site/assets/og-default.png`. Verify dimensions:
Run: `file site/assets/og-default.png`
Expected: `PNG image data, 1200 x 630`.

- [ ] **Step 3: Commit**

```bash
git add site/assets/og-default.png
git commit -m "feat: default 1200x630 social card"
```

---

### Task 13: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + full test suite**

Run: `node build/check-content.mjs && node build.mjs && node --test tests/*.test.mjs`
Expected: content valid; `OK: 59 ämnen, 73 filer genererade`; all tests pass.

- [ ] **Step 2: Verify crawlable content in raw HTML (no JS)**

Run: `grep -q 'Så fungerar' site/amne/*/index.html && echo OK` (or pick any known content phrase)
Better, confirm a specific subject's body text is present in source:
Run: `node -e "const h=require('fs').readFileSync('site/amne/tak/index.html','utf8'); console.log('has h1:', /<h1[^>]*>Tak<\/h1>/.test(h), '| canonical:', /amne\/tak\/\"/.test(h), '| jsonld:', h.includes('TechArticle'));"`
Expected: all `true`.

- [ ] **Step 3: Validate sitemap coverage**

Run: `node -e "const x=require('fs').readFileSync('site/sitemap.xml','utf8'); console.log('urls:', (x.match(/<url>/g)||[]).length);"`
Expected: `urls: 67`.

- [ ] **Step 4: Serve locally and drive the site with `playwright-cli`**

Serve `site/` on a local port (e.g. `npx --yes http-server site -p 8099` or `python3 -m http.server 8099 -d site`), then with `playwright-cli`:
1. Open `http://localhost:8099/husagarens-handbok/`? — NOTE: a plain static server serves `site/` at root, so paths won't carry the `/husagarens-handbok/` prefix. For local verification, temporarily test with the prefix stripped OR open files by their generated paths. Confirm: (a) home shows category cards + all subject links; (b) clicking a subject link loads `/amne/<id>/` as a full page with content; (c) focusing search lazy-loads `search-index.js` (check Network) and typing returns results; (d) selecting a result navigates to the subject and scrolls to the section; (e) theme toggle persists; (f) breadcrumbs render.

> Because internal links are absolute with the `/husagarens-handbok` prefix, the cleanest local check is GitHub Pages itself after merge, or a server mounted so that prefix resolves. For pre-merge confidence, rely on the raw-HTML greps (Steps 2–3) plus opening a single generated `site/amne/tak/index.html` via `file://` to confirm the page renders and search lazy-loads (search will fail to fetch under file:// prefix — acceptable; verify search on the deployed URL).

- [ ] **Step 5: Invoke the verification skill**

Use the `verify` skill (or `superpowers:verification-before-completion`) to confirm the change does what it should end-to-end before claiming completion. Record evidence (grep outputs, test summary, screenshots).

- [ ] **Step 6: Finalize**

Use `superpowers:finishing-a-development-branch` to open a PR (or merge) for `seo-optimization`. The Pages workflow will rebuild and deploy on merge to `main`. After deploy, spot-check the live URLs:
- `https://rhorno.github.io/husagarens-handbok/sitemap.xml`
- `https://rhorno.github.io/husagarens-handbok/amne/tak/`
- `https://rhorno.github.io/husagarens-handbok/llms.txt`

---

## Self-Review

**Spec coverage:**
- Architecture shift → Tasks 5, 6, 9, 10. ✓
- Clean per-subject/category/home URLs → Tasks 1, 6, 9. ✓
- Pre-rendered sidebar + plain-link nav → Tasks 5, 6, 10. ✓
- Back-compat hash redirect → Task 6 (`HASH_REDIRECT`, home only). ✓
- Per-page head (title/description/canonical/OG/Twitter/robots/lang) → Task 5. ✓
- Auto-derived descriptions → Tasks 2, 6, 9. ✓
- JSON-LD (WebSite+SearchAction, TechArticle+citation, BreadcrumbList, CollectionPage) → Tasks 4, 6; SearchAction made real via `?q=` in Task 10. ✓
- Visible breadcrumbs → Tasks 5, 6, 11. ✓
- sitemap/robots/llms.txt/llms-full.txt/404 → Tasks 6, 8, 9. ✓
- Lazy text-only search index → Tasks 7, 9, 10. ✓
- Search result → real URL navigation, keep `sec-<idx>` anchors → Tasks 6, 10. ✓
- `og:default.png` → Task 12. ✓
- Remove `data.js`, gitignore generated output → Task 11. ✓
- Dates from git w/ fallback → Tasks 3, 9. ✓
- Tests extend existing suite; existing green → all tasks + Task 13. ✓
- BASE_URL single source / custom-domain one-liner → Task 1 (verified by test). ✓

**Placeholder scan:** No TBD/TODO. Task 12 Step 2 delegates PNG rendering to the `playwright-cli` skill (an asset-generation step, not a code placeholder); card HTML is fully specified. Task 13 is verification (no code). Task 11 Step 1 notes to match existing CSS variable names — check-and-adapt, not a placeholder.

**Type consistency:**
- `sidebarHtml`, `breadcrumbHtml`, `pageHtml`, `escapeHtml` names consistent across page-template ↔ render-pages.
- `ctx = { kategorier, amnenByKategori (Map), katTitelById (Map) }` consistent across render-pages ↔ build.mjs `buildContext`.
- `HANDBOK_SEARCH` global set by `renderSearchIndexJs` (Task 7) and consumed in `app.js` (Task 10). ✓
- `window.SITE = { prefix, searchIndexUrl }` set by `pageHtml` (Task 5) and read by `app.js` (Task 10). ✓
- Search entry fields (`subjectId`, `subjectTitle`, `sectionIdx`, `sectionTitle`, `level`, `snippet`) match `search.js` output consumed by `app.js`. ✓
- `breadcrumbJsonLd` takes absolute URLs (Task 6 Step 3b corrects this). ✓
- File count: home(1)+cat(7)+subject(59)+search-index(1)+404(1)+sitemap(1)+robots(1)+llms(1)+llms-full(1)=73; sitemap urls=67. ✓
```
