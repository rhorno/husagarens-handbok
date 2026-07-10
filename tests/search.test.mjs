import test from 'node:test';
import assert from 'node:assert/strict';

await import('../site/search.js');
const { normalize, tokenize, buildIndex, search } = globalThis.SearchLib;

function buildFixtureIndex() {
  const subjects = [
    {
      id: 'tak',
      titel: 'Tak',
      kategori: 'husets-skal',
      nyckelord: ['takpannor', 'hängrännor', 'skotselplan'],
      sections: [
        {
          title: 'Grunderna',
          level: 'nybörjare',
          html: '<p>Rensa hängrännor och kontrollera takpannor regelbundet varje vår.</p>',
          text: 'Rensa hängrännor och kontrollera takpannor regelbundet varje vår.',
        },
        {
          title: 'Underhåll',
          level: null,
          html: '<p>Häckar och buskar nära huset kan skada taket om de växer för nära.</p>',
          text: 'Häckar och buskar nära huset kan skada taket om de växer för nära.',
        },
      ],
    },
    {
      id: 'kallare',
      titel: 'Källare',
      kategori: 'husets-skal',
      nyckelord: ['fukt'],
      sections: [
        {
          title: 'Fuktproblem',
          level: null,
          html: '<p>Tak i källaren måste tätas för att undvika fukt.</p>',
          text: 'Tak i källaren måste tätas för att undvika fukt.',
        },
      ],
    },
    {
      id: 'tradgard',
      titel: 'Trädgård',
      kategori: 'utomhus',
      nyckelord: ['gräsmatta', 'buskar'],
      sections: [
        {
          title: 'Gräsmatta',
          level: null,
          html: '<p>Klipp gräsmattan varje vecka på sommaren.</p>',
          text: 'Klipp gräsmattan varje vecka på sommaren.',
        },
      ],
    },
  ];
  return { subjects, index: buildIndex(subjects) };
}

test('normalize lowercases, trims, collapses whitespace, keeps å/ä/ö', () => {
  assert.equal(normalize('  GRÄS   matta  '), 'gräs matta');
  assert.equal(normalize('Häckar'), 'häckar');
  assert.equal(normalize('  Trädgård  '), 'trädgård');
});

test('tokenize splits on non-letter/non-digit, unicode-aware, keeps å/ä/ö', () => {
  assert.deepEqual(tokenize('Häckar och buskar!'), ['häckar', 'och', 'buskar']);
  assert.deepEqual(tokenize('Åtgärd-2024'), ['åtgärd', '2024']);
  assert.deepEqual(tokenize(''), []);
});

test('prefix match: "häck" finds "häckar"', () => {
  const { index } = buildFixtureIndex();
  const results = search(index, 'häck');
  assert.ok(results.some((r) => r.subjectId === 'tak' && r.sectionTitle === 'Underhåll'));
});

test('å/ä/ö case-insensitivity: "GRÄS" finds "gräsmatta"', () => {
  const { index } = buildFixtureIndex();
  const results = search(index, 'GRÄS');
  assert.equal(results.length, 1);
  assert.equal(results[0].subjectId, 'tradgard');
  assert.equal(results[0].sectionTitle, 'Gräsmatta');
  assert.equal(results[0].score, 5);
});

test('AND semantics: both query tokens must match within the same section', () => {
  const { index } = buildFixtureIndex();
  const noMatch = search(index, 'häck vår');
  assert.deepEqual(noMatch, []);

  const bothMatch = search(index, 'häck buskar');
  assert.equal(bothMatch.length, 1);
  assert.equal(bothMatch[0].subjectId, 'tak');
  assert.equal(bothMatch[0].sectionTitle, 'Underhåll');
  assert.equal(bothMatch[0].score, 2);
});

test('subject title match (8) beats body-only match (1), sorted score desc then manifest order', () => {
  const { index } = buildFixtureIndex();
  const results = search(index, 'tak');
  assert.equal(results.length, 3);
  assert.equal(results[0].subjectId, 'tak');
  assert.equal(results[0].sectionTitle, 'Grunderna');
  assert.equal(results[0].score, 8);
  assert.equal(results[1].subjectId, 'tak');
  assert.equal(results[1].sectionTitle, 'Underhåll');
  assert.equal(results[1].score, 8);
  assert.equal(results[2].subjectId, 'kallare');
  assert.equal(results[2].score, 1);
});

test('keyword match (4) beats body-only match (1)', () => {
  const { index } = buildFixtureIndex();
  const keywordResults = search(index, 'skotsel');
  assert.ok(keywordResults.length > 0);
  for (const r of keywordResults) assert.equal(r.score, 4);

  const bodyResults = search(index, 'skada');
  assert.equal(bodyResults.length, 1);
  assert.equal(bodyResults[0].score, 1);

  assert.ok(keywordResults[0].score > bodyResults[0].score);
});

test('snippet is the first body occurrence of the first query token, ±60 chars', () => {
  const { index } = buildFixtureIndex();
  const results = search(index, 'häck');
  const hit = results.find((r) => r.sectionTitle === 'Underhåll');
  assert.ok(hit);
  assert.equal(hit.snippet.match, 'Häckar');
  assert.equal(hit.snippet.before, '');
  assert.ok(hit.snippet.after.startsWith(' och buskar'));
});

test('snippet preserves original casing from the source text while matching stays case-insensitive', () => {
  const subjects = [
    {
      id: 'gras',
      titel: 'Gräsmatta',
      kategori: 'utomhus',
      nyckelord: [],
      sections: [
        {
          title: 'Skötsel',
          level: null,
          text: 'Vår rutin: klipp Gräsmattan regelbundet varje vecka på sommaren.',
        },
      ],
    },
  ];
  const index = buildIndex(subjects);
  const results = search(index, 'gräs');
  assert.equal(results.length, 1);
  assert.equal(results[0].snippet.match, 'Gräsmattan');
  assert.equal(results[0].snippet.before, 'Vår rutin: klipp ');
  assert.ok(results[0].snippet.after.startsWith(' regelbundet'));
});

test('empty query returns empty results', () => {
  const { index } = buildFixtureIndex();
  assert.deepEqual(search(index, ''), []);
  assert.deepEqual(search(index, '   '), []);
});
