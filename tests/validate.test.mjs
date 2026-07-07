import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubjectFile } from '../build/parse.mjs';
import { validateSubject } from '../build/validate.mjs';

const MANIFEST = { id: 'tak', kategori: 'husets-skal' };

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

// Section entirely removed (heading + body).
const MISSING_SECTION = VALID.replace(
  `## Regler & lagkrav
Taksäkerhet regleras i BBR.[^2]

`,
  ''
);

// Same 9 sections present, but two of them are swapped.
const WRONG_ORDER = VALID.replace(
  `## Grunderna
<!-- nivå: nybörjare -->
Så inspekterar du taket.[^1]

## Regler & lagkrav
Taksäkerhet regleras i BBR.[^2]

`,
  `## Regler & lagkrav
Taksäkerhet regleras i BBR.[^2]

## Grunderna
<!-- nivå: nybörjare -->
Så inspekterar du taket.[^1]

`
);

// nivå comment removed from Grunderna.
const MISSING_NIVA = VALID.replace(
  `## Grunderna
<!-- nivå: nybörjare -->
Så inspekterar du taket.[^1]`,
  `## Grunderna
Så inspekterar du taket.[^1]`
);

// nivå comment present but wrong value for the section.
const WRONG_NIVA = VALID.replace(
  `## Grunderna
<!-- nivå: nybörjare -->`,
  `## Grunderna
<!-- nivå: mellan -->`
);

// A source is added that no footnote ref points to.
const UNREFERENCED_SOURCE = VALID.replace(
  `2. [Boverket — BBR](https://www.boverket.se/bbr)
`,
  `2. [Boverket — BBR](https://www.boverket.se/bbr)
3. [Boverket — Extra](https://www.boverket.se/extra)
`
);

// A footnote ref is added that has no matching source entry.
const REF_WITHOUT_SOURCE = VALID.replace(
  'Att gå på våt plåt.[^2]',
  'Att gå på våt plåt.[^2] Halka är vanligt.[^3]'
);

// One source URL uses http instead of https.
const HTTP_URL = VALID.replace(
  '1. [Boverket — Tak](https://www.boverket.se/tak)',
  '1. [Boverket — Tak](http://www.boverket.se/tak)'
);

// A fenced code block inside a section.
const CODE_FENCE = VALID.replace(
  '| Vår | Inspektera[^1] |',
  '| Vår | Inspektera[^1] |\n\n```\nkod\n```'
);

// A blockquote inside a section.
const BLOCKQUOTE = VALID.replace(
  'Att gå på våt plåt.[^2]',
  'Att gå på våt plåt.[^2]\n\n> Ett citat.'
);

// An image inside a section.
const IMAGE = VALID.replace(
  'Taket skyddar huset.[^1]',
  'Taket skyddar huset.[^1]\n\n![alt](https://example.com/bild.png)'
);

// Inline HTML (not a nivå comment) inside a section.
const INLINE_HTML = VALID.replace(
  'Taket skyddar huset.[^1]',
  'Taket skyddar huset.<b>[^1]</b>'
);

// Required section (Översikt) has no footnote ref at all.
const MISSING_FOOTNOTE_IN_SECTION = VALID.replace(
  'Taket skyddar huset.[^1]',
  'Taket skyddar huset.'
);

// Frontmatter is missing the kategori field entirely.
const MISSING_FRONTMATTER_FIELD = VALID.replace('kategori: husets-skal\n', '');

test('valid doc has no errors', () => {
  const p = parseSubjectFile(VALID);
  assert.deepEqual(validateSubject(p, MANIFEST), []);
});

test('frontmatter id/kategori mismatch with manifest is rejected', () => {
  const p = parseSubjectFile(VALID);
  const errors = validateSubject(p, { id: 'annat-amne', kategori: 'inomhus' });
  assert.ok(errors.length > 0);
  assert.ok(errors.some((e) => /id/i.test(e)));
  assert.ok(errors.some((e) => /kategori/i.test(e)));
});

test('missing frontmatter field is rejected', () => {
  const p = parseSubjectFile(MISSING_FRONTMATTER_FIELD);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /kategori/i.test(e)));
});

test('missing section is rejected', () => {
  const p = parseSubjectFile(MISSING_SECTION);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => e.includes('Regler & lagkrav')));
});

test('wrong section order is rejected', () => {
  const p = parseSubjectFile(WRONG_ORDER);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /ordning/i.test(e)));
});

test('missing nivå comment is rejected', () => {
  const p = parseSubjectFile(MISSING_NIVA);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /nivå/i.test(e) && e.includes('Grunderna')));
});

test('wrong nivå value for a section is rejected', () => {
  const p = parseSubjectFile(WRONG_NIVA);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /nivå/i.test(e) && e.includes('Grunderna')));
});

test('section missing a footnote ref is rejected', () => {
  const p = parseSubjectFile(MISSING_FOOTNOTE_IN_SECTION);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /fotnot/i.test(e) && e.includes('Översikt')));
});

test('unreferenced source is rejected', () => {
  const p = parseSubjectFile(UNREFERENCED_SOURCE);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /k[äa]lla/i.test(e) && e.includes('3')));
});

test('footnote ref without a matching source is rejected', () => {
  const p = parseSubjectFile(REF_WITHOUT_SOURCE);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => e.includes('3') && /fotnot|k[äa]lla/i.test(e)));
});

test('non-https source URL is rejected', () => {
  const p = parseSubjectFile(HTTP_URL);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /https/i.test(e)));
});

test('code fence is rejected as forbidden markdown', () => {
  const p = parseSubjectFile(CODE_FENCE);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /kodblock|```|code/i.test(e)));
});

test('blockquote is rejected as forbidden markdown', () => {
  const p = parseSubjectFile(BLOCKQUOTE);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /citat|blockquote/i.test(e)));
});

test('image is rejected as forbidden markdown', () => {
  const p = parseSubjectFile(IMAGE);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /bild|image/i.test(e)));
});

test('inline HTML other than nivå comment is rejected', () => {
  const p = parseSubjectFile(INLINE_HTML);
  const errors = validateSubject(p, MANIFEST);
  assert.ok(errors.some((e) => /html/i.test(e)));
});

test('validateSubject never throws, even on malformed input', () => {
  assert.doesNotThrow(() => {
    validateSubject({ frontmatter: {}, sections: [], sources: [], footnoteRefs: [] }, MANIFEST);
  });
});
