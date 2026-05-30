import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../deck.js';

test('parseCSV: returns rows keyed by header', () => {
  const text = 'a,b\n1,2\n3,4\n';
  const rows = parseCSV(text);
  assert.deepEqual(rows, [
    { a: '1', b: '2' },
    { a: '3', b: '4' },
  ]);
});

test('parseCSV: handles quoted fields with commas', () => {
  const text = 'a,b\n1,"hello, world"\n';
  const rows = parseCSV(text);
  assert.equal(rows[0].b, 'hello, world');
});

test('parseCSV: handles quoted fields with escaped quotes', () => {
  const text = 'a,b\n1,"she said ""hi"""\n';
  const rows = parseCSV(text);
  assert.equal(rows[0].b, 'she said "hi"');
});

test('parseCSV: trims trailing newline / blank lines', () => {
  const text = 'a,b\n1,2\n\n';
  const rows = parseCSV(text);
  assert.equal(rows.length, 1);
});
