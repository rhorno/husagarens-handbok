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
