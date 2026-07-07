import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, stripToText } from '../build/markdown.mjs';

test('renders # / ## / ### as h2 / h3 / h4 (page reserves h1)', () => {
  assert.equal(renderMarkdown('# Rubrik ett').trim(), '<h2>Rubrik ett</h2>');
  assert.equal(renderMarkdown('## Rubrik två').trim(), '<h3>Rubrik två</h3>');
  assert.equal(renderMarkdown('### Rubrik tre').trim(), '<h4>Rubrik tre</h4>');
});

test('renders paragraph with bold and italic', () => {
  const html = renderMarkdown('Detta är **viktigt** och *kursivt*.');
  assert.match(html, /<p>Detta är <strong>viktigt<\/strong> och <em>kursivt<\/em>\.<\/p>/);
});

test('renders links with target=_blank and rel=noopener', () => {
  const html = renderMarkdown('Läs mer på [Boverket](https://www.boverket.se).');
  assert.match(
    html,
    /<a href="https:\/\/www\.boverket\.se" target="_blank" rel="noopener">Boverket<\/a>/
  );
});

test('renders a nested unordered list (one level of nesting)', () => {
  const md = [
    '- Kolla takpannor',
    '- Rensa hängrännor',
    '  - Använd stege',
    '  - Bär handskar',
    '- Se över skorstenen',
  ].join('\n');
  const html = renderMarkdown(md);
  assert.match(
    html,
    /<ul><li>Kolla takpannor<\/li><li>Rensa hängrännor<ul><li>Använd stege<\/li><li>Bär handskar<\/li><\/ul><\/li><li>Se över skorstenen<\/li><\/ul>/
  );
});

test('renders an ordered list', () => {
  const html = renderMarkdown('1. Först\n2. Sedan');
  assert.match(html, /<ol><li>Först<\/li><li>Sedan<\/li><\/ol>/);
});

test('renders a GFM table', () => {
  const md = ['| När | Vad |', '| --- | --- |', '| Vår | Inspektera[^1] |'].join('\n');
  const html = renderMarkdown(md);
  assert.match(html, /<table>/);
  assert.match(html, /<thead><tr><th>När<\/th><th>Vad<\/th><\/tr><\/thead>/);
  assert.match(
    html,
    /<tbody><tr><td>Vår<\/td><td>Inspektera<sup class="fotnot" data-n="1"><a href="#kalla-1">1<\/a><\/sup><\/td><\/tr><\/tbody>/
  );
  assert.match(html, /<\/table>/);
});

test('renders footnote refs as sup with anchor link', () => {
  const html = renderMarkdown('Text med referens.[^2]');
  assert.match(
    html,
    /Text med referens\.<sup class="fotnot" data-n="2"><a href="#kalla-2">2<\/a><\/sup>/
  );
});

test('escapes HTML in text content', () => {
  const html = renderMarkdown('Text med <script>alert(1)</script> och & tecken.');
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&amp; tecken/);
});

test('strips the nivå comment line structurally', () => {
  const html = renderMarkdown('<!-- nivå: nybörjare -->\nSå inspekterar du taket.');
  assert.doesNotMatch(html, /nivå/);
  assert.match(html, /<p>Så inspekterar du taket\.<\/p>/);
});

test('stripToText removes markdown syntax and footnote refs, keeps text', () => {
  const md = [
    '# Rubrik',
    '',
    'Detta är **viktigt** och *kursivt* med en [länk](https://ex.se) och referens.[^1]',
    '',
    '- Punkt ett',
    '- Punkt två',
    '',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
  ].join('\n');
  const text = stripToText(md);
  assert.equal(
    text,
    'Rubrik Detta är viktigt och kursivt med en länk och referens. Punkt ett Punkt två A B 1 2'
  );
});

test('stripToText leaves no markdown syntax characters', () => {
  const md = '### Titel\n\n**Fett** och *snett* med [text](https://x.se) och ref.[^3]\n\n- Item';
  const text = stripToText(md);
  assert.doesNotMatch(text, /[#*[\]()]/);
  assert.doesNotMatch(text, /\^3/);
});
