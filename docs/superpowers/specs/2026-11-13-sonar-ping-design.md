# Sonar-ping — design

A hidden mini-game on the empty Stream screen, for fun. Press space while
nothing has arrived and the waiting sonar becomes a game. It is the same idea
as the browser's offline game, but its own game, in NetOS Debug's own look.

## Intent

Just for fun. It is a small surprise for whoever finds it while waiting for a
first `ray()`. It is not a feature: nothing announces it, and it never stands
between you and an event.

## Goals, non-goals, anti-goals

**Goals:** one key to start and play, a best score that is remembered, and
gone the moment a real event arrives.

**Non-goals:**

- No game in the menu bar panel.
- No sound.
- No leaderboard or sharing.
- No settings for it.

**Anti-goals:**

- **Anything that delays or hides an event.** The first stream event ends the
  game, and the event shows at once.
- **Space doing something unexpected.** Space never starts the game while a
  field has focus, and never on any other view or while the stream has events.

## Approaches considered

| Approach | Verdict |
|---|---|
| **Canvas 2D with a pure game model.** A `step(state, dt)` and a `ping(state)` function hold all the rules. A canvas draws each frame. React only mounts and unmounts it. | **Chosen.** Smooth at 60 fps without re-rendering React. The rules can be checked without a browser. |
| **SVG rendered by React every frame.** This matches the existing SVG sonar. | Rejected. Reconciling the tree 60 times a second in a heavy window risks jank, for no visible gain. |
| **CSS animations with timed hit windows.** No loop at all. | Rejected. Hit precision and a rising difficulty get awkward fast. |

## Design

### Starting and stopping

**Start.** Space starts the game when all of these hold:

- the Stream view is showing,
- the stream is empty,
- no input, textarea or contenteditable has focus,
- the command palette is closed.

**On screen.** The empty state's text fades out, and the canvas takes over
the empty area, centred where the sonar sits. Score, lives and best score sit
in a corner.

**Escape** quits back to the waiting screen.

**The first stream event ends it.** The empty state unmounts the moment
`events.length > 0`, and the game goes with it. A best score reached by then
is kept.

**Focus.** The game pauses when the window loses focus and resumes when it
comes back, so a bug cannot reach the core while you are in another app.

### The game

- **Rings.** The core sends out a ring at a steady beat. The ring grows to the
  edge of the play area and fades.
- **Bugs.** Bugs appear at the edge at random angles and crawl toward the
  core.
- **Space zaps.** Every bug lying on a ring at that moment is zapped, within a
  small tolerance. Zapping several with one press scores a bonus.
- **A miss** is space with no bug on any ring. It resets the bonus streak and
  blocks space for a moment, so holding space down does not work.
- **Lives.** A bug that reaches the core costs one of three lives. With none
  left, the game shows the score and the best score. Space plays again;
  Escape goes back to waiting.
- **Difficulty.** It rises with the score: bugs spawn more often and crawl
  faster, and rings come more quickly.

### Look

- Drawn with the theme's tokens, so it follows light, dark and phosphor.
- Rings look like the sonar's rings.
- Bugs are small glyphs in the error colour.
- A zap is a brief flash.

### Remembering the best score

A `sonarBest` number in the renderer's settings, next to `changelogSeen`. App
passes it into `EmptyState` together with a setter. It never shows in
Settings.

### The one hint

The game stays hidden, apart from one hint. The longest-wait message (the
30-minute stage, "I'll wait") gets a last line that says space does something.
Anyone who waits that long has earned it.

## Constraints

- One thing per file, with dependencies injected: the game model, the drawing,
  the canvas component and the space-key hook each get a file of their own.
- No new dependencies.
- No test framework. The rules (`step`, `ping`, the scoring and the lives) get
  esbuild-bundled node checks, as in the menu bar work. The look and feel is
  checked by hand.

## Left to the builder

- Exact numbers: ring beat, crawl speed, tolerance, the size of the bonus and
  the difficulty curve. Tune them by playing. A first game should last about a
  minute.
- The glyph for a bug, and the exact layout of score, lives and best score.
- File names under `src/renderer/src/stream/`.
