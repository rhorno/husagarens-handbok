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
