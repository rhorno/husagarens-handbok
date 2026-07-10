import test from 'node:test';
import assert from 'node:assert/strict';
import { buildData } from '../build.mjs';
import { renderMarkdown, stripToText } from '../build/markdown.mjs';

const MANIFEST = {
  kategorier: [
    { id: 'husets-skal', titel: 'Husets skal & konstruktion' },
    { id: 'inomhus', titel: 'Inomhus' },
  ],
  amnen: [
    { id: 'tak', titel: 'Tak', kategori: 'husets-skal', nyckelord: ['takpannor', 'hängrännor'] },
    { id: 'golv', titel: 'Golv', kategori: 'inomhus', nyckelord: ['parkett', 'klinker'] },
  ],
};

function subjectMarkdown({ id, titel, kategori, nyckelord }) {
  return `---
id: ${id}
titel: ${titel}
kategori: ${kategori}
nyckelord: [${nyckelord.join(', ')}]
---
# ${titel}

## Översikt
Text om ${titel}.[^1]

## Grunderna
<!-- nivå: nybörjare -->
Grundtext.[^1]

## Regler & lagkrav
Regeltext.[^2]

## Praktisk vägledning
<!-- nivå: mellan -->
Praktisk text.[^1]

## Fördjupning
<!-- nivå: avancerad -->
Fördjupningstext.[^2]

## Underhållsschema
| När | Vad |
| --- | --- |
| Vår | Inspektera[^1] |

## Vanliga misstag
Misstagstext.[^2]

## När ska du anlita proffs
Proffstext.

## Källor
1. [Källa ett](https://example.com/1)
2. [Källa två](https://example.com/2)
`;
}

const TAK_RAW = subjectMarkdown({ id: 'tak', titel: 'Tak', kategori: 'husets-skal', nyckelord: ['takpannor', 'hängrännor'] });
const GOLV_RAW = subjectMarkdown({ id: 'golv', titel: 'Golv', kategori: 'inomhus', nyckelord: ['parkett', 'klinker'] });

function validFiles() {
  return new Map([
    ['golv', GOLV_RAW], // inserted out of manifest order on purpose
    ['tak', TAK_RAW],
  ]);
}

test('amnen follow manifest order regardless of file map insertion order', () => {
  const data = buildData(MANIFEST, validFiles());
  assert.deepEqual(data.amnen.map((a) => a.id), ['tak', 'golv']);
});

test('kategorier are passed through unchanged', () => {
  const data = buildData(MANIFEST, validFiles());
  assert.deepEqual(data.kategorier, MANIFEST.kategorier);
});

test('each amne carries id/titel/kategori/nyckelord from manifest', () => {
  const data = buildData(MANIFEST, validFiles());
  const tak = data.amnen.find((a) => a.id === 'tak');
  assert.equal(tak.titel, 'Tak');
  assert.equal(tak.kategori, 'husets-skal');
  assert.deepEqual(tak.nyckelord, ['takpannor', 'hängrännor']);
});

test('each section has title, level, html, and text', () => {
  const data = buildData(MANIFEST, validFiles());
  const tak = data.amnen.find((a) => a.id === 'tak');
  assert.equal(tak.sections.length, 9);
  for (const section of tak.sections) {
    assert.equal(typeof section.title, 'string');
    assert.ok('level' in section);
    assert.equal(typeof section.html, 'string');
    assert.equal(typeof section.text, 'string');
  }
  const grunderna = tak.sections.find((s) => s.title === 'Grunderna');
  assert.equal(grunderna.level, 'nybörjare');
});

test('section html/text come from renderMarkdown/stripToText applied to the section markdown', () => {
  const data = buildData(MANIFEST, validFiles());
  const tak = data.amnen.find((a) => a.id === 'tak');
  const overview = tak.sections.find((s) => s.title === 'Översikt');
  assert.equal(overview.html, renderMarkdown('Text om Tak.[^1]'));
  assert.equal(overview.text, stripToText('Text om Tak.[^1]'));
});

test('sources array is present and correct', () => {
  const data = buildData(MANIFEST, validFiles());
  const tak = data.amnen.find((a) => a.id === 'tak');
  assert.deepEqual(tak.sources, [
    { n: 1, titel: 'Källa ett', url: 'https://example.com/1' },
    { n: 2, titel: 'Källa två', url: 'https://example.com/2' },
  ]);
});

test('Källor section is still included as a section object', () => {
  const data = buildData(MANIFEST, validFiles());
  const tak = data.amnen.find((a) => a.id === 'tak');
  const kallor = tak.sections.find((s) => s.title === 'Källor');
  assert.ok(kallor);
  assert.equal(typeof kallor.html, 'string');
  assert.equal(typeof kallor.text, 'string');
});

test('an invalid fixture makes buildData throw with the error listed', () => {
  const invalid = TAK_RAW.replace('kategori: husets-skal\n', ''); // drop required frontmatter field
  const files = new Map([
    ['tak', invalid],
    ['golv', GOLV_RAW],
  ]);
  assert.throws(
    () => buildData(MANIFEST, files),
    (err) => {
      assert.ok(err instanceof Error);
      assert.ok(/kategori/i.test(err.message));
      return true;
    }
  );
});

test('throws listing errors across all invalid files, not just the first', () => {
  const invalidTak = TAK_RAW.replace('kategori: husets-skal\n', '');
  const invalidGolv = GOLV_RAW.replace('## Källor', '## Kallllor'); // breaks required section
  const files = new Map([
    ['tak', invalidTak],
    ['golv', invalidGolv],
  ]);
  assert.throws(
    () => buildData(MANIFEST, files),
    (err) => {
      assert.ok(/tak/.test(err.message));
      assert.ok(/golv/.test(err.message));
      return true;
    }
  );
});
