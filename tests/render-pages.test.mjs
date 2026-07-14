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
  assert.match(html, /content="noindex,follow"/);
  assert.ok(!html.includes('content="index,follow"'));
  assert.equal((html.match(/name="robots"/g) || []).length, 1);
});
