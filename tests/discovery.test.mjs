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
