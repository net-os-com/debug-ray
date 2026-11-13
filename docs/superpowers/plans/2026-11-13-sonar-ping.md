# Sonar-ping — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hidden one-key game on the empty Stream screen. Space starts it,
space zaps bugs that lie on a sonar ring, and the first real event ends it.

**Architecture:**

- The rules are pure functions over a plain `SonarGame` value:
  `newGame`, `step` and `ping`. Randomness is injected.
- A canvas component runs a `requestAnimationFrame` loop. It calls `step`,
  draws the frame with `drawGame`, and handles Space, Escape and window blur.
- `EmptyState` swaps its sonar and text for the game while one is under way.
  App hands it the best score and a setter, backed by a hidden `sonarBest`
  setting.

**Tech stack:** React 19 and Canvas 2D. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-13-sonar-ping-design.md`

## Global Constraints

- One thing per file, with dependencies injected. The rules have no DOM or
  React in them.
- No new dependencies. No test framework: the rules get esbuild-bundled node
  checks, the same set-up as the menu bar work, kept in the plan's git-ignored
  workspace.
- Space only ever starts the game when `document.activeElement` is
  `document.body` (or null). A focused button, field or palette keeps its own
  Space.
- The first stream event ends the game at once. `EmptyState` unmounts when
  `events.length > 0`, and a best score reached by then is saved on unmount.
- The game uses the theme's tokens, read from the computed style of its own
  element:
  - `--app-accent-fg` for the rings and the core,
  - `--err-fg` for the bugs and the zap flash,
  - `--t3` for the HUD.
- The canvas backing store is scaled by `devicePixelRatio`.
- Hidden: no mention in a changelog, Settings or the palette. The only hint
  is the waiting copy (Task 3).
- Starting values. They live as named constants in `rules.ts` and are tuned
  by playing.

  | Name | Value | Meaning |
  |---|---|---|
  | `LIVES` | 3 | |
  | `CORE` | 0.08 | Radius of the core, in units of the play area's radius (0–1) |
  | `RING_SPEED` | 0.5 per s | |
  | `TOLERANCE` | 0.035 | How close a bug must be to a ring to be zapped |
  | `JAM_S` | 0.35 | How long Space is blocked after a miss |
  | `MAX_DT` | 0.05 | The longest step taken at once |

  Difficulty level is `floor(score / 10)`:

  | Quantity | Formula |
  |---|---|
  | Ring every | `max(0.9, 1.6 − 0.07·level)` s |
  | Bug every | `max(0.6, 2.2 − 0.15·level)` s |
  | Bug speed | `0.06 + 0.008·level` per s |

- Branch: `feature/sonar-ping`, cut from `main`.

## Review Focus

These are the cases most likely to bite, each with the task that pins it:

1. **A toolbar button has focus and you press Space.** The button acts and no
   game starts. Pinned by Task 2, Step 5.
2. **The palette or the search box has focus.** Space types a space. Pinned by
   Task 2, Step 5.
3. **A real event arrives mid-game.** The game is gone at once, the event is
   listed, and a higher score is kept as best. Pinned by Task 2, Step 5.
4. **The window loses focus mid-game and comes back.** The game is paused while
   away and resumes without a jump. Pinned by Task 1's `MAX_DT` check and
   Task 2, Step 5.
5. **The theme changes or the window resizes mid-game.** The canvas redraws at
   the new size and colours, and stays sharp on Retina. Pinned by Task 2,
   Step 5.

---

### Task 1: The rules

**Files:**
- Create: `src/renderer/src/stream/sonar-ping/rules.ts`
- Check: `$CHECKS/rules.ts`

**Interfaces — Produces:**

```ts
type Bug = { id: number; angle: number; distance: number; speed: number } // distance 0..1 from the core outwards
type Ring = { radius: number }                                             // 0..1
type Zap = { angle: number; distance: number; age: number }                // for the flash
type SonarGame = {
  phase: 'playing' | 'over'
  bugs: Bug[]; rings: Ring[]; zaps: Zap[]
  score: number; lives: number; streak: number
  jammedFor: number; ringIn: number; bugIn: number; nextId: number
}
type Random = () => number // 0 ≤ n < 1

newGame(): SonarGame
step(game: SonarGame, dt: number, random: Random): SonarGame // pure; dt clamped to MAX_DT
ping(game: SonarGame): SonarGame                             // pure
levelOf(score: number): number
```

The constants are exported as well.

**What the functions do:**

- **`step`** moves the game forward by `dt`:
  - grows the rings and drops those past radius 1;
  - spawns rings and bugs on their difficulty timers;
  - moves the bugs inward;
  - for every bug at or inside `CORE`, removes it and takes a life;
  - sets `phase` to `'over'` once `lives` reaches 0;
  - ages the zaps and drops those older than 0.3 s;
  - counts `jammedFor` down.
- **`step` while `over`** returns the game unchanged.
- **`ping`** works out the hits: every bug within `TOLERANCE` of any ring.
  - **Hits:** remove them, add `hits + (hits − 1)` to the score, add one to the
    streak, and add a zap for each.
  - **No hits:** reset the streak to 0 and set `jammedFor = JAM_S`.
  - **While jammed or over:** return the game unchanged.

- [ ] **Step 1: Create the branch.**

  ```bash
  git checkout -b feature/sonar-ping
  ```

  Then set up the workspace and checks runner as in the menu bar plan: esbuild
  bundles each check and node runs it.

- [ ] **Step 2: Write the check `$CHECKS/rules.ts`.**

  ```ts
  const at = (distance: number, id = distance * 1000): Bug => ({ id, angle: 0, distance, speed: 0 })
  const g0 = newGame()
  assert.deepEqual([g0.phase, g0.lives, g0.score, g0.bugs.length], ['playing', 3, 0, 0])

  // a bug on a ring is zapped
  let g = { ...g0, rings: [{ radius: 0.5 }], bugs: [at(0.51)] }
  g = ping(g)
  assert.deepEqual([g.bugs.length, g.score, g.streak, g.zaps.length], [0, 1, 1, 1])

  // two at once score a bonus
  g = ping({ ...g0, rings: [{ radius: 0.5 }, { radius: 0.8 }], bugs: [at(0.5), at(0.79)] })
  assert.equal(g.score, 3)

  // a miss jams Space
  g = ping({ ...g0, streak: 4, rings: [{ radius: 0.5 }], bugs: [at(0.9)] })
  assert.deepEqual([g.streak, g.jammedFor > 0], [0, true])
  const jammed = ping({ ...g, bugs: [at(0.5)] })
  assert.equal(jammed.score, g.score)

  // a bug that reaches the core costs a life; the last life ends the game
  g = step({ ...g0, lives: 1, bugs: [{ ...at(CORE + 0.001), speed: 1 }] }, 0.01, () => 0.5)
  assert.deepEqual([g.lives, g.bugs.length, g.phase], [0, 0, 'over'])
  assert.deepEqual(step(g, 0.05, () => 0.5), g) // over stays over

  // dt is clamped: a long pause does not jump a bug to the core
  g = step({ ...g0, ringIn: 99, bugIn: 99, bugs: [{ ...at(0.9), speed: 0.1 }] }, 10, () => 0.5)
  assert.ok(Math.abs(g.bugs[0].distance - (0.9 - 0.1 * MAX_DT)) < 1e-9)

  // things spawn, and faster bugs at a higher level
  let s = newGame(); for (let i = 0; i < 100; i++) s = step(s, 0.05, () => 0.5)
  assert.ok(s.rings.length > 0 && s.bugs.length > 0)
  let h = { ...newGame(), score: 50 }; for (let i = 0; i < 100; i++) h = step(h, 0.05, () => 0.5)
  assert.ok(h.bugs[0].speed > s.bugs[0].speed)
  ```

- [ ] **Step 3: Run it.** Run `check rules`. Expected: it fails to bundle,
  because the module does not exist yet.

- [ ] **Step 4: Implement `rules.ts`.** Run `check rules`. Expected: `ok`.

- [ ] **Step 5: Commit.** Message: `feat: the rules of a small sonar game`.

### Task 2: The game on screen

**Files:**

| Action | Path | What changes |
|---|---|---|
| Create | `src/renderer/src/stream/sonar-ping/draw.ts` | |
| Create | `src/renderer/src/stream/sonar-ping/sonar-ping.tsx` | |
| Create | `src/renderer/src/stream/sonar-ping/use-space-to-play.ts` | |
| Modify | `src/renderer/src/stream/empty-state.tsx` | Playing state, `best` and `onBest` props |
| Modify | `src/renderer/src/use-settings.ts` | `sonarBest: number`, default 0, next to `changelogSeen` |
| Modify | `src/renderer/src/app.tsx` | Pass `best` and `onBest` to `EmptyState` |
| Modify | `src/renderer/src/app.css` | `.sonar-ping` styles |

**Interfaces:**

- **Consumes:** Task 1's `newGame`, `step`, `ping` and `SonarGame`.
- **Produces:**
  - `type GameColors = { ring: string; bug: string; text: string }`
  - `readColors(element: Element): GameColors`
  - `drawGame(ctx: CanvasRenderingContext2D, game: SonarGame, size: { width: number; height: number }, colors: GameColors): void`.
    It draws in CSS pixels, and the caller has applied the DPR transform.
  - `useSpaceToPlay(onSpace: () => void): void`. It ignores repeats, and
    anything while `document.activeElement` is not `document.body` or null.
  - `SonarPing({ best, onBest, onQuit }: { best: number; onBest: (score: number) => void; onQuit: () => void })`
  - `EmptyState({ target, best, onBest })`

Steps:

- [ ] **Step 1: Implement `readColors` and `drawGame`.**
  - The play-area radius is `min(width, height) / 2 − 16`.
  - Rings are circles with an alpha that fades as `radius → 1`.
  - Bugs are small error-coloured glyphs, drawn at `(angle, distance · radius)`.
  - Zaps are rings that expand and fade.
  - The core is a dot.

- [ ] **Step 2: Implement `SonarPing`.**

  **Mount:**
  - Focus the wrapper, which has `tabIndex={-1}`.
  - Start from `newGame()`.

  **Each animation frame:**
  - Call `step` with the real `dt` and `Math.random`, unless paused.
  - Then draw.

  **Keys on the wrapper:**
  - **Space** calls `ping` while playing, and `newGame` when over. Always
    `preventDefault`.
  - **Escape** calls `onQuit`.

  **Window `blur` / `focus`:** pause and resume. Show `Paused` in the HUD while
  paused.

  **Size:**
  - Use a `ResizeObserver` on the wrapper.
  - Size the canvas to `width · devicePixelRatio`, then apply
    `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
  - Re-read the colours on resize and whenever `data-app` changes. A
    `MutationObserver` on the closest `[data-app]` covers the latter.

  **HUD:** an HTML overlay showing `score {n} · best {m}` and the lives. When
  over, show a centred card:

  ```
  Game over · {score}
  space to play again · esc to stop
  ```

  **Best score:** when `phase` turns `'over'` with `score > best`, call
  `onBest(score)`. On unmount, if the live score beats `best`, call
  `onBest(score)` too, through a ref.

- [ ] **Step 3: Wire it up.**

  **`useSpaceToPlay`:** a window `keydown` listener.

  **`EmptyState`:**
  - Holds `playing`. `useSpaceToPlay(() => setPlaying(true))` runs only while
    not playing.
  - While playing, it renders `<SonarPing best={best} onBest={onBest} onQuit={() => setPlaying(false)} />`
    filling `.empty` in place of `.empty__inner`.

  **`app.tsx`:** pass `best={settings.sonarBest}` and
  `onBest={(score) => setSetting('sonarBest', score)}`.

  **`use-settings.ts`:** add `sonarBest` to the type, with default `0`, and
  read it as a non-negative integer, as the other numbers are read.

- [ ] **Step 4: Typecheck and build.**

  ```bash
  npm run typecheck && npm run build
  ```

  Expected: exit 0.

- [ ] **Step 5: Check it in dev.** Run `RAY_PORT=23518 npx electron-vite dev --remoteDebuggingPort 9233`.
  Drive it with CDP `Input.dispatchKeyEvent` for Space and Escape, then take a
  screenshot after each step.
  1. Empty Stream, body focused, Space. Expected: the game appears, rings
     grow and bugs crawl in.
  2. Several Space presses. Expected: the score goes up when a bug is on a
     ring, and a miss jams Space.
  3. Let three bugs reach the core. Expected: `Game over · n`. Space plays
     again.
  4. Escape. Expected: back to the waiting screen.
  5. Focus the search box and press Space. Expected: no game. Do the same with
     the palette open.
  6. Focus a toolbar button and press Space. Expected: the button acts and no
     game starts.
  7. Mid-game, post a `log` payload with curl. Expected: the game is gone and
     the row is listed. Then clear the stream, start a game and check the
     best score is the higher one.
  8. Activate Finder mid-game. Expected: `Paused`. Come back. Expected: it
     resumes without a jump.
  9. Switch the theme with the palette's "Switch to light" and resize the
     window. Expected: the colours and the size follow, and the game stays
     sharp.

- [ ] **Step 6: Commit.** Message: `feat: press space on an empty stream`.

### Task 3: The one hint

**Files:**
- Modify: `src/renderer/src/stream/waiting.ts` and `src/renderer/src/stream/empty-state.tsx`
- Check: `$CHECKS/waiting.ts`

**Interfaces — Produces:** `Waiting` gains `hint?: string`. `EmptyState`
renders it under the body, in `.empty__hint`.

**Ruling.** The spec calls the 30-minute stage "the longest-wait message",
but there is a 60-minute stage after it. The hint goes on every stage from
30 minutes on, so the people who wait longest keep it.

- [ ] **Step 1: Write the check `$CHECKS/waiting.ts`.**

  ```ts
  assert.equal(waitingMessage(0).hint, undefined)
  assert.equal(waitingMessage(29 * 60_000).hint, undefined)
  assert.equal(waitingMessage(30 * 60_000).hint, 'Psst. Press space.')
  assert.equal(waitingMessage(90 * 60_000).hint, 'Psst. Press space.')
  ```

  Run `check waiting`. Expected: it fails, because `hint` is undefined at 30
  minutes.

- [ ] **Step 2: Add the hint to the 30- and 60-minute stages, and render it.**
  Run `check waiting`. Expected: `ok`. Then run
  `npm run typecheck && npm run build`. Expected: exit 0.

- [ ] **Step 3: Commit.** Message: `feat: the longest waits get a hint`.
