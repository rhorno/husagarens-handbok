import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDates } from '../build/dates.mjs';

test('uses raw values when present', () => {
  assert.deepEqual(normalizeDates('2026-01-02', '2026-03-04', '2026-07-14'),
    { datePublished: '2026-01-02', dateModified: '2026-03-04' });
});

test('empty modified falls back to created', () => {
  assert.deepEqual(normalizeDates('2026-01-02', '', '2026-07-14'),
    { datePublished: '2026-01-02', dateModified: '2026-01-02' });
});

test('empty created falls back to the build date for both', () => {
  assert.deepEqual(normalizeDates('', '', '2026-07-14'),
    { datePublished: '2026-07-14', dateModified: '2026-07-14' });
});

test('whitespace-only inputs are treated as empty', () => {
  assert.deepEqual(normalizeDates('  ', '\n', '2026-07-14'),
    { datePublished: '2026-07-14', dateModified: '2026-07-14' });
});
