import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubjectFile } from '../build/parse.mjs';

const VALID = `---
id: tak
titel: Tak
kategori: husets-skal
nyckelord: [takpannor, hängrännor]
---
# Tak

## Översikt
Taket skyddar huset.[^1]

## Grunderna
<!-- nivå: nybörjare -->
Så inspekterar du taket.[^1]

## Regler & lagkrav
Taksäkerhet regleras i BBR.[^2]

## Praktisk vägledning
<!-- nivå: mellan -->
Rensa hängrännor.[^1]

## Fördjupning
<!-- nivå: avancerad -->
Underlagstäckning i detalj.[^2]

## Underhållsschema
| När | Vad |
| --- | --- |
| Vår | Inspektera[^1] |

## Vanliga misstag
Att gå på våt plåt.[^2]

## När ska du anlita proffs
Vid arbete på hög höjd.

## Källor
1. [Boverket — Tak](https://www.boverket.se/tak)
2. [Boverket — BBR](https://www.boverket.se/bbr)
`;

const EXPECTED_TITLES = [
  'Översikt',
  'Grunderna',
  'Regler & lagkrav',
  'Praktisk vägledning',
  'Fördjupning',
  'Underhållsschema',
  'Vanliga misstag',
  'När ska du anlita proffs',
  'Källor',
];

test('parses frontmatter fields', () => {
  const p = parseSubjectFile(VALID);
  assert.deepEqual(p.frontmatter, {
    id: 'tak',
    titel: 'Tak',
    kategori: 'husets-skal',
    nyckelord: ['takpannor', 'hängrännor'],
  });
});

test('parses all 9 sections in order with correct titles', () => {
  const p = parseSubjectFile(VALID);
  assert.equal(p.sections.length, 9);
  assert.deepEqual(p.sections.map((s) => s.title), EXPECTED_TITLES);
});

test('parses sections with levels', () => {
  const p = parseSubjectFile(VALID);
  assert.equal(p.sections[1].level, 'nybörjare');
  assert.equal(p.sections[3].level, 'mellan');
  assert.equal(p.sections[4].level, 'avancerad');
});

test('sections without a nivå comment have level null', () => {
  const p = parseSubjectFile(VALID);
  const byTitle = Object.fromEntries(p.sections.map((s) => [s.title, s.level]));
  assert.equal(byTitle['Översikt'], null);
  assert.equal(byTitle['Regler & lagkrav'], null);
  assert.equal(byTitle['Underhållsschema'], null);
  assert.equal(byTitle['Vanliga misstag'], null);
  assert.equal(byTitle['När ska du anlita proffs'], null);
  assert.equal(byTitle['Källor'], null);
});

test('section markdown contains the body text', () => {
  const p = parseSubjectFile(VALID);
  const overview = p.sections.find((s) => s.title === 'Översikt');
  assert.match(overview.markdown, /Taket skyddar huset/);
});

test('parses sources list', () => {
  const p = parseSubjectFile(VALID);
  assert.equal(p.sources.length, 2);
  assert.deepEqual(p.sources[0], { n: 1, titel: 'Boverket — Tak', url: 'https://www.boverket.se/tak' });
  assert.deepEqual(p.sources[1], { n: 2, titel: 'Boverket — BBR', url: 'https://www.boverket.se/bbr' });
});

test('collects unique footnote refs used across the document', () => {
  const p = parseSubjectFile(VALID);
  assert.deepEqual(p.footnoteRefs, [1, 2]);
});
