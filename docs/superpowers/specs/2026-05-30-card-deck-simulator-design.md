# Card Deck Simulator — Design

A mobile-first web prototype that simulates a stacked deck of icebreaker cards for an in-development party game. Tap the deck to flip a card; swipe it away to draw the next one. Built as a playtest tool before printing the physical cards.

## Goals

- Feel like a real deck of cards on a table: depth, weight, motion.
- Zero-friction party flow: tap to draw, swipe to advance, no menus or chrome.
- Mobile-first for iPhone and Android (Safari + Chrome). Works installed-to-homescreen.
- Single static file — drop on any web host or open locally.

## Non-goals

- No accounts, persistence, multiplayer sync, or backend.
- No category picker / filter UI (decided: one mixed deck).
- No 3D engine — CSS transforms are enough for this feel.
- No print/export tooling.

## Tech stack

- Single `index.html`, embedded CSS and JS.
- [GSAP 3](https://gsap.com/) from CDN for tween + draggable feel.
- CSS 3D transforms (`transform-style: preserve-3d`, `perspective`) for the flip and stack depth.
- No build step, no framework, no bundler.

## UX states

```
        ┌─────────┐         tap card          ┌─────────┐
        │  DECK   │ ───────────────────────▶  │ REVEAL  │
        │ (idle)  │                            │ (face-  │
        │         │ ◀───────────────────────  │   up)   │
        └─────────┘   swipe past threshold     └─────────┘
                                                     │
                                                     │ drag < threshold
                                                     ▼
                                               (spring back)
```

Only two states matter. Animation transitions own everything else.

### DECK (idle)

- Stack of 6 visible cards, each offset ~2px down + 1px right from the one below, with progressive shadow.
- Top card shows the card-back image.
- Top card has a subtle floating idle animation (slow Y-axis breath, ~3s loop) so the deck reads as alive.
- Tap hit-area is the top card only. Taps outside the card are ignored.

### REVEAL (face-up)

- Card lifts (translateZ + slight scale 1.0 → 1.05), flips on the Y-axis (~600ms ease-out), lands centered face-up.
- During the flip, the second card in the stack slides up into the top position with shadow easing in — so when the user looks back at the deck after dismissing, it has not visibly shrunk.
- Face-up card content: colored category badge (top), question text (centered, large), no other chrome.
- Card responds to drag: position + rotation follow the finger (rotation = drag-x × small factor, capped).
- Release thresholds:
  - drag distance > ~30% of viewport width OR velocity > threshold → dismiss in that direction (fly off + spin)
  - otherwise → spring back to center
- After dismiss, returns to DECK with the next card now on top.

### Inputs that advance a card

- Tap top card (in DECK state).
- Device shake (accelerometer), debounced ~800ms. iOS 13+ requires permission — the first user tap of the session also primes a `DeviceMotionEvent.requestPermission()` call. If the user denies, shake silently does nothing and tap remains the only input.
- Background tap (outside card) does nothing.

## Data model

CSV loaded once at startup. Expected columns: `category`, `question`. Extra columns are tolerated but ignored for now.

In memory:

```js
{
  cards: [{ category: 'Deep', question: '...' }, ...],   // all cards
  order: [3, 0, 7, 1, ...],                              // shuffled indices
  pos: 0,                                                // next index to draw
  lastShown: 5                                           // never re-show immediately
}
```

- Shuffle once on load (Fisher-Yates).
- On reaching `pos === order.length`, re-shuffle and reset `pos = 0`. If `order[0] === lastShown`, swap with `order[1]`.
- No persistence across page reloads.

## Card visual design

- Aspect ratio 2.5 : 3.5 (poker card).
- Width: `min(75vw, 360px)`. Height derives from aspect ratio.
- Category drives badge color. Palette is a small fixed map (`{ Deep: '#…', Funny: '#…', ... }`); unknown categories fall back to neutral. Refined once we see the CSV.
- Question text uses a large, readable sans-serif. Auto-shrinks if the question is very long (set min/max via clamp).
- Card back: user-provided image, `object-fit: cover`, rounded corners matching card radius.

## Animation specs (target)

| Transition          | Duration | Easing             |
|---------------------|----------|--------------------|
| Tap → flip up       | 600ms    | `power2.out`       |
| Flip (rotateY)      | 600ms    | `power2.inOut`     |
| Spring back         | 400ms    | `elastic.out(1, 0.6)` |
| Dismiss fly-off     | 350ms    | `power2.in`        |
| Next-card promote   | 250ms    | `power1.out`       |
| Idle breath         | 3000ms  | `sine.inOut` (yoyo) |

These are starting points; tune in playtest.

## Mobile / device concerns

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">`.
- Disable text selection on cards (`user-select: none`).
- Disable iOS tap highlight (`-webkit-tap-highlight-color: transparent`).
- Use `touch-action: none` on the card so gestures don't trigger browser scroll/zoom.
- Honor safe-area insets for layout padding.
- Lock orientation visually to portrait (CSS landscape handling: still works, but card sized off viewport min-dimension).
- Pointer Events API for unified mouse/touch handling.

## File layout

```
/index.html        # the app — HTML + CSS + JS inline
/cards.csv         # questions (user-provided)
/card-back.png     # back image (user-provided)
/assets/           # any future imagery
```

CSV path and back-image path are constants near the top of the JS — easy to swap.

## Out of scope (for v1 prototype)

- Settings screen / category filter / sound effects.
- Multi-deck / multi-game-mode support.
- Saved progress, history view.
- PWA install metadata (can add later if useful).
- Analytics.

## Open questions

- Final category list + colors — pending CSV.
- Card-back image format and resolution — pending file from user.
