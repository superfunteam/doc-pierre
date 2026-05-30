# Card Deck Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-first web prototype that simulates a stacked deck of icebreaker question cards — tap to flip, swipe to dismiss — for playtesting Doc Pierre's Group Chat before printing.

**Architecture:** Two files. `deck.js` is a pure-logic ES module (CSV parsing, text rendering, deck state) — covered by unit tests with Node's built-in test runner. `index.html` is the whole UI: inline CSS, inline JS that imports `deck.js`, GSAP from CDN, no build step. Spec: [docs/superpowers/specs/2026-05-30-card-deck-simulator-design.md](../specs/2026-05-30-card-deck-simulator-design.md).

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), GSAP 3 from CDN for tweens, CSS 3D transforms for the flip and stack depth, Node 18+ for tests.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `index.html` | UI: viewport meta, stack/face DOM, all CSS, all interaction wiring, GSAP tweens. |
| `deck.js` | Pure logic: `parseCSV`, `renderProminent`, `shuffle`, `Deck` class. ESM exports. |
| `test/deck.test.js` | Unit tests for `deck.js` using `node:test`. |
| `package.json` | `"type": "module"`, `"test"` script. No runtime deps. |
| `.gitignore` | `.DS_Store`, `node_modules/`. |
| `questions.csv` | Provided. Columns: `Number, Category, Prompt`. |
| `card-back.png` | Provided. Card back image. |
| `sounds/sound000NN.mp3` | Provided. 11 effect clips played randomly on each card draw. |

`index.html` and `deck.js` are the only files with real code. Logic in `deck.js` so it stays testable; everything visual/interactive in `index.html` because animations are best read in context with the markup and styles they animate.

---

## Task 1: Project scaffold

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Modify (git): initial commit of provided assets + scaffold

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
node_modules/
*.log
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "doc-pierre-deck",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 3: Verify Node version supports `node:test`**

Run: `node --version`
Expected: `v18.x` or higher. If lower, stop and tell the user.

- [ ] **Step 4: Commit scaffold + provided assets**

```bash
git add .gitignore package.json questions.csv card-back.png docs/
git commit -m "chore: scaffold project with assets and spec"
```

---

## Task 2: CSV parser (TDD)

The provided CSV has quoted fields containing commas (e.g., `"hello, world"`). A naive `split(',')` will break — we need a real (minimal) parser. Pure function, easy to test.

**Files:**
- Create: `deck.js`
- Create: `test/deck.test.js`

- [ ] **Step 1: Write failing test**

Create `test/deck.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test`
Expected: 4 failures, error message references missing module or missing `parseCSV` export.

- [ ] **Step 3: Implement `parseCSV` in `deck.js`**

```js
export function parseCSV(text) {
  const rows = [];
  let i = 0;
  const cells = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => { cells.push(cell); cell = ''; };
  const pushRow = () => {
    if (cells.length === 1 && cells[0] === '') { cells.length = 0; return; }
    rows.push(cells.slice());
    cells.length = 0;
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushCell(); i++; continue; }
    if (c === '\n') { pushCell(); pushRow(); i++; continue; }
    if (c === '\r') { i++; continue; }
    cell += c; i++;
  }
  if (cell.length || cells.length) { pushCell(); pushRow(); }

  if (!rows.length) return [];
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test`
Expected: 4 passing tests.

- [ ] **Step 5: Sanity-check against the real CSV**

Run:
```bash
node -e "import('./deck.js').then(async m => { const fs = await import('node:fs'); const rows = m.parseCSV(fs.readFileSync('questions.csv','utf8')); console.log(rows.length, rows[0], rows.at(-1)); })"
```
Expected: `64` followed by row 1 (Work category) and row 64 (Just For Fun).

- [ ] **Step 6: Commit**

```bash
git add deck.js test/deck.test.js
git commit -m "feat(deck): CSV parser with quoted-field support"
```

---

## Task 3: Text renderer — italics + HTML escape (TDD)

The questions use `_word_` for italicized phrases. We need to convert those to `<em>` while escaping all other HTML so a malicious CSV can't inject markup. Pure function.

**Files:**
- Modify: `deck.js`
- Modify: `test/deck.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/deck.test.js`:

```js
import { renderProminent } from '../deck.js';

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
```

Note on the "bare underscores" case: the rule is that `_..._` only fires when the underscore at each end is at a word boundary (start/end of string or adjacent to whitespace/punctuation, not adjacent to a word character on the inside-facing side).

- [ ] **Step 2: Run tests — verify the new ones fail**

Run: `npm test`
Expected: 5 new failing tests (existing 4 still pass).

- [ ] **Step 3: Implement `renderProminent` in `deck.js`**

Append to `deck.js`:

```js
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

export function renderProminent(text) {
  // Match _phrase_ where underscores sit at word boundaries:
  // start-of-string OR non-word char before the opening _;
  // non-word char or end-of-string after the closing _.
  // Phrase content cannot start or end with whitespace.
  const re = /(^|[^A-Za-z0-9_])_([^_\s][^_]*?[^_\s]|[^_\s])_(?=$|[^A-Za-z0-9_])/g;
  let out = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += escapeHTML(text.slice(last, m.index));
    out += escapeHTML(m[1]); // boundary char before the _
    out += '<em>' + escapeHTML(m[2]) + '</em>';
    last = m.index + m[0].length;
  }
  out += escapeHTML(text.slice(last));
  return out;
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add deck.js test/deck.test.js
git commit -m "feat(deck): renderProminent — italicize _phrases_ with HTML escaping"
```

---

## Task 4: Deck state — shuffle, draw, reshuffle (TDD)

Stateful but small. Wraps an array of cards, gives next card on demand, reshuffles when exhausted, never lets the just-shown card reappear as the very next one after reshuffle.

**Files:**
- Modify: `deck.js`
- Modify: `test/deck.test.js`

- [ ] **Step 1: Add failing tests**

Append to `test/deck.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test`
Expected: 4 new failing tests.

- [ ] **Step 3: Implement `shuffle` and `Deck`**

Append to `deck.js`:

```js
export function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class Deck {
  constructor(cards) {
    if (!cards.length) throw new Error('Deck requires at least one card');
    this.cards = cards;
    this.order = shuffle(cards.map((_, i) => i));
    this.pos = 0;
    this.lastShown = -1;
  }

  next() {
    if (this.pos >= this.order.length) this._reshuffle();
    const idx = this.order[this.pos++];
    this.lastShown = idx;
    return this.cards[idx];
  }

  _reshuffle() {
    this.order = shuffle(this.cards.map((_, i) => i));
    if (this.order.length > 1 && this.order[0] === this.lastShown) {
      [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
    }
    this.pos = 0;
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

Run: `npm test`
Expected: 13 passing.

- [ ] **Step 5: Commit**

```bash
git add deck.js test/deck.test.js
git commit -m "feat(deck): Deck class with shuffle, draw, no-repeat reshuffle"
```

---

## Task 5: HTML skeleton + mobile chrome

Empty page wired up correctly for mobile: viewport meta, dark backdrop, no scroll bounce, no tap highlight, safe-area-aware. No cards yet — just the stage. This lets us verify mobile setup works before layering visuals on it.

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a1a">
  <title>Doc Pierre's Group Chat</title>
  <style>
    :root {
      --bg: #1a1a1a;
      --card-bg: #f8efd9;
      --ink: #1a2545;
      --shadow: rgba(0,0,0,0.45);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      height: 100%;
      background: var(--bg);
      overflow: hidden;
      overscroll-behavior: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
      color: #fff;
    }
    body {
      display: grid;
      place-items: center;
      padding-top: var(--safe-top);
      padding-bottom: var(--safe-bottom);
    }
    #stage {
      width: 100%;
      height: 100%;
      perspective: 1200px;
      display: grid;
      place-items: center;
    }
  </style>
</head>
<body>
  <div id="stage"></div>
  <script type="module">
    // Visual + interaction code lands here in subsequent tasks.
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verify in browser (mobile-emulated)**

Open `index.html` in Chrome with DevTools → Device Toolbar set to iPhone 14 Pro.

Expected:
- Full-bleed dark gray background
- No scrollbars
- Status bar area respected (no content jumps under notch)
- Page doesn't scroll/bounce on touch drag (try dragging in DevTools)

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): mobile-first HTML skeleton with safe-area handling"
```

---

## Task 6: Card stack render + idle breath

Static stack of 6 cards with depth offset, top card showing `card-back.png`, with a slow breathing animation on the top card so the deck reads as alive. No interaction yet.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add CSS for stack inside the existing `<style>` block**

Add these rules after the `#stage` rule:

```css
.deck {
  position: relative;
  width: min(75vw, 360px);
  aspect-ratio: 2.5 / 3.5;
  transform-style: preserve-3d;
}
.card {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: var(--card-bg);
  box-shadow: 0 8px 24px var(--shadow);
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform;
  overflow: hidden;
}
.card .face,
.card .back {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.card .back {
  background: var(--card-bg) center/cover no-repeat url('card-back.png');
  transform: rotateY(0deg);
}
.card .face {
  background: var(--card-bg);
  transform: rotateY(180deg);
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: 24px 22px;
  color: var(--ink);
}
/* Stack depth: each layer shifted + slightly scaled */
.card.layer-0 { transform: translate3d(0, 0px, 0); }
.card.layer-1 { transform: translate3d(2px, 3px, -2px); }
.card.layer-2 { transform: translate3d(4px, 6px, -4px); }
.card.layer-3 { transform: translate3d(6px, 9px, -6px); }
.card.layer-4 { transform: translate3d(8px, 12px, -8px); }
.card.layer-5 { transform: translate3d(10px, 15px, -10px); opacity: 0.95; }
```

- [ ] **Step 2: Add stack DOM and idle breath JS inside the `<script type="module">` block**

Replace the placeholder comment with:

```js
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

const stage = document.getElementById('stage');
const deck = document.createElement('div');
deck.className = 'deck';
stage.appendChild(deck);

const STACK_DEPTH = 6;
for (let i = STACK_DEPTH - 1; i >= 0; i--) {
  const card = document.createElement('div');
  card.className = `card layer-${i}`;
  card.innerHTML = `<div class="back"></div><div class="face"></div>`;
  deck.appendChild(card);
}

const topCard = deck.querySelector('.card.layer-0');
gsap.to(topCard, {
  y: -4,
  duration: 3,
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1,
});
```

GSAP UMD note: the CDN URL above is the ESM build. If the browser can't resolve it, fall back to `https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm`.

- [ ] **Step 3: Manual verify**

Reload `index.html` in DevTools' iPhone 14 Pro profile.

Expected:
- Six cards stacked, each offset diagonally down-right by ~2px per layer
- Top card displays the Doc Pierre's Group Chat back image, filling the card area
- Soft drop shadow under the stack
- Top card subtly breathes (slow up/down ~4px over 3s) — note: applies on top of layer-0's transform, which `gsap.to(... y: -4)` may visually override; if it does, see fix in next step.

- [ ] **Step 4: Fix breath stacking on layer-0 transform if needed**

`gsap.to(topCard, { y: -4 })` rewrites `transform`, killing the `.layer-0` rule. Move the layer offset into JS so GSAP knows the baseline:

Change the breath block to:

```js
gsap.set(topCard, { x: 0, y: 0, z: 0 });
gsap.to(topCard, {
  y: -4, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1,
});
```

(Layer-0's stack offset is `0,0,0` so removing the CSS transform doesn't change appearance — but doing this explicitly avoids the GSAP-vs-CSS war.)

Verify again. Breath should be visible.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): six-card stack with card back image and idle breath"
```

---

## Task 7: Tap → flip → reveal (with stack promotion)

When the top card is tapped, it lifts off the stack, flips on Y, lands centered face-up showing the question. Meanwhile the second card slides up into the top position. Tap is wired to advance the `Deck` and inject the next card's data into the face before flipping.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Import deck logic and load CSV**

Add near the top of the `<script type="module">` block (after the GSAP import):

```js
import { parseCSV, renderProminent, Deck } from './deck.js';

const csvText = await fetch('questions.csv').then(r => r.text());
const rows = parseCSV(csvText);
const deckState = new Deck(rows.map(r => ({ category: r.Category, question: r.Prompt })));
```

- [ ] **Step 2: Add a "face content writer" helper**

Add after the deck setup:

```js
function paintFace(cardEl, card) {
  const face = cardEl.querySelector('.face');
  face.innerHTML = `
    <div class="badge" data-category="${card.category.replace(/"/g, '&quot;')}">${escapeAttr(card.category)}</div>
    <p class="prompt">${renderProminent(card.question)}</p>
    <div class="footer">DOC PIERRE'S GROUP CHAT</div>
  `;
}
function escapeAttr(s) {
  return s.replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}
```

- [ ] **Step 3: Add card-face CSS**

Add to the `<style>` block:

```css
.card .face .badge {
  align-self: start;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 999px;
  background: #2D4FA0;
  color: #fff;
}
.card .face .prompt {
  align-self: center;
  margin: 0;
  font-size: clamp(20px, 5.2vw, 28px);
  line-height: 1.25;
  font-weight: 600;
  text-align: center;
  color: var(--ink);
}
.card .face .prompt em {
  font-style: italic;
  color: #E94B3C;
}
.card .face .footer {
  align-self: center;
  font-size: 10px;
  letter-spacing: 0.18em;
  opacity: 0.55;
  color: var(--ink);
}
```

- [ ] **Step 4: Wire up tap → flip animation**

Add after `paintFace` / `escapeAttr`:

```js
let isAnimating = false;
let revealed = null; // current face-up card element when one exists

function promoteStack() {
  // Every card moves up one layer. Layer 0 (currently flying off) is being handled separately.
  const cards = [...deck.querySelectorAll('.card')];
  cards.forEach(c => {
    const m = c.className.match(/layer-(\d+)/);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (n === 0) return;
    c.classList.replace(`layer-${n}`, `layer-${n - 1}`);
  });
  // Add a new bottom card to keep the stack at 6.
  const tail = document.createElement('div');
  tail.className = `card layer-${STACK_DEPTH - 1}`;
  tail.innerHTML = `<div class="back"></div><div class="face"></div>`;
  deck.insertBefore(tail, deck.firstChild);
}

function flipTopCard() {
  if (isAnimating || revealed) return;
  isAnimating = true;

  const card = deck.querySelector('.card.layer-0');
  gsap.killTweensOf(card); // stop idle breath
  card.classList.remove('layer-0');
  card.style.zIndex = 100;

  const next = deckState.next();
  paintFace(card, next);

  const tl = gsap.timeline({ onComplete: () => { isAnimating = false; revealed = card; } });
  tl.to(card, { y: -40, z: 40, scale: 1.05, duration: 0.25, ease: 'power2.out' }, 0);
  tl.to(card, { rotationY: 180, duration: 0.6, ease: 'power2.inOut' }, 0.05);
  tl.to(card, { y: 0, scale: 1.0, duration: 0.25, ease: 'power2.out' }, 0.5);

  promoteStack();
  // Restart breath on the new top card.
  const newTop = deck.querySelector('.card.layer-0');
  gsap.set(newTop, { x: 0, y: 0, z: 0 });
  gsap.to(newTop, { y: -4, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

deck.addEventListener('pointerdown', (e) => {
  // Only the topmost (z-elevated or layer-0) card triggers.
  const card = e.target.closest('.card');
  if (!card) return;
  if (!card.classList.contains('layer-0')) return;
  flipTopCard();
});
```

- [ ] **Step 5: Manual verify**

Reload. In iPhone DevTools profile, tap the top card.

Expected:
- Top card lifts, flips, lands centered face-up
- Visible badge with the category name (e.g., "WORK"), question text below it, footer at bottom
- During the flip, the rest of the stack visibly shifts up a notch and a new layer-5 appears at the bottom
- Question text supports `_italic phrases_` rendered in coral
- A second tap on the deck (the new top card) does nothing while a card is revealed (we'll wire dismiss next)

If the flip is mirrored (text appears backward), it means `backface-visibility: hidden` isn't applied to `.face`/`.back`. Verify CSS is in place.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(ui): tap top card to flip and reveal question, stack promotes"
```

---

## Task 8: Drag → spring-back or dismiss

Face-up card follows finger live (translate + rotate). Released past a distance/velocity threshold, it flies off in the drag direction and the user is back to the deck. Released short, it springs back to center.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add drag CSS hints**

In the `<style>` block, add:

```css
.card.revealed { touch-action: none; cursor: grab; }
.card.revealed:active { cursor: grabbing; }
```

- [ ] **Step 2: Tag the revealed card**

Inside `flipTopCard`'s timeline `onComplete`, after `revealed = card;`, add:

```js
card.classList.add('revealed');
```

- [ ] **Step 3: Add drag handler**

Append after the `pointerdown` listener:

```js
let drag = null;

deck.addEventListener('pointerdown', (e) => {
  if (!revealed) return;
  const card = e.target.closest('.card.revealed');
  if (!card) return;
  card.setPointerCapture(e.pointerId);
  drag = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    lastT: performance.now(),
    vx: 0, vy: 0,
  };
  gsap.killTweensOf(card);
});

deck.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pointerId || !revealed) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  const now = performance.now();
  const dt = Math.max(1, now - drag.lastT);
  drag.vx = (e.clientX - drag.lastX) / dt;
  drag.vy = (e.clientY - drag.lastY) / dt;
  drag.lastX = e.clientX; drag.lastY = e.clientY; drag.lastT = now;
  const rot = Math.max(-20, Math.min(20, dx * 0.06));
  gsap.set(revealed, { x: dx, y: dy, rotation: rot, rotationY: 180 });
});

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.pointerId) || !revealed) return;
  const dx = drag.lastX - drag.startX;
  const dy = drag.lastY - drag.startY;
  const speed = Math.hypot(drag.vx, drag.vy); // px/ms
  const distance = Math.hypot(dx, dy);
  const threshold = Math.min(window.innerWidth, window.innerHeight) * 0.30;
  const fling = speed > 0.6;

  const card = revealed;
  drag = null;

  if (distance > threshold || fling) {
    // Dismiss in the direction of travel.
    const angle = Math.atan2(dy, dx);
    const flyDist = Math.max(window.innerWidth, window.innerHeight) * 1.4;
    const tx = Math.cos(angle) * flyDist;
    const ty = Math.sin(angle) * flyDist;
    const spin = (dx >= 0 ? 1 : -1) * (180 + Math.random() * 90);
    gsap.to(card, {
      x: tx, y: ty, rotation: spin, duration: 0.45, ease: 'power2.in',
      onComplete: () => { card.remove(); revealed = null; },
    });
  } else {
    gsap.to(card, {
      x: 0, y: 0, rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.6)',
    });
  }
}

deck.addEventListener('pointerup', endDrag);
deck.addEventListener('pointercancel', endDrag);
```

- [ ] **Step 4: Manual verify (desktop first, then mobile)**

Reload. In DevTools' iPhone profile with touch emulation:

Expected:
- Tap top card → flips up as before
- Press-and-drag the face-up card → card moves with the pointer, rotates slightly toward drag direction
- Release after short drag (< 30% of width) → springs back to center
- Release after big drag (> 30%) or quick fling → card flies off-screen in that direction; deck is now ready, breath continues on the new top card
- Tap the deck again → next question reveals

Edge case to check: drag straight up (Tinder-reject style) should also dismiss. Diagonal flings should fly diagonally, not snap to an axis.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(ui): drag-to-dismiss with spring-back and live finger tracking"
```

---

## Task 9: Category color palette

Five categories, five colors, all sampled to live alongside the card-back's red/blue/cream. Drives the badge background and (subtly) the italic color.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Define the palette as a CSS map and apply via `data-category`**

In the `<style>` block, replace the static `.card .face .badge` background rule with category-aware variants:

```css
.card .face .badge { background: #555; color: #fff; }
.card .face .badge[data-category="Work"]         { background: #E94B3C; }
.card .face .badge[data-category="Family"]       { background: #2D4FA0; }
.card .face .badge[data-category="Friend Group"] { background: #F4C84A; color: #1a2545; }
.card .face .badge[data-category="Travel"]       { background: #3CA39E; }
.card .face .badge[data-category="Just For Fun"] { background: #E66A9E; }
```

- [ ] **Step 2: Manual verify across categories**

Reload. Tap-and-dismiss repeatedly until you've cycled through at least one card of each category (Work, Family, Friend Group, Travel, Just For Fun).

Expected: each category's badge uses its assigned color. Friend Group (yellow) uses dark text; all others use white text.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(ui): brand-aligned category color palette for badges"
```

---

## Task 10: Shake to advance (with iOS permission prime)

Shaking the phone advances the next card just like a tap. iOS 13+ requires explicit permission for `DeviceMotionEvent` — we request on the first user tap of the session (which is also when one happens naturally).

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add shake-detection module inside the `<script type="module">` block**

Add this block after the existing event listeners:

```js
let motionPermissionRequested = false;
async function primeMotionPermission() {
  if (motionPermissionRequested) return;
  motionPermissionRequested = true;
  const DM = window.DeviceMotionEvent;
  if (DM && typeof DM.requestPermission === 'function') {
    try { await DM.requestPermission(); } catch {}
  }
}

let lastShake = 0;
window.addEventListener('devicemotion', (e) => {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  // Resting magnitude with gravity ≈ 9.8. Shake threshold ≈ 22.
  if (mag > 22 && performance.now() - lastShake > 800) {
    lastShake = performance.now();
    if (revealed) {
      // Dismiss the current card in a random direction, then it'll be ready for the next tap.
      const card = revealed;
      const dir = Math.random() < 0.5 ? -1 : 1;
      revealed = null;
      gsap.to(card, {
        x: dir * window.innerWidth * 1.2,
        rotation: dir * 180,
        duration: 0.4, ease: 'power2.in',
        onComplete: () => card.remove(),
      });
    } else if (!isAnimating) {
      flipTopCard();
    }
  }
});
```

- [ ] **Step 2: Prime permission on first tap**

Modify the `pointerdown` listener that handles tap-to-flip — add the prime call at the top:

```js
deck.addEventListener('pointerdown', (e) => {
  primeMotionPermission(); // fire-and-forget; only meaningful first time
  const card = e.target.closest('.card');
  if (!card) return;
  if (!card.classList.contains('layer-0')) return;
  flipTopCard();
});
```

- [ ] **Step 3: Manual verify**

Desktop test: load page, confirm tap still works and no console errors fire.

Mobile test (requires a real phone or simulator): open over a local web server (e.g. `python3 -m http.server`) on the LAN, visit from the phone.

Expected on iPhone:
- First tap shows an iOS dialog asking for motion permission
- After approving, shaking the phone advances the card (dismisses if revealed, flips if on deck)
- On Android, no permission prompt fires and shake works directly

If iOS denies, tap continues to work and shake is silently a no-op.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): shake-to-advance with iOS DeviceMotion permission prime"
```

---

## Task 11: Sound effects on draw

Preload all 11 mp3s. On every card draw (tap OR shake), play one at random — never the same one twice in a row, at full volume. Must work on iOS, which requires the play call to originate from a user gesture (which a tap is, and shake-after-tap is too, since the motion permission was already granted via a tap).

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Preload the sound bank**

Add near the top of the `<script type="module">` block, after the deck setup:

```js
const SOUND_COUNT = 11;
const sounds = [];
for (let i = 1; i <= SOUND_COUNT; i++) {
  const a = new Audio(`sounds/sound${String(i).padStart(5, '0')}.mp3`);
  a.preload = 'auto';
  a.volume = 1.0;
  sounds.push(a);
}
let lastSoundIdx = -1;
function playDrawSound() {
  if (!sounds.length) return;
  let idx = Math.floor(Math.random() * sounds.length);
  if (sounds.length > 1 && idx === lastSoundIdx) {
    idx = (idx + 1) % sounds.length;
  }
  lastSoundIdx = idx;
  const a = sounds[idx];
  try {
    a.pause();
    a.currentTime = 0;
    a.volume = 1.0;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {}
}
```

Why we ignore `play()` rejections: on first load some browsers reject if no gesture is registered yet, and we don't want a console error spam. The actual tap that triggered the flip IS a gesture, so subsequent plays succeed.

- [ ] **Step 2: Call it from `flipTopCard`**

At the very top of `flipTopCard` (before `isAnimating || revealed` guard returns), no — the play should happen on a *successful* draw, so add it after the guard, just after `isAnimating = true;`:

```js
function flipTopCard() {
  if (isAnimating || revealed) return;
  isAnimating = true;
  playDrawSound();   // <-- add this line

  const card = deck.querySelector('.card.layer-0');
  // ... rest unchanged
}
```

(The shake handler also calls `flipTopCard()` when on the deck, so this covers both inputs without duplicating.)

- [ ] **Step 3: Manual verify**

Reload. With device sound on, tap the deck.

Expected:
- A sound plays at full volume on the very first tap (since the tap itself is the gesture, iOS will allow it)
- Tapping again plays a different sound — never the same one twice consecutively
- Swipe to dismiss → tap → new sound
- Shake to advance also plays a sound (because shake routes through `flipTopCard`)
- After many draws, you can hear roughly even distribution across the 11 clips

If a sound clips or is too quiet, that's a source-file issue, not a code issue — note it for the user and move on.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(ui): random sound effect on every card draw, preloaded bank of 11"
```

---

## Self-Review Notes

Walked the plan against the spec:

- ✅ Single static file deliverable → Task 5+
- ✅ GSAP from CDN, no build → Task 6
- ✅ Stack of 6 cards with depth → Task 6
- ✅ Card-back image as top card → Task 6
- ✅ Idle breath → Task 6
- ✅ Tap to lift + flip + center → Task 7
- ✅ Second card promotes during flip → Task 7
- ✅ Category badge + question text + footer → Task 7
- ✅ Italic `_phrase_` rendering → Task 3 + Task 7
- ✅ Drag follows finger, rotates → Task 8
- ✅ Threshold dismiss vs spring back → Task 8
- ✅ Background tap does nothing → Task 7 (closest+layer-0 check)
- ✅ Auto-reshuffle, no-repeat → Task 4
- ✅ Shake advances → Task 10
- ✅ iOS permission flow → Task 10
- ✅ Safe-area, touch-action, no tap highlight, no scroll bounce → Task 5
- ✅ Palette refined after seeing CSV → Task 9 uses brand colors sampled from the card back
- ✅ Random sound on every draw → Task 11 (hooks both tap and shake paths via `flipTopCard`)

Type/signature consistency checked: `Deck.next()` returns `{ category, question }`; consumers in Task 7 read both fields. `parseCSV` returns header-keyed rows; Task 7 maps `r.Category` / `r.Prompt`. `renderProminent` is called only on `card.question`, not the category (matches design: category renders raw, escaped via `escapeAttr`).

No placeholders, no "similar to Task N" — every code block is complete.
