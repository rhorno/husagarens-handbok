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
