# Menu Bar Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A NetOS Debug icon in the macOS menu bar: left click shows a panel with the receiver status and the latest Stream events, right click shows Open / Settings… / Quit, and the icon pulses once per burst of new events.

**Architecture:** The main process gains a `Tray` (menu bar icon, context menu, pulse) and a small frameless panel window that loads a second renderer entry (`tray.html`). The panel reads the main process's `EventLog`, which first gets a separate budget for Stream events so it holds what the Stream holds. The main window learns to fill its Stream from that log when it opens, to tell main when it clears, and to accept "select this event" / "show Settings" intents.

**Tech Stack:** Electron 44, electron-vite 5, React 19, TypeScript 7, electron-builder 26. No test framework.

**Spec:** `docs/superpowers/specs/2026-11-13-menu-bar-icon-design.md` — read it before starting any task.

## Global Constraints

- There is no test suite and none is added. Every task is verified with `npm run typecheck`, `npm run build`, and the runtime checks it lists. Checks marked **(hands-on)** need someone at the screen; they are collected again in Task 8.
- Work on branch `feat/menu-bar-icon`, created from `main` before Task 1. Never stage `tsconfig.node.tsbuildinfo` or `tsconfig.web.tsbuildinfo`. Commit messages follow the repo's style: `feat: <what it does, in plain words>`.
- One responsibility per file. Dependencies are passed in (constructor options or function arguments), not reached for as module state. Comments explain *why*, in the repo's existing voice.
- Every main → renderer message goes through `sendToWindow` / `sendToWindows` (`src/main/send-to-window.ts`). Never call `webContents.send` directly.
- UI copy, exactly: menu items `Open NetOS Debug`, `Settings…`, `Quit NetOS Debug`; tray tooltip `NetOS Debug`; panel status `Listening on <host>:<port>`, `Not listening — <error>`, `Starting…`; empty panel `No events yet`.
- Panel size 380 × 480. It sits 4px below the bottom of the icon's bounds and keeps at least 8px from the left and right edges of the display's work area.
- Pulse: frames at 75%, 50%, 30%, 30%, 50%, 75% opacity, then back to the resting image, 120ms per frame (840ms total). Events arriving during a pulse do not start another one.
- macOS arm64 is the only shipped target. Code must still load on other platforms: anything macOS-only (`type: 'panel'`) is guarded by `process.platform === 'darwin'`.

## Review Focus

1. **Clicking the icon while the panel is open.** The panel's blur fires before the tray's click, so a naive toggle closes and immediately reopens it. Expected: the click closes it. Check in Task 6.
2. **Main window closed, "Close to background" off.** Clicking a panel row, "Open", "Settings…" or the Dock icon must recreate the window — Stream filled, event selected — and never throw `Object has been destroyed`. Check in Tasks 3 and 7.
3. **Quit while a pulse is running or the panel is open.** The app exits cleanly, with nothing logged as an uncaught exception. Check in Task 5.
4. **A flood.** One request with 200 payloads, or 50 requests in a second, pulses once and the panel stays responsive (identical runs fold into `×N`). Check in Task 7.
5. **Theme changed in the main window while the panel is hidden.** The panel shows the new theme the next time it opens. Check in Task 6.

---

### Task 1: Separate Stream budget in the event log

**Files:**
- Modify: `src/shared/ray-event.ts` (add `StreamSnapshot`, `isStreamEntry`)
- Modify: `src/main/event-log.ts` (buckets, `clearStream`, `streamSnapshot`)
- Modify: `src/main/settings.ts` (add `eventBuffer`)
- Modify: `src/main/index.ts` (construct `EventLog` with the capacity callback)

**Interfaces:**
- Produces, in `src/shared/ray-event.ts`:
  - `type StreamSnapshot = { events: RayEvent[] /* oldest first, never clear_all */; labels: Record<string, string>; colors: Record<string, string> }`
  - `function isStreamEntry(event: RayEvent): boolean` — true when `!OUT_OF_STREAM.has(event.type) && event.type !== 'clear_all'`.
- Produces, on `EventLog` (`src/main/event-log.ts`):
  - `constructor(streamCapacity: () => number)`
  - `record(events: RayEvent[]): void` · `clear(): void` · `clearStream(): void` · `streamSnapshot(): StreamSnapshot`
  - unchanged signatures and meaning: `recent(limit, type?)`, `get(id)`, `lastException()`, `annotationsFor(uuid)`
- Produces, on `MainSettings`: `eventBuffer: number` (fallback `500`; stored value used only when it is an integer ≥ 1).

- [ ] **Step 1: Add `StreamSnapshot` and `isStreamEntry` to `src/shared/ray-event.ts`.**

- [ ] **Step 2: Add `eventBuffer` to `MainSettings`, `FALLBACK` and `readSettings` in `src/main/settings.ts`.**

- [ ] **Step 3: Rework `EventLog` into three buckets.**

  - `stream`: Stream events (`!OUT_OF_STREAM.has(type)`, `clear_all` included so MCP sees it as today), capped at `streamCapacity()` read on every `record`.
  - `ownView`: `OWN_VIEW` types, capped at a new `OWN_VIEW_CAPACITY = 500`.
  - `annotations`: `ANNOTATION_TYPES`. After every trim and every `clearStream()`, keep only annotations whose `uuid` still belongs to an event in `stream` or `ownView`.
  - `clear()` empties all three. `clearStream()` empties `stream` and prunes `annotations`.
  - `recent(limit)` reads `stream` minus annotations as today; `recent(limit, type)` searches all buckets for that type; both newest first. `get(id)` searches all buckets. `lastException()` searches `stream`.
  - `streamSnapshot()` returns `stream.filter(isStreamEntry)` oldest first, plus `labels` and `colors` maps built from `annotations` the way `annotationsFor` resolves them (last one wins).
  - Replace the class comment's "Matches the renderer's buffer" with why the buckets exist (the spec's "Events in the panel" section).

- [ ] **Step 4: In `src/main/index.ts`, construct the log as `new EventLog(() => readSettings(preferences).eventBuffer)`.** `preferences` is assigned in `whenReady`, before the server can record anything; say so in a comment.

- [ ] **Step 5: Typecheck and build.**

  Run: `npm run typecheck && npm run build` — Expected: both exit 0.

- [ ] **Step 6: Runtime check: requests no longer push Stream events out.**

  Start `npm run dev` in the background. Then:

  ```bash
  curl -s -X POST http://127.0.0.1:23517/ -H 'Content-Type: application/json' \
    -d '{"uuid":"keep-me","payloads":[{"type":"log","content":{"values":["survivor"]},"origin":{"file":"/app/a.php","line_number":1,"hostname":"test"}}],"meta":{}}'
  for i in $(seq 1 6); do
    curl -s -X POST http://127.0.0.1:23517/ -H 'Content-Type: application/json' \
      -d "{\"uuid\":\"req-$i\",\"payloads\":[$(for j in $(seq 1 100); do printf '{"type":"netos_request","content":{},"origin":{"file":null,"line_number":null,"hostname":"test"}}'; [ $j -lt 100 ] && printf ','; done)],\"meta\":{}}" > /dev/null
  done
  curl -s 'http://127.0.0.1:23517/api/events?limit=5'
  curl -s 'http://127.0.0.1:23517/api/events?type=netos_request&limit=200' | grep -o '"type":"netos_request"' | wc -l
  ```

  Expected: the first listing still contains the `survivor` log event (before this task, 600 requests pushed it out); the count is `200`.

- [ ] **Step 7: Commit.**

  ```bash
  git add src/shared/ray-event.ts src/main/event-log.ts src/main/settings.ts src/main/index.ts
  git commit -m "feat: requests no longer push stream events out of the log"
  ```

---

### Task 2: The Stream fills from the log and clears it

**Files:**
- Create: `src/renderer/src/merge-by-id.ts`
- Modify: `src/main/index.ts` (two IPC channels, `streamWindows`)
- Modify: `src/main/send-to-window.ts` (add `sendToWindows`)
- Modify: `src/preload/index.ts` (three methods)
- Modify: `src/renderer/src/use-ray-events.ts` (fill on mount, clear through main, follow clears)

**Interfaces:**
- Consumes: `EventLog.streamSnapshot()`, `EventLog.clearStream()`, `StreamSnapshot` (Task 1).
- Produces:
  - `sendToWindows(windows: ReadonlyArray<BrowserWindow | null>, channel: string, ...args: unknown[]): void` in `src/main/send-to-window.ts`.
  - In `index.ts`: `function streamWindows(): Array<BrowserWindow | null>` — returns `[mainWindow]` now; Task 7 adds the panel.
  - IPC: `ray:stream:snapshot` (handle → `StreamSnapshot`), `ray:stream:clear` (send; main calls `log.clearStream()` then `sendToWindows(streamWindows(), 'ray:stream:cleared')`).
  - Preload: `getStreamSnapshot(): Promise<StreamSnapshot>`, `clearStream(): void`, `onStreamCleared(listener: () => void): () => void`.
  - `mergeById(earlier: RayEvent[], later: RayEvent[]): RayEvent[]` — `earlier`, then the events of `later` whose id is not in `earlier`, order kept.

- [ ] **Step 1: Add `sendToWindows` and the two IPC channels in main; switch the existing `ray:event` and `ray:status` sends to `sendToWindows(streamWindows(), …)`.**

- [ ] **Step 2: Add the three preload methods.**

- [ ] **Step 3: Create `mergeById`.**

- [ ] **Step 4: Update `useRayEvents`.**

  - On mount: `getStreamSnapshot()`, then `setEvents(current => mergeById(snapshot.events, current).slice(-maxEvents))`, `setLabels(current => ({ ...snapshot.labels, ...current }))`, same for colours. Snapshot events do not go through `onEvent`, so they never notify.
  - `clear` also calls `window.ray.clearStream()`. Every way the window clears the Stream (Cmd-K, the Clear button, the palette's `clear-stream`) already goes through this `clear`, so nothing else changes.
  - Subscribe to `onStreamCleared`: empty `events` and `pending`.

- [ ] **Step 5: Typecheck and build.**

  Run: `npm run typecheck && npm run build` — Expected: exit 0.

- [ ] **Step 6: Runtime check.**

  With `npm run dev` running, send the `survivor` payload and one `netos_request` from Task 1 Step 6. Reload the window with Cmd-Alt-R **(hands-on)**: the Stream still shows `survivor`, once. Press Cmd-K **(hands-on)**, then:

  ```bash
  curl -s 'http://127.0.0.1:23517/api/events?limit=5'
  curl -s 'http://127.0.0.1:23517/api/events?type=netos_request&limit=5' | grep -c netos_request
  ```

  Expected: `{"events":[]}`, and a count of at least `1`.

- [ ] **Step 7: Commit.**

  ```bash
  git add src/renderer/src/merge-by-id.ts src/main/index.ts src/main/send-to-window.ts src/preload/index.ts src/renderer/src/use-ray-events.ts
  git commit -m "feat: a reopened window keeps its stream, and cmd-k clears it everywhere"
  ```

---

### Task 3: One way to show the main window, and intents for it

**Files:**
- Create: `src/shared/window-intent.ts`
- Create: `src/main/window-intents.ts`
- Create: `src/renderer/src/use-window-intents.ts`
- Modify: `src/main/index.ts` (`showMainWindow`, use it everywhere, intent IPC)
- Modify: `src/preload/index.ts` (two methods)
- Modify: `src/renderer/src/app.tsx` (apply intents)

**Interfaces:**
- Produces:
  - `src/shared/window-intent.ts`: `type WindowIntent = { kind: 'select-event'; id: string } | { kind: 'show-view'; view: 'settings' }`.
  - `src/main/window-intents.ts`: `class WindowIntents { constructor(target: () => BrowserWindow | null); deliver(intent: WindowIntent): void; take(): WindowIntent | null; reset(): void }`.
    - `reset()` is called whenever a main window is created: the new renderer has not mounted yet.
    - `take()` marks the renderer as ready, returns the pending intent (or `null`) and forgets it.
    - `deliver()` sends `ray:intent` through `sendToWindow` when the renderer is ready, otherwise keeps it as the pending intent (the latest wins). This avoids racing a window that is still loading.
  - In `index.ts`: `function showMainWindow(): BrowserWindow` — creates the window when `mainWindow` is `null` or `isDestroyed()`, otherwise shows it; focuses it either way and returns it.
  - IPC: `ray:intent:take` (handle → `WindowIntent | null`). Push channel `ray:intent`.
  - Preload: `takeIntent(): Promise<WindowIntent | null>`, `onIntent(listener: (intent: WindowIntent) => void): () => void`.
  - `useWindowIntents(handlers: { onSelectEvent: (id: string) => void; onShowView: (view: 'settings') => void }): void` — on mount it applies `takeIntent()`'s result, then follows `onIntent`.

- [ ] **Step 1: Create `WindowIntent` and `WindowIntents`.**

- [ ] **Step 2: Add `showMainWindow` and route these callers through it.** The callers are `app.on('activate')` (replacing the `getAllWindows().length` check, which breaks once the panel exists), the notifier's `onActivate`, and `ray:attention`. Call `intents.reset()` inside `createWindow`. Add the `ray:intent:take` handler.

- [ ] **Step 3: Add the preload methods and `useWindowIntents`.** Wire the hook in `App`: `onSelectEvent` → `setView('stream')` and `setSelectedId(id)`; `onShowView` → `setView(view)`. Filters and pause are left untouched.

- [ ] **Step 4: Typecheck and build.**

  Run: `npm run typecheck && npm run build` — Expected: exit 0.

- [ ] **Step 5: Runtime check (hands-on).** In Settings, turn "Close to background" off. Close the window with Cmd-W, then click the Dock icon: the window comes back with its Stream filled, and the terminal running `npm run dev` shows no `Object has been destroyed`.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/shared/window-intent.ts src/main/window-intents.ts src/renderer/src/use-window-intents.ts src/main/index.ts src/preload/index.ts src/renderer/src/app.tsx
  git commit -m "feat: the window can be asked to open on an event or on settings"
  ```

---

### Task 4: Menu bar images

**Files:**
- Create: `build/icon/tray.html`
- Modify: `build/icon/render.mjs`
- Create (generated, committed): `resources/tray/trayTemplate.png`, `trayTemplate@2x.png`, `tray-75Template.png`, `tray-75Template@2x.png`, `tray-50Template.png`, `tray-50Template@2x.png`, `tray-30Template.png`, `tray-30Template@2x.png`
- Create: `src/main/tray/tray-images.ts`
- Modify: `electron-builder.yml` (`files`: add `resources/tray/**`)

**Interfaces:**
- Produces: `type TrayImages = { rest: NativeImage; pulse: NativeImage[] }` and `function loadTrayImages(): TrayImages | null` in `src/main/tray/tray-images.ts`.
  - `pulse` is the 75, 50, 30, 30, 50, 75 sequence from Global Constraints.
  - Every image is passed through `setTemplateImage(true)`.
  - Paths resolve like `app-icon.ts` (`join(import.meta.dirname, '../../resources/tray/…')`); `createFromPath` picks up the `@2x` file beside each one.
  - Returns `null` with a `console.warn` naming `npm run icon` when a file is missing, the same way `app-icon.ts` does.

- [ ] **Step 1: Create `build/icon/tray.html`.** It holds the mark only: the `.bar--flat` paths and the curve path from `icon.html`, with no squircle or badge. Black (`#000`) on transparent, filling the canvas height with a 2px-at-16pt margin. Opacity comes from a `data-opacity` attribute on `body`.

- [ ] **Step 2: Extend `render.mjs`.** After the app icon, render `tray.html` once per opacity (100, 75, 50, 30). Write each at 16 and 32px high, width by aspect ratio, into `resources/tray/` under the names above (100 → `trayTemplate`). Use the existing capture-then-`sips` approach.

- [ ] **Step 3: Run it and look at the result.**

  Run: `npm run icon && sips -g pixelWidth -g pixelHeight resources/tray/*.png`
  Expected: eight files, the `@2x` ones 32px high and the others 16px. Open `trayTemplate@2x.png`: the mark reads as the NetOS Debug mark.

- [ ] **Step 4: Add `tray-images.ts` and the `electron-builder.yml` entry.**

- [ ] **Step 5: Typecheck and build.** Run: `npm run typecheck && npm run build` — Expected: exit 0.

- [ ] **Step 6: Commit.**

  ```bash
  git add build/icon/tray.html build/icon/render.mjs resources/tray src/main/tray/tray-images.ts electron-builder.yml
  git commit -m "feat: menu bar images, rendered from the same mark as the app icon"
  ```

---

### Task 5: The menu bar icon, its menu and the pulse

**Files:**
- Create: `src/main/tray/pulse.ts`
- Create: `src/main/tray/tray-menu.ts`
- Create: `src/main/tray/menu-bar.ts`
- Modify: `src/main/index.ts` (create the icon, pulse on Stream events, stop on quit)

**Interfaces:**
- Consumes: `TrayImages`, `loadTrayImages()` (Task 4); `showMainWindow()`, `WindowIntents.deliver()` (Task 3); `isStreamEntry()` (Task 1).
- Produces:
  - `class Pulse { constructor(options: { frames: NativeImage[]; rest: NativeImage; show: (image: NativeImage) => void; frameMs: number }); play(): void; stop(): void }`.
    - `play()` does nothing while a pulse is running.
    - `stop()` clears the timer and shows `rest`.
  - `type TrayMenuActions = { open: () => void; settings: () => void; quit: () => void }` and `function buildTrayMenu(actions: TrayMenuActions): Menu`, with the items in this order: `Open NetOS Debug`, `Settings…`, separator, `Quit NetOS Debug`.
  - `class MenuBar { constructor(options: { images: TrayImages; menu: Menu; onLeftClick: (bounds: Rectangle) => void }); pulse(): void; stop(): void }`.
    - It owns the `Tray` and a `Pulse` (`frameMs: 120`).
    - `click` → `onLeftClick(tray.getBounds())`; `right-click` → `tray.popUpContextMenu(menu)`. Never `setContextMenu`, which on macOS would take the left click too.
    - Tooltip `NetOS Debug`.

- [ ] **Step 1: Create `Pulse`, `buildTrayMenu` and `MenuBar`.**

- [ ] **Step 2: Wire it into `index.ts`.**

  - Keep `let menuBar: MenuBar | null = null` at module level: a `Tray` held only by a local is garbage-collected and the icon disappears. Say so in a comment.
  - In `whenReady`, after the main window exists, create the icon when `loadTrayImages()` returns images, with these menu actions:
    - `open: () => showMainWindow()`
    - `settings: () => { showMainWindow(); intents.deliver({ kind: 'show-view', view: 'settings' }) }`
    - `quit: () => app.quit()`
  - `onLeftClick` does nothing until Task 6.
  - In `onRequest`, after `log.record(events)`: `if (events.some(isStreamEntry)) menuBar?.pulse()`.
  - In `before-quit`: `menuBar?.stop()`.

- [ ] **Step 3: Typecheck and build.** Run: `npm run typecheck && npm run build` — Expected: exit 0.

- [ ] **Step 4: Runtime check.** With `npm run dev` running:

  - **(hands-on)** The icon is in the menu bar and tinted correctly in light and dark mode.
  - Send one `survivor` payload (Task 1 Step 6): one pulse **(hands-on)**.
  - Send 50 in a row: `for i in $(seq 1 50); do curl -s -X POST …; done` with the same body. Expect one pulse, at most one more if the loop outlasts 840ms **(hands-on)**.
  - Right click **(hands-on)**: each item does what it says. "Settings…" with the window closed recreates it on Settings. "Quit NetOS Debug" quits, with "Close to background" both on and off. Quitting mid-pulse logs nothing in the dev terminal.

- [ ] **Step 5: Commit.**

  ```bash
  git add src/main/tray/pulse.ts src/main/tray/tray-menu.ts src/main/tray/menu-bar.ts src/main/index.ts
  git commit -m "feat: a menu bar icon that pulses when events arrive"
  ```

---

### Task 6: The panel window

**Files:**
- Create: `src/main/renderer-page.ts`
- Create: `src/main/tray/panel-position.ts`
- Create: `src/main/tray/tray-panel.ts`
- Create: `src/renderer/tray.html`
- Create: `src/renderer/src/tray/main.tsx`, `src/renderer/src/tray/tray-panel.tsx`, `src/renderer/src/tray/tray-status.tsx`, `src/renderer/src/tray/use-panel-preferences.ts`, `src/renderer/src/tray/tray.css`
- Modify: `electron.vite.config.ts` (second renderer input)
- Modify: `src/main/index.ts` (use `loadRendererPage` for the main window, create the panel, `tray:hide`)
- Modify: `src/preload/index.ts` (`hideTrayPanel`)

**Interfaces:**
- Consumes: `MenuBar`'s `onLeftClick` (Task 5).
- Produces:
  - `function loadRendererPage(window: BrowserWindow, page: 'index' | 'tray'): void`. Dev: `${ELECTRON_RENDERER_URL}/${page}.html`. Packaged: `loadFile(join(import.meta.dirname, '../renderer/${page}.html'))`. `createWindow` switches to it.
  - `function panelPosition(anchor: Rectangle, size: { width: number; height: number }, workArea: Rectangle): { x: number; y: number }`.
    - Centred under `anchor`, `y = anchor.y + anchor.height + 4`.
    - `x` clamped to `[workArea.x + 8, workArea.x + workArea.width - size.width - 8]`.
  - `class TrayPanel { constructor(options: { preload: string; load: (window: BrowserWindow) => void }); toggle(anchor: Rectangle): void; hide(): void; window(): BrowserWindow | null }`.
    - The window is created on the first `toggle` and then kept, hidden, so it opens instantly and stays in sync.
    - Window options: 380 × 480, `show: false`, `frame: false`, not resizable, movable, minimizable, maximizable or fullscreenable, `skipTaskbar: true`, `alwaysOnTop: true`, and on darwin `type: 'panel'`. Also call `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
    - Placement uses `panelPosition` with `screen.getDisplayMatching(anchor).workArea`.
    - It hides on `blur`.
    - `toggle` ignores an open request within 250ms of a blur-hide. That is the click on the icon that caused the blur, and it must close the panel, not reopen it.
  - IPC `tray:hide` → `panel.hide()`. Preload `hideTrayPanel(): void`.
  - `usePanelPreferences(): { theme: Theme; relativeTime: boolean; eventBuffer: number }`.
    - It reads `window.ray.readPreferences()` on mount and again on every window `focus`. It never writes.
    - It does not use `useTheme` or `useSettings`, which write their state back on mount and would overwrite changes made in the main window.
    - Invalid or missing values fall back to `light`, `true` and `500`.

- [ ] **Step 1: Add the second renderer input.** In `electron.vite.config.ts`, set `renderer.build.rollupOptions.input` to `index.html` and `tray.html` under `src/renderer`. Create `src/renderer/tray.html` with the same Content-Security-Policy as `index.html` and `src/tray/main.tsx` as its script.

- [ ] **Step 2: Create `loadRendererPage` and switch `createWindow` to it.**

- [ ] **Step 3: Create `panelPosition` and `TrayPanel`; wire them in `index.ts`.** Create the `TrayPanel` with the existing preload path. Pass `onLeftClick: (bounds) => panel.toggle(bounds)` to `MenuBar`. Add the `tray:hide` handler.

- [ ] **Step 4: Build the panel shell in the renderer.**

  - `main.tsx` imports `tokens.css`, `app.css` and `tray.css`, then renders `TrayPanel`.
  - The root element carries `data-app={theme}`, so the existing theme tokens and `.badge` styles apply.
  - `TrayStatus` uses `useServerStatus()`. It shows a green dot with `Listening on <host>:<port>`. It shows a red dot with `Not listening — <error>` when `error` is set. It shows `Starting…` while the status is `null` or not yet listening without an error.
  - Escape calls `hideTrayPanel()`.
  - The list area is empty in this task.

- [ ] **Step 5: Typecheck and build.**

  Run: `npm run typecheck && npm run build && ls out/renderer/tray.html` — Expected: exit 0 and the file exists.

- [ ] **Step 6: Runtime check (hands-on).** With `npm run dev` running:

  - Left click: the panel opens centred under the icon with the green status line.
  - Clicking the icon again closes it, without flicker (Review Focus 1).
  - Clicking elsewhere closes it. Escape closes it.
  - It shows over a full-screen app.
  - Switch the theme in the main window, then reopen the panel: it uses the new theme (Review Focus 5).
  - Stop the dev app, run `python3 -m http.server 23517` in the background, and start `npm run dev` again. The panel reads `Not listening — listen EADDRINUSE …`. Stop the Python server afterwards.
  - **If clicking elsewhere does not close the panel with `type: 'panel'`,** drop `type: 'panel'`, keep `setVisibleOnAllWorkspaces(…, { visibleOnFullScreen: true })`, add `setAlwaysOnTop(true, 'pop-up-menu')`, and note the change in the commit message.

- [ ] **Step 7: Commit.**

  ```bash
  git add electron.vite.config.ts src/renderer/tray.html src/renderer/src/tray src/main/renderer-page.ts src/main/tray/panel-position.ts src/main/tray/tray-panel.ts src/main/index.ts src/preload/index.ts
  git commit -m "feat: a panel under the menu bar icon that shows whether the receiver listens"
  ```

---

### Task 7: Events in the panel, and opening one in the app

**Files:**
- Create: `src/renderer/src/clock-time.ts`
- Create: `src/renderer/src/tray/tray-row.tsx`
- Modify: `src/renderer/src/stream/stream-row.tsx` (use `clockTime`)
- Modify: `src/renderer/src/tray/tray-panel.tsx` (the list)
- Modify: `src/renderer/src/tray/tray.css`
- Modify: `src/main/index.ts` (`streamWindows` includes the panel; `tray:open-event`)
- Modify: `src/preload/index.ts` (`openEventInApp`)

**Interfaces:**
- Consumes: `useRayEvents` with its fill and clear behaviour (Task 2); `groupEvents`, `StreamGroup` (`src/renderer/src/stream/group-events.ts`); `kindFor`, `eventTitle`, `rayColor`, `relativeTime`, `useNow`; `usePanelPreferences` (Task 6); `showMainWindow`, `WindowIntents.deliver` (Task 3); `TrayPanel.hide/window` (Task 6).
- Produces:
  - `function clockTime(timestamp: number): string` — `HH:MM:SS`, 24-hour, moved out of `StreamRow`'s private `formatTime`.
  - `TrayRow` props: `{ group: StreamGroup; label: string | undefined; color: string | undefined; relative: boolean; now: number; onOpen: (id: string) => void }`.
  - IPC `tray:open-event` (send, `id: string`) → `panel.hide()`, `showMainWindow()`, `intents.deliver({ kind: 'select-event', id })`.
  - Preload `openEventInApp(id: string): void`.

- [ ] **Step 1: Create `clockTime` and switch `StreamRow` to it.**

- [ ] **Step 2: Return `[mainWindow, panel.window()]` from `streamWindows()`, and add the `tray:open-event` handler and the preload method.**

- [ ] **Step 3: Add the list to `TrayPanel`.**

  - Data comes from `useRayEvents({ paused: false, maxEvents: eventBuffer })`. It already fills from the log, follows clears and `clear_all`, and keeps requests and annotations out. The panel never calls its `clear`.
  - Rows: `groupEvents([...events].reverse(), labels, colors, 'newest')`. The group's `event.id` is what is opened, the same id the Stream's row holds.
  - `TrayRow` is one line: a stripe in `rayColor(color) ?? rgb(kind.dot)`, `.badge` with `kind.label`, `eventTitle(event)`, a `×N` pill when `count > 1`, and on the right `relativeTime(latestAt, now)` or `clockTime(latestAt)`. Long titles truncate with an ellipsis. There is no file link, so a click anywhere on the row is the open.
  - Empty list: `No events yet`. The list scrolls inside the panel; the status header stays put.

- [ ] **Step 4: Typecheck and build.** Run: `npm run typecheck && npm run build` — Expected: exit 0.

- [ ] **Step 5: Runtime check.** With `npm run dev` running:

  - Hide the window, send the `survivor` payload, open the panel **(hands-on)**: `survivor` is at the top with the log colour and `now`.
  - With the panel open, send another: it appears at the top live.
  - Send one request with 200 identical log payloads (build the body as in Task 1 Step 6). There is one pulse, the panel shows one row with `×200`, and it scrolls smoothly (Review Focus 4).
  - Click a row **(hands-on)**: the panel closes and the main window comes forward on the Stream with that row selected and its detail open.
  - Repeat with "Close to background" off after closing the window with Cmd-W: same result (Review Focus 2).
  - Cmd-K in the window, then open the panel: `No events yet`.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/renderer/src/clock-time.ts src/renderer/src/tray src/renderer/src/stream/stream-row.tsx src/main/index.ts src/preload/index.ts
  git commit -m "feat: the panel lists the stream and opens an event in the app"
  ```

---

### Task 8: Changelog and the packaged build

**Files:**
- Create or modify: `changelog/2.3.0.md` (create it with the existing front matter, `title` and `date: 2026-11-13`, if it does not exist yet; otherwise add the items)

- [ ] **Step 1: Write the changelog items.** Write them in the voice of `changelog/2.2.1.md`:

  - The menu bar icon, its panel and the pulse.
  - The reopened window keeping its Stream.
  - Cmd-K clearing what MCP sees.
  - Requests no longer crowding Stream events out of what MCP and the panel can read.

- [ ] **Step 2: Build the release package.**

  Run: `npm run dist` — Expected: exit 0 and a new `dist/NetOS Debug-<version>-arm64.dmg`.

- [ ] **Step 3: Hands-on pass on the packaged app.** Open the `.app` from `dist/mac-arm64/`. The icon shows (this proves `resources/tray/**` is packaged). Then walk the spec's Verification list once more, top to bottom.

- [ ] **Step 4: Commit.**

  ```bash
  git add changelog/2.3.0.md
  git commit -m "docs: changelog for the menu bar icon"
  ```
