# Menu bar at a glance — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The menu bar icon gains six things:

- a count of unseen stream events, red when an exception is among them;
- a dimmed icon while the stream is paused;
- one app-wide pause that silences the pulse, banners and "Focus on errors";
- the last request at the top of the panel;
- Pause / Resume and Clear Stream in the right-click menu;
- the update in the right-click menu, from download to restart.

**Architecture:**

- **Pause** moves from a `useState` in `app.tsx` to a `StreamPause` in the main
  process. Main broadcasts it to the main window and the panel, the same way it
  broadcasts status.
- **The count** is an `UnseenCount` in main. It is told when stream events
  arrive, when someone looks, when the stream resumes and when it is cleared,
  and it pushes a title to the tray.
- **Requests** get a bucket of their own in `EventLog`. Windows fill from it, as
  the stream has since 2.3.0, and clearing requests goes through main.
- **The tray menu** is a pure template built on every right-click.

**Tech stack:** Electron 44, electron-vite 5, React 19, TypeScript. There is no
test framework: checks are esbuild-bundled node scripts outside the repo, plus
`npm run typecheck && npm run build`, plus hands-on checks batched for Rick.

**Spec:** `docs/superpowers/specs/2026-11-13-menu-bar-glance-design.md`

## Global Constraints

**Code**
- One thing per file, with dependencies injected through constructor options.
  New main-process state goes in a class of its own; `index.ts` only wires it.
- Pure logic lives in files with no runtime `electron` import (`import type` is
  fine), so the checks can bundle it.
  - `tray-menu-template.ts` holds the template.
  - `tray-menu.ts` calls `Menu.buildFromTemplate`.

**Copy**
- Menu labels, exactly:
  - `Open NetOS Debug`
  - `Settings…`
  - `Pause Stream` / `Resume Stream`
  - `Clear Stream`
  - `Download NetOS Debug {version}…`
  - `Downloading {version}… {percent}%` (disabled)
  - `Restart to Install {version}`
  - `Quit NetOS Debug`
- Panel status while paused: `Paused · {n} waiting`, or `Paused` when nothing
  is waiting. A receiver that is not listening still wins over the pause line.

**The count's title**
- `''` at 0, `'99+'` above 99, otherwise the number.
- Wrapped in `\x1b[31m` … `\x1b[0m` when an exception is among the counted
  events. If the ANSI spike in Task 2 fails, the wrapper becomes a `!` prefix
  instead.
- Set with `{ fontType: 'monospacedDigit' }`.

**Rules from the spec**
- Only `isStreamEntry` events count. Requests, outgoing calls, annotations and
  `clear_all` never count.
- An event with `receivedAt >= since` counts as having arrived during the pause.
- Defaults:
  - `collectRequests`: true
  - `requestBuffer`: 100, an integer ≥ 1, falling back to 100
  - `slowRequestMs`: 200
  - outgoing calls keep a log cap of 500

**Process**
- Dev runs use `RAY_PORT=23518 npm run dev`, because the installed NetOS Debug
  holds 23517. The curl lines below use 23518.
- Work on branch `feature/menu-bar-glance`, in the main checkout.
- Never commit `Certificates.p12`, `p12_password.txt`, `developerID_application.cer`
  or `.env`.
- No version bump. Add `changelog/2.4.0.md` instead.

**Running checks:** checks live in `$CHECKS`, a scratch directory outside the
repo, and import the source by absolute path
(`/Users/rickbongers/Code/NetOS-ray/src/...`). Each one ends with
`console.log('ok')`. Run a check with:

```bash
check() { npx esbuild "$CHECKS/$1.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$CHECKS/out/$1.mjs" && node "$CHECKS/out/$1.mjs"; }
```

Expected output: `ok`.

## Review Focus

Most likely to bite first:

1. **The icon is switched on in Settings while the stream is paused or has a
   count.** The new icon should show the dim and the number at once. Owned by
   Task 3, Step 4.
2. **The stream is cleared while paused**, by Cmd-K, the menu or a `clear_all`
   payload. Pending should empty, the count should go to 0, and the toolbar
   should read `Resume` with no number. Owned by Task 2's check and Task 4,
   Step 5.
3. **The main window is closed and reopened while paused.** Events from before
   the pause should be in the list, and the ones since should be pending, shown
   as `Resume (n)`. Owned by Task 1's check and Task 1, Step 7.
4. **"Collect requests" is switched off, then on.** No request from the off
   period should show anywhere: not in Requests, not in the panel, not over
   MCP. Owned by Task 5, Step 6.
5. **The panel is opened while a count shows.** After the title clears, the
   panel should still sit under the icon. Owned by Task 2, Step 6.

---

### Task 1: The pause lives in the main process

**Files:**

| Action | Path | What changes |
|---|---|---|
| Create | `src/shared/pause-state.ts` | |
| Create | `src/main/stream-pause.ts` | |
| Create | `src/renderer/src/use-stream-pause.ts` | |
| Create | `src/renderer/src/split-at-pause.ts` | |
| Modify | `src/main/index.ts` | IPC, broadcast, silence `ray:notify` and `ray:attention` |
| Modify | `src/preload/index.ts` | |
| Modify | `src/renderer/src/use-ray-events.ts` | Hydrate around the pause |
| Modify | `src/renderer/src/app.tsx` | Toolbar and palette use main's pause |
| Modify | `src/renderer/src/tray/tray-panel.tsx`, `src/renderer/src/tray/tray-status.tsx` | The panel follows the pause and shows the pause line |
| Check | `$CHECKS/pause.ts` | |

**Interfaces:**

- **Produces, in shared:**
  - `type PauseState = { paused: boolean; since: number | null }`
- **Produces, in main:**
  - `class StreamPause`
    - `constructor(onChange: (state: PauseState) => void)`
    - `state(): PauseState`
    - `isPaused(): boolean`
    - `set(paused: boolean, now?: number): void`. It calls `onChange` only when
      `paused` actually flips. Pausing twice keeps the first `since`.
- **Produces, in preload:**
  - `getPause(): Promise<PauseState>`, over `ray:pause` (invoke)
  - `onPause(listener: (state: PauseState) => void): () => void`, over
    `ray:pause` (broadcast)
  - `setPaused(paused: boolean): void`, over `ray:pause:set`
- **Produces, in the renderer:**
  - `useStreamPause(): PauseState & { setPaused: (paused: boolean) => void }`
  - `splitAtPause(events: RayEvent[], since: number | null): { shown: RayEvent[]; pending: RayEvent[] }`

Steps:

- [ ] **Step 1: Create the branch.**

  ```bash
  git checkout -b feature/menu-bar-glance
  ```

- [ ] **Step 2: Write the check `$CHECKS/pause.ts`.**

  ```ts
  const changes: PauseState[] = []
  const pause = new StreamPause((s) => changes.push(s))
  pause.set(true, 1000); pause.set(true, 2000)
  assert.deepEqual(pause.state(), { paused: true, since: 1000 })
  assert.equal(changes.length, 1)
  pause.set(false, 3000)
  assert.deepEqual(pause.state(), { paused: false, since: null })
  assert.equal(changes.length, 2)

  const at = (id: string, receivedAt: number) => ({ id, receivedAt }) as RayEvent
  const [a, b, c] = [at('a', 900), at('b', 1000), at('c', 1100)]
  assert.deepEqual(splitAtPause([a, b, c], 1000), { shown: [a], pending: [b, c] })
  assert.deepEqual(splitAtPause([a, b, c], null), { shown: [a, b, c], pending: [] })
  ```

- [ ] **Step 3: Run it.** Run `check pause`. Expected: it fails to bundle,
  because the modules do not exist yet.

- [ ] **Step 4: Implement `PauseState`, `StreamPause` and `splitAtPause`.**
  Run `check pause`. Expected: `ok`.

- [ ] **Step 5: Wire it up.**

  **Main (`index.ts`):**
  - Create
    `const pause = new StreamPause((state) => sendToWindows(streamWindows(), 'ray:pause', state))`.
  - Handle `ray:pause` by returning `pause.state()`.
  - On `ray:pause:set`, call `pause.set(paused)`.
  - The `ray:notify` and `ray:attention` handlers return early while
    `pause.isPaused()`.

  **Preload:** add the three methods above.

  **`useStreamPause`:**
  - Reads `getPause()` on mount, then subscribes to `onPause`.
  - Starts at `{ paused: false, since: null }`.

  **`useRayEvents`:**
  - Its snapshot effect awaits
    `Promise.all([getStreamSnapshot(), getPause()])`.
  - It runs the snapshot through `splitAtPause` and merges `shown` into
    `events` and `pending` into `pending`, each with `mergeById`.

  **`app.tsx`:**
  - Replace `useState(false)` for `paused` with `useStreamPause()`.
  - The toolbar's `onTogglePause` and the palette's `pause-stream` call
    `setPaused(!paused)`.

  **Panel:**
  - `tray-panel.tsx` passes `paused` from `useStreamPause()` to `useRayEvents`.
  - It hands `paused` and `pendingCount` to `TrayStatus`.
  - `TrayStatus` takes `{ paused: boolean; pending: number }` and renders the
    pause copy from Global Constraints, with the dot held.

- [ ] **Step 6: Typecheck and build.**

  ```bash
  npm run typecheck && npm run build
  ```

  Expected: exit 0.

- [ ] **Step 7: Hands-on check.** Start `RAY_PORT=23518 npm run dev`, then:
  1. Pause in the window.
  2. Post two `log` payloads with the Task 5 curl line, changing the type to
     `log`.
  3. Open the panel. Expected: `Paused · 2 waiting`, and neither row is listed.
  4. With "Close to background" off, close the main window and reopen it from
     the Dock. Expected: the toolbar reads `Resume (2)`.
  5. Resume. Expected: both rows appear in the window and in the panel.

- [ ] **Step 8: Commit.** Message: `feat: the stream's pause lives in the main process and silences banners`.

### Task 2: The count of unseen events next to the icon

**Files:**

| Action | Path | What changes |
|---|---|---|
| Create | `src/main/tray/unseen-count.ts` | |
| Create | `src/main/tray/tray-title.ts` | |
| Modify | `src/main/tray/menu-bar.ts` | `setTitle`, `bounds`, `onLeftClick` without arguments |
| Modify | `src/main/tray/tray-panel.ts` | `isVisible` |
| Modify | `src/main/index.ts` | Wiring |
| Check | `$CHECKS/unseen.ts` | |

**Interfaces:**

- **Consumes:** `StreamPause.isPaused()` and the `onChange` of `StreamPause`
  from Task 1.
- **Produces:**
  - `type UnseenState = { count: number; error: boolean }`
  - `class UnseenCount`
    - `constructor(options: { isLooking: () => boolean; isPaused: () => boolean; onChange: (state: UnseenState) => void })`
    - `current(): UnseenState`
    - `arrived(events: RayEvent[]): void` adds the `isStreamEntry` events when
      `!isLooking() || isPaused()`. Any `exception` among them sets `error`.
    - `looked(): void` resets, unless paused.
    - `resumed(): void` resets, if someone is looking.
    - `cleared(): void` always resets.
    - `onChange` fires only on an actual change.
  - `trayTitle(state: UnseenState): string`
  - `MenuBar`
    - `setTitle(title: string): void`, using `fontType: 'monospacedDigit'`
    - `bounds(): Rectangle`
    - the `onLeftClick` option becomes `() => void`
  - `TrayPanel.isVisible(): boolean`

Steps:

- [ ] **Step 1: ANSI spike (throwaway).**
  1. Write `$CHECKS/ansi-title.mjs`, an Electron main script. On `whenReady`,
     it creates a `Tray` from `resources/tray/trayTemplate.png` with the template
     flag on, calls `setTitle('\x1b[31m3\x1b[0m 4')`, and quits after 15 s.
  2. Run `npx electron $CHECKS/ansi-title.mjs &`.
  3. After 3 s run `screencapture -x $CHECKS/menubar.png`, then look at the top
     strip of the image.

  Expected: a red `3` and a plain `4` next to the mark. If it is not red, or the
  capture is refused, ask Rick to look. If the red does not render, switch
  `trayTitle` to the `!` fallback from Global Constraints and say so in the
  task report.

- [ ] **Step 2: Write the check `$CHECKS/unseen.ts`.**

  ```ts
  const ev = (type: string) => ({ id: type + Math.random(), type }) as RayEvent
  let looking = false, paused = false
  const unseen = new UnseenCount({ isLooking: () => looking, isPaused: () => paused, onChange: () => {} })
  unseen.arrived([ev('log'), ev('label'), ev('netos_request'), ev('exception'), ev('clear_all')])
  assert.deepEqual(unseen.current(), { count: 2, error: true })
  looking = true; unseen.arrived([ev('log')])
  assert.equal(unseen.current().count, 2)              // seen as it arrives
  unseen.looked()
  assert.deepEqual(unseen.current(), { count: 0, error: false })
  paused = true; unseen.arrived([ev('log')]); unseen.looked()
  assert.equal(unseen.current().count, 1)              // paused: looking does not reset
  paused = false; unseen.resumed()
  assert.equal(unseen.current().count, 0)              // resumed while looking
  looking = false; paused = true; unseen.arrived([ev('log')]); unseen.cleared()
  assert.equal(unseen.current().count, 0)              // a clear while paused resets

  assert.equal(trayTitle({ count: 0, error: false }), '')
  assert.equal(trayTitle({ count: 7, error: false }), '7')
  assert.equal(trayTitle({ count: 100, error: false }), '99+')
  assert.equal(trayTitle({ count: 3, error: true }), '\x1b[31m3\x1b[0m')
  ```

- [ ] **Step 3: Run it.** Run `check unseen`. Expected: it fails to bundle.

- [ ] **Step 4: Implement `UnseenCount` and `trayTitle`.** Run `check unseen`.
  Expected: `ok`.

- [ ] **Step 5: Wire it up in `index.ts`.**

  **The count:**
  - Create `unseen` with:
    - `isLooking: () => panel.isVisible() || (mainWindow !== null && !mainWindow.isDestroyed() && mainWindow.isFocused())`
    - `isPaused: () => pause.isPaused()`
    - `onChange: (state) => menuBar?.setTitle(trayTitle(state))`

  **When it changes:**
  - `onRequest` calls `unseen.arrived(events)` after `log.record`.
  - A `clear_all` and the `ray:stream:clear` handler call `unseen.cleared()`.
  - `createWindow` adds `window.on('focus', () => unseen.looked())`.
  - The `StreamPause` `onChange` also calls `unseen.resumed()` when
    `!state.paused`.

  **The left click:**
  ```ts
  if (!panel.isVisible()) unseen.looked()
  panel.toggle(menuBar.bounds())
  ```
  This resets the title before the bounds are read.

  **A new icon:** `applyMenuBarIcon` calls
  `menuBar.setTitle(trayTitle(unseen.current()))` right after creating it.

- [ ] **Step 6: Typecheck, build and check by hand.**
  1. Run `npm run typecheck && npm run build`. Expected: exit 0.
  2. Start `RAY_PORT=23518 npm run dev`, put another app in front, and post
     three `log` payloads. Expected: `3` next to the icon.
  3. Post an `exception` payload. Expected: a red `4`.
  4. Click the icon. Expected: the number goes away and the panel sits centred
     under the icon.
  5. Post one more payload while the panel is open. Expected: no number.

- [ ] **Step 7: Commit.** Message: `feat: the menu bar icon counts what arrived while you were away`.

### Task 3: The icon dims while paused, and does not pulse

**Files:**

| Action | Path | What changes |
|---|---|---|
| Modify | `src/main/tray/tray-images.ts` | `paused` image |
| Modify | `src/main/tray/menu-bar.ts` | `setPaused`, pulse guard |
| Modify | `src/main/index.ts` | Wiring |

**Interfaces:**

- **Produces:**
  - `TrayImages.paused: NativeImage`, the already-loaded `tray-30` image
  - `MenuBar.setPaused(paused: boolean): void`
    - On pause: stop the pulser and show `paused`.
    - On resume: show `rest`.
    - While paused, `pulse()` does nothing.

Steps:

- [ ] **Step 1: Add `paused` to `TrayImages`.**

- [ ] **Step 2: Add `setPaused` and the guard in `pulse()`.**

- [ ] **Step 3: Wire it up.**
  - The `StreamPause` `onChange` calls `menuBar?.setPaused(state.paused)`.
  - `applyMenuBarIcon` calls `menuBar.setPaused(pause.isPaused())` after
    creating the icon.

- [ ] **Step 4: Typecheck, build and check by hand.**
  1. Run `npm run typecheck && npm run build`. Expected: exit 0.
  2. In dev, pause. Expected: the icon dims.
  3. Post a payload. Expected: no pulse, and the count goes up.
  4. Resume. Expected: full strength again.
  5. While paused, with a count showing, switch "Show in menu bar" off and on
     again. Expected: the icon comes back dimmed, with the count.

- [ ] **Step 5: Commit.** Message: `feat: the menu bar icon dims while the stream is paused`.

### Task 4: Pause, Clear and the update in the right-click menu

**Files:**

| Action | Path | What changes |
|---|---|---|
| Create | `src/main/tray/tray-menu-template.ts` | |
| Modify | `src/main/tray/tray-menu.ts` | Builds from the template |
| Modify | `src/main/tray/menu-bar.ts` | `menu` becomes a factory |
| Modify | `src/main/index.ts` | Extract `clearStream()`, actions |
| Check | `$CHECKS/menu.ts` | |

**Interfaces:**

- **Consumes:** `UpdateStatus`, `Updater.current()`, `.download()` and
  `.install()`, and `StreamPause`.
- **Produces:**
  - `type TrayMenuState = { paused: boolean; update: UpdateStatus }`
  - `type TrayMenuActions = { open; settings; togglePause; clearStream; downloadUpdate; installUpdate; quit }`,
    each `() => void`
  - `trayMenuTemplate(state: TrayMenuState, actions: TrayMenuActions): MenuItemConstructorOptions[]`
  - `buildTrayMenu(state, actions): Menu`
  - `MenuBarOptions.menu: () => Menu`, called on every right-click

Steps:

- [ ] **Step 1: Write the check `$CHECKS/menu.ts`.**

  ```ts
  const calls: string[] = []
  const actions = Object.fromEntries(['open','settings','togglePause','clearStream','downloadUpdate','installUpdate','quit']
    .map((k) => [k, () => calls.push(k)])) as TrayMenuActions
  const st = (phase: UpdateStatus['phase'], percent = 0) => ({ phase, version: '2.4.0', percent, error: null })
  const labels = (s: TrayMenuState) => trayMenuTemplate(s, actions).map((i) => i.type === 'separator' ? '-' : i.label)
  const base = ['Open NetOS Debug', 'Settings…', '-', 'Pause Stream', 'Clear Stream', '-', 'Quit NetOS Debug']
  for (const phase of ['idle', 'checking', 'up-to-date', 'error'] as const)
    assert.deepEqual(labels({ paused: false, update: st(phase) }), base)
  assert.equal(labels({ paused: true, update: st('idle') })[3], 'Resume Stream')
  assert.deepEqual(labels({ paused: false, update: st('available') }).slice(4),
    ['Clear Stream', '-', 'Download NetOS Debug 2.4.0…', '-', 'Quit NetOS Debug'])
  const downloading = trayMenuTemplate({ paused: false, update: st('downloading', 42) }, actions)[6]
  assert.equal(downloading.label, 'Downloading 2.4.0… 42%'); assert.equal(downloading.enabled, false)
  const ready = trayMenuTemplate({ paused: false, update: st('ready') }, actions)[6]
  assert.equal(ready.label, 'Restart to Install 2.4.0')
  ;(ready.click as () => void)()
  ;(trayMenuTemplate({ paused: false, update: st('idle') }, actions)[3].click as () => void)()
  assert.deepEqual(calls, ['installUpdate', 'togglePause'])
  ```

- [ ] **Step 2: Run it.** Run `check menu`. Expected: it fails to bundle.

- [ ] **Step 3: Implement `trayMenuTemplate`.** Then make `buildTrayMenu(state, actions)`
  call `Menu.buildFromTemplate(trayMenuTemplate(state, actions))`. Run
  `check menu`. Expected: `ok`.

- [ ] **Step 4: Wire it up.**
  - `MenuBar` calls `options.menu()` inside its `right-click` handler.
  - In `index.ts`, extract `clearStream()` from the `ray:stream:clear` handler:
    `log.clearStream()`, then broadcast `ray:stream:cleared`, then
    `unseen.cleared()`. The handler and the menu both use it.
  - `menu` is:
    ```ts
    () => buildTrayMenu({ paused: pause.isPaused(), update: updater.current() }, actions)
    ```
  - The actions map to:
    - `togglePause` → `pause.set(!pause.isPaused())`
    - `downloadUpdate` → `updater.download()`
    - `installUpdate` → `updater.install()`

- [ ] **Step 5: Typecheck, build and check by hand.**
  1. Run `npm run typecheck && npm run build`. Expected: exit 0.
  2. In dev, right-click → Pause Stream. Expected: the icon dims and the
     window's toolbar reads `Resume`.
  3. Post two payloads, then right-click → Clear Stream. Expected: the window
     and the panel are empty, the toolbar reads `Resume` with no number, and the
     count is gone.
  4. The update item cannot show in an unpackaged build. It is checked in
     Task 6, Step 4.

- [ ] **Step 6: Commit.** Message: `feat: pause, clear and update from the menu bar`.

### Task 5: Requests come from the main process

**Files:**

| Action | Path | What changes |
|---|---|---|
| Modify | `src/main/settings.ts` | `collectRequests`, `requestBuffer` |
| Modify | `src/main/event-log.ts` | `requests` bucket, `requestsSnapshot`, `clearRequests` |
| Modify | `src/main/index.ts` | Drop requests while collecting is off; IPC |
| Modify | `src/preload/index.ts` | |
| Modify | `src/renderer/src/merge-by-id.ts` | Generic |
| Modify | `src/renderer/src/requests/use-requests.ts` | Hydrate; clear through main |
| Check | `$CHECKS/requests.ts` | |

**Interfaces:**

- **Produces, in main:**
  - `MainSettings.collectRequests: boolean`
  - `MainSettings.requestBuffer: number`
  - `new EventLog({ stream: () => number; requests: () => number })`
  - `EventLog.requestsSnapshot(): RayEvent[]`, oldest first
  - `EventLog.clearRequests(): void`. It also drops the requests' annotations,
    through `dropAnnotationsOf`.
- **Produces, in preload:**
  - `getRequestsSnapshot(): Promise<RayEvent[]>`, over `ray:requests:snapshot`
  - `clearRequests(): void`, over `ray:requests:clear`
  - `onRequestsCleared(listener: () => void): () => void`, over
    `ray:requests:cleared`
- **Produces, in the renderer:**
  - `mergeById<T extends { id: string }>(earlier: T[], later: T[]): T[]`

Steps:

- [ ] **Step 1: Write the check `$CHECKS/requests.ts`.**

  ```ts
  const ev = (type: string, id: string, uuid = id) => ({ id, uuid, type, content: {}, receivedAt: 0 }) as RayEvent
  const log = new EventLog({ stream: () => 500, requests: () => 2 })
  const label = { ...ev('label', 'l2', 'r2'), content: { label: 'x' } }
  log.record([ev('netos_request', 'r1'), ev('netos_request', 'r2'), label, ev('netos_request', 'r3')])
  log.record(Array.from({ length: 600 }, (_, i) => ev('netos_http_client', `c${i}`)))
  log.record([ev('log', 'keep')])
  assert.deepEqual(log.requestsSnapshot().map((e) => e.id), ['r2', 'r3'])   // own cap, calls do not crowd them out
  assert.deepEqual(log.recent(10, 'netos_request').map((e) => e.id), ['r3', 'r2'])
  assert.equal(log.annotationsFor('r2').label, 'x')
  log.clearRequests()
  assert.deepEqual(log.requestsSnapshot(), [])
  assert.equal(log.annotationsFor('r2').label, null)
  assert.equal(log.recent(1000, 'netos_http_client').length, 500)
  assert.equal(log.streamSnapshot().events.length, 1)
  log.record([ev('netos_request', 'r4')]); log.clear()
  assert.deepEqual(log.requestsSnapshot(), [])                              // clear_all empties requests too

  const prefs = (settings: object) => ({ all: () => ({ settings }) }) as unknown as Preferences
  assert.equal(readSettings(prefs({})).collectRequests, true)
  assert.equal(readSettings(prefs({ collectRequests: false })).collectRequests, false)
  assert.equal(readSettings(prefs({})).requestBuffer, 100)
  assert.equal(readSettings(prefs({ requestBuffer: 0 })).requestBuffer, 100)
  ```

- [ ] **Step 2: Run it.** Run `check requests`. Expected: it fails (bundle or
  assertion).

- [ ] **Step 3: Implement the changes to `settings.ts` and `event-log.ts`.**
  - The requests bucket holds `REQUEST_PAYLOAD_TYPE` only. `ownView` keeps the
    rest of `OWN_VIEW` at 500.
  - Eviction from both feeds `dropAnnotationsOf`.
  - Construct the log as
    `new EventLog({ stream: () => readSettings(preferences).eventBuffer, requests: () => readSettings(preferences).requestBuffer })`.

  Run `check requests`. Expected: `ok`.

- [ ] **Step 4: Wire it up.**

  **Main (`index.ts`):**
  - `onRequest` filters out `REQUEST_PAYLOAD_TYPE` events while
    `!readSettings(preferences).collectRequests`, together with the
    ignored-sources filter, before anything is logged or sent.
  - Handle `ray:requests:snapshot` by returning `log.requestsSnapshot()`.
  - On `ray:requests:clear`: call `log.clearRequests()`, then broadcast
    `ray:requests:cleared` to `streamWindows()`.

  **`useRequests`:**
  - On mount, when `collect` is on, fetch `getRequestsSnapshot()`.
  - Map each event's content through `toHttpRequest`, drop the nulls, and
    reverse to newest first.
  - Merge with `setRequests((current) => mergeById(current, fetched).slice(0, max))`.
  - `clear` also calls `window.ray.clearRequests()`.
  - Subscribe to `onRequestsCleared`, which empties the list and the
    selection.

  **`mergeById`:** make it generic. Its existing callers keep working.

- [ ] **Step 5: Typecheck and build.**

  ```bash
  npm run typecheck && npm run build
  ```

  Expected: exit 0.

- [ ] **Step 6: Check by hand.** In dev, with "Close to background" off:
  1. Post a request:
     ```bash
     curl -s -X POST http://127.0.0.1:23518/ -H 'Content-Type: application/json' -d '{"uuid":"q1","payloads":[{"type":"netos_request","content":{"id":"q1","method":"GET","uri":"/orders/42","status":200,"durationMs":143,"queries":[]},"origin":{"file":null,"line_number":null,"hostname":"test"}}],"meta":{}}'
     ```
  2. Close the window, reopen it from the Dock, and open Requests. Expected:
     `GET /orders/42` is listed.
  3. Clear Requests, close the window and reopen it. Expected: Requests is
     empty.
  4. Switch "Collect requests" off and post the request again with id `q2`.
     Switch it on again. Run:
     ```bash
     curl -s 'http://127.0.0.1:23518/api/events?type=netos_request&limit=5'
     ```
     Expected: `{"events":[]}`, and Requests stays empty after a reopen.

- [ ] **Step 7: Commit.** Message: `feat: requests survive a reopened window, and collecting off drops them in main`.

### Task 6: The last request in the panel

**Files:**

| Action | Path | What changes |
|---|---|---|
| Create | `src/renderer/src/tray/latest-request.ts` | |
| Create | `src/renderer/src/tray/use-last-request.ts` | |
| Create | `src/renderer/src/tray/tray-last-request.tsx` | |
| Modify | `src/renderer/src/tray/tray-panel.tsx`, `src/renderer/src/tray/tray.css`, `src/renderer/src/tray/use-panel-preferences.ts` | |
| Modify | `src/shared/window-intent.ts` | |
| Modify | `src/renderer/src/use-window-intents.ts` | |
| Modify | `src/renderer/src/app.tsx` | |
| Modify | `src/main/index.ts` | `tray:open-request` |
| Modify | `src/preload/index.ts` | `openRequestInApp` |
| Create | `changelog/2.4.0.md` | |
| Check | `$CHECKS/latest.ts` | |

**Interfaces:**

- **Consumes:**
  - from Task 5: `getRequestsSnapshot`, `onRequestsCleared`
  - from the existing code: `toHttpRequest`, `isPreflight`, `hasNPlusOne`,
    `methodColor`, `statusColor`, `pathOf`, `formatDuration`
- **Produces:**
  - `latestRequest(events: RayEvent[]): HttpRequest | null` returns the newest
    event that parses and is not a preflight. Events come oldest first.
  - `useLastRequest(collect: boolean): HttpRequest | null`
    - Reads the snapshot on mount.
    - Follows live `netos_request` events.
    - Goes back to `null` on `clear_all` and on requests cleared.
    - Is always `null` when `collect` is off.
  - `TrayLastRequest({ request, slowMs, onOpen }: { request: HttpRequest; slowMs: number; onOpen: (id: string) => void })`
  - `WindowIntent` gains `{ kind: 'select-request'; id: string }`
  - `useWindowIntents` handlers gain `onSelectRequest: (id: string) => void`
  - `PanelPreferences` gains `collectRequests: boolean` (default true) and
    `slowRequestMs: number` (default 200)
  - `openRequestInApp(id: string): void`, over `tray:open-request`

Steps:

- [ ] **Step 1: Write the check `$CHECKS/latest.ts`.**

  ```ts
  const req = (id: string, method: string) => ({ id, type: 'netos_request', content: { id, method, uri: '/x', status: 200 } }) as RayEvent
  assert.equal(latestRequest([req('a', 'GET'), req('b', 'OPTIONS')])?.id, 'a')
  assert.equal(latestRequest([req('a', 'GET'), req('c', 'POST')])?.id, 'c')
  assert.equal(latestRequest([{ id: 'x', type: 'netos_request', content: {} } as RayEvent]), null)
  assert.equal(latestRequest([]), null)
  ```

  Run `check latest`. Expected: it fails to bundle.

- [ ] **Step 2: Implement `latestRequest`.** Run `check latest`. Expected: `ok`.

- [ ] **Step 3: Build the line and the click-through.**

  **`TrayLastRequest`:**
  - Renders one button row with:
    - the method, coloured by `methodColor`
    - `pathOf(uri)`
    - the status, coloured by `statusColor`
    - `formatDuration`, with a red class at or above `slowMs`
    - `{n} queries`
    - an `N+1` badge when `hasNPlusOne`
  - Clicking it calls `onOpen(request.id)`.

  **Panel:**
  - `tray-panel.tsx` renders the line between `TrayStatus` and the list, only
    when `useLastRequest(prefs.collectRequests)` is not null.
  - `onOpen` is `window.ray.openRequestInApp`.

  **Main:** `tray:open-request` calls `panel.hide()`, then `showMainWindow()`,
  then `intents.deliver({ kind: 'select-request', id })`.

  **`app.tsx`:**
  ```ts
  onSelectRequest: (id) => { setView('requests'); requests.setSelectedId(id) }
  ```

  **Changelog:** add `changelog/2.4.0.md`, in the style of `2.3.0.md`, covering:
  - the count and its red;
  - the dimmed icon;
  - Pause and Clear in the menu, including that a pause now also silences
    banners and "Focus on errors", from wherever it is started;
  - the update in the menu;
  - the last request in the panel;
  - Requests surviving a reopened window;
  - "Collect requests" off now dropping requests for MCP too.

- [ ] **Step 4: Verify everything.**
  1. Run `npm run typecheck && npm run build`, then run every check again:
     ```bash
     for c in pause unseen menu requests latest; do check $c; done
     ```
     Expected: exit 0, then `ok` five times.
  2. In dev, post the `q1` request from Task 5, then an `OPTIONS` one with id
     `q3`. Open the panel. Expected: `GET /orders/42 · 200 · 143 ms · 0 queries`.
  3. Click it. Expected: the window opens on Requests, with that request open.
  4. Check the update item in a packaged build that thinks it is older than
     2.3.0:
     1. Run `npm pkg set version=2.2.0 && npm run dist`, then
        `git checkout package.json`.
     2. Start the app with
        `RAY_PORT=23519 "dist/mac-arm64/NetOS Debug.app/Contents/MacOS/NetOS Debug"`.
        Expected: it starts and its tray works.
     3. Right-click. Expected: `Download NetOS Debug 2.3.0…`.
     4. Click it, then right-click again. Expected: `Downloading 2.3.0… n%`,
        disabled.
     5. Once the download finishes, right-click again. Expected:
        `Restart to Install 2.3.0`. Do not click it: the build is unsigned and
        will not install.
     6. Quit the app by its PID.

- [ ] **Step 5: Commit.** Message: `feat: the menu bar panel shows the last request`.
  Then hand Rick the batched hands-on list from Tasks 1–6.
