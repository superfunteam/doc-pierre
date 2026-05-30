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

import { Deck } from '../deck.js';

// Deterministic RNG for tests: stub Math.random.
function withRng(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); } finally { Math.random = original; }
}

test('Deck.next: returns each card once before repeating', () => {
  const cards = [{ id: 0 }, { id: 1 }, { id: 2 }];
  const d = new Deck(cards);
  const seen = new Set();
  for (let i = 0; i < 3; i++) seen.add(d.next().id);
  assert.equal(seen.size, 3);
});

test('Deck.next: reshuffles after exhausting the order', () => {
  const cards = [{ id: 0 }, { id: 1 }];
  const d = new Deck(cards);
  d.next(); d.next();
  const c = d.next();
  assert.ok(c && typeof c.id === 'number');
});

test('Deck.next: reshuffle never makes the just-shown card the next one', () => {
  // Force shuffle to produce a known order so we can verify the swap kicks in.
  withRng([0, 0, 0, 0, 0, 0, 0, 0], () => {
    const cards = [{ id: 0 }, { id: 1 }, { id: 2 }];
    const d = new Deck(cards);
    const first = d.next();
    const second = d.next();
    const third = d.next();
    const fourth = d.next(); // post-reshuffle
    assert.notEqual(fourth.id, third.id);
  });
});

test('Deck.next: with a single-card deck, repeats are unavoidable but no crash', () => {
  const d = new Deck([{ id: 0 }]);
  assert.equal(d.next().id, 0);
  assert.equal(d.next().id, 0);
});
