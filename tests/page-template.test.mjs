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
