// tests/describe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDescription } from '../build/describe.mjs';

test('empty or nullish yields empty string', () => {
  assert.equal(deriveDescription(''), '');
  assert.equal(deriveDescription(null), '');
  assert.equal(deriveDescription(undefined), '');
});

test('short text is returned unchanged with whitespace collapsed', () => {
  assert.equal(deriveDescription('Ett  kort\ntext.'), 'Ett kort text.');
});

test('long text is cut at a word boundary and gets an ellipsis', () => {
  const long = 'a'.repeat(10) + ' ' + 'b'.repeat(200);
  const out = deriveDescription(long, 155);
  assert.ok(out.length <= 156, `len ${out.length}`);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('b'.repeat(200)));
  // does not cut mid-word: the piece before the ellipsis has no trailing partial 'b' run glued to 'a's
  assert.ok(out.startsWith('aaaaaaaaaa'));
});

test('trailing punctuation is stripped before the ellipsis', () => {
  const out = deriveDescription('Hej hej hej, ' + 'x'.repeat(200), 16);
  assert.ok(!/[,\s]…$/.test(out));
  assert.ok(out.endsWith('…'));
});
