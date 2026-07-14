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
