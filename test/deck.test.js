import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, renderProminent } from '../deck.js';

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

test('renderProminent: escapes HTML by default', () => {
  assert.equal(renderProminent('<b>hi</b>'), '&lt;b&gt;hi&lt;/b&gt;');
});

test('renderProminent: converts _phrase_ to <em>phrase</em>', () => {
  assert.equal(
    renderProminent('an _aggressively casual_ email'),
    'an <em>aggressively casual</em> email'
  );
});

test('renderProminent: handles multiple italic spans', () => {
  assert.equal(
    renderProminent('_one_ and _two_'),
    '<em>one</em> and <em>two</em>'
  );
});

test('renderProminent: leaves bare underscores alone', () => {
  assert.equal(renderProminent('snake_case_var'), 'snake_case_var');
});

test('renderProminent: escapes inside italics too', () => {
  assert.equal(
    renderProminent('_<script>_'),
    '<em>&lt;script&gt;</em>'
  );
});
