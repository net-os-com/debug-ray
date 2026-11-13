# Menu bar icon — design

A NetOS Debug icon in the macOS menu bar. A left click drops a small panel with
the latest stream events and whether the receiver is listening. A right click
opens a short menu. The icon pulses when something arrives.

## Intent

NetOS Debug is usually behind other windows while you work. Today you only find
out what arrived by switching to it, or through a notification banner. The menu
bar icon is for **scanning quickly while the app is out of view**: glance at the
icon, click, see what came in, click again to get back to work.

The panel is for looking, not for working. Anything you want to do with an
event happens in the main window, which a click on the event brings forward.

Success means: with the main window hidden or behind other apps, a `ray()` call
makes the icon pulse once, a click on the icon shows it at the top of the list
within the same second, and a click on that row brings the main window forward
with that event selected in the Stream.

### Decisions taken

| Decision | Choice |
|---|---|
| What the panel lists | Everything the Stream would list, unfiltered (see "Events in the panel") |
| Clicking an event | Brings the main window forward, on the Stream, with that event selected |
| Panel technology | A small window of our own, rendered with the renderer's React code |
| Right-click menu | Open NetOS Debug · Settings… · Quit NetOS Debug |
| "Close" in the request | Means quit the app, receiver included. Labelled "Quit" |
| Cmd-K | Also removes the Stream's events from the main process's log, so the panel and MCP see what the Stream sees |

## Goals

- A menu bar icon that is always there while the app runs.
- Left click toggles the panel. Right click opens the menu.
- The panel shows the receiver status and a scrollable list of the latest
  events, newest first, updating live while open.
- A click on an event opens the main window on that event.
- A short pulse of the icon when new events arrive, once per burst.

## Non-goals

- No detail view, filters, search, copy buttons or "open in editor" in the
  panel. That is the main window's job.
- No setting to hide the icon, no unread counter, no badge text next to the icon.
- No change to the Dock icon or to how the main window closes.
- No refilling of the Requests and HTTP views when the main window is
  recreated. Only the Stream is refilled (see "Clicking an event").
- No Windows or Linux work. The app ships for macOS arm64 only; the code must
  not break elsewhere, but nobody checks the panel's placement there.

## Anti-goals

These would make it a failure even if it technically works:

- **A blinking menu bar.** A request can send a hundred payloads. The icon
  pulses once per burst, never continuously, and is calm when nothing arrives.
- **The panel lying.** It must never show events the Stream has cleared, nor
  miss ones the Stream shows (within the panel's own buffer).
- **Breaking the receiver or quit.** Nothing here may throw on the way out
  (`Object has been destroyed`, see `send-to-window.ts`), and the panel must
  never keep the app alive or block "Quit".

## Approaches considered

1. **A small window of our own under the icon (chosen).** A frameless
   `BrowserWindow` loading a second renderer entry, so rows reuse `eventTitle`,
   `kindFor`, `rayColor` and `relativeTime` and look like the Stream. Scrolls
   500 events comfortably. Costs a second renderer entry, a second window to
   manage and positioning code.
2. **A native macOS menu as the list.** Left click pops up a `Menu` with one
   item per event and the status as a disabled first item. Least code and fully
   native, but no colours or aligned times, a menu of hundreds of items scrolls
   badly, and `eventTitle` would have to move from the renderer to `shared/`.
   Rejected: scanning is exactly what colour and layout help with.
3. **Showing the main window in a compact mode.** Rejected without much
   thought: it is the window you are trying not to have in view.

## Behaviour

### The icon

- A monochrome **template image** (`…Template.png` with an `@2x`), so macOS
  tints it for light and dark menu bars. Derived from the app mark; at 16pt it
  must still read as the mark, simplified if needed.
- Created once the app is ready, after the main window. Tooltip:
  `NetOS Debug`.

### Left click: the panel

```
┌────────────────────────────────────────┐
│ ● Listening on 0.0.0.0:23517           │
├────────────────────────────────────────┤
│ ▌EXC  QueryException: SQLSTATE[23000]… 12s │
│ ▌LOG  "user loaded"                    14s │
│ ▌SQL  select * from `desks` where …  ×3  1m │
│   … scrolls                            │
└────────────────────────────────────────┘
```

- **Toggle:** a click opens it, the next click on the icon closes it. It also
  closes when it loses focus (a click anywhere else) and after a row is clicked.
- **Placement:** horizontally centred under the icon (`tray.getBounds()`),
  directly below the menu bar, clamped inside the work area of the display the
  icon is on. About 380 × 480 points.
- **Window:** frameless, not resizable or movable, hidden from the Dock and
  Cmd-Tab, shown above other windows including full-screen apps (macOS
  `type: 'panel'`), no traffic lights.
- **Header:** a status dot and a line.
  - Listening: green dot, `Listening on <host>:<port>`.
  - Not listening: red dot, `Not listening — <error>` (for example the port is
    taken).
  - It updates live from the same `ray:status` the main window uses.
- **List:** one line per row, newest at the top:
  colour stripe (the `ray()->green()` colour if set, else the kind colour, as in
  `StreamRow`), kind badge, `eventTitle()`, a `×N` pill when identical events
  run together, relative time on the right. Runs of identical events are grouped
  with the Stream's own `groupEvents`.
- **Empty state:** `No events yet` when the list is empty.
- **Theme:** the app's own light/dark theme, read the same way the main window
  reads it, so the panel matches the window rather than the system menu.

### Events in the panel

The panel reads the main process's `EventLog`, not the main window. That way it
works while the main window is hidden or closed.

- It lists the log's Stream events: everything except `OUT_OF_STREAM` (labels
  and colours are annotations; collected requests and outgoing calls have their
  own views). Sources ignored in Settings never reach the log, so they never
  show.
- It ignores the Stream's view filters and its pause. "Everything" means
  everything the receiver kept.
- Label and colour annotations come from `log.annotationsFor(uuid)`.
- While open, it receives new events live, the same way the main window does.
- **The log keeps the Stream's events in a budget of their own.** Today
  `EventLog` keeps the last 500 payloads of *every* type in one list. Its
  comment says that matches the renderer's buffer, but it does not: collected
  requests, outgoing calls and annotations count against the same 500, and the
  window's Stream buffer (`eventBuffer`, default 500, configurable) counts only
  Stream events. A Laravel app that polls or calls out pushes `ray()` events out
  of the log within minutes while the Stream still shows them, and the panel
  would read "No events yet" next to a full Stream. So:
  - Stream events, the Requests/HTTP payloads and annotations each get their
    own cap.
  - The Stream cap follows the `eventBuffer` setting (read through
    `readSettings`, like the other main-process settings), so the panel holds
    what the Stream holds.
  - Annotations live at least as long as the Stream events they decorate.
  - MCP's `list_ray_events` and `get_ray_event` read the same log; they keep
    working and simply see more history than before.
- **Clearing:**
  - A `clear_all` payload already empties the log; the panel empties too.
  - **Cmd-K in the main window today only empties the window's list.** It must
    also remove the Stream's events from the main process's log, so the panel
    stops showing what you just threw away. Only the Stream's events: collected
    requests, outgoing calls and annotations stay, because Cmd-K leaves the
    Requests and HTTP views alone too. The same goes for every other way the
    window clears the Stream (the Clear button, the command palette).
    Consequence: an MCP client (Claude Code) asking for recent Stream events
    afterwards also gets an empty list. That is intended: it should see what
    you see.

### Clicking an event

- Shows and focuses the main window, creating it if it was closed.
- Switches it to the Stream and selects the event by id.
- **A recreated window fills its Stream from the main log.** "Close to
  background" is off by default, so closing the window destroys it while the app
  keeps running in the menu bar. Today a new window starts with an empty Stream,
  because `use-ray-events.ts` only listens for new events; the clicked event
  could then never be selected. On load the window fetches the log's Stream
  events and their label and colour annotations, and merges events that arrive
  meanwhile without duplicates (by id). This also applies when the window is
  reopened from the Dock or the menu, which is the point: it shows what the
  panel shows. At app start the log is empty, so nothing changes there.
- If the event is not in the window's list (filtered out by the Stream's
  filters, waiting behind a pause, or already dropped from a smaller window
  buffer), the window still comes forward on the Stream with nothing selected.
  Filters and pause are left as they are.
- The panel closes.

### Right click: the menu

A native menu shown with `tray.popUpContextMenu()` on `right-click` (not
`setContextMenu`, which on macOS would also take over the left click):

- **Open NetOS Debug** — show and focus the main window, creating it if closed.
- **Settings…** — the same, then switch the window to the Settings view.
- separator
- **Quit NetOS Debug** — `app.quit()`. The existing `before-quit` handler sets
  `quitting`, so "Close to background" does not swallow it.

Labels are in English, like the rest of the app.

### The pulse

- When a stream event (anything that would be listed in the panel) is recorded,
  the icon plays one short pulse: a fade through a few frames of the template
  image at lower opacity and back, roughly 0.8–1 second in total, using
  `tray.setImage()` on a timer. Template images keep their alpha, so the pulse
  works on light and dark menu bars.
- Events arriving during a pulse are absorbed by it. A burst therefore costs one
  pulse; a steady trickle pulses at most about once a second.
- It pulses whether or not the main window is focused.
- Frames are pre-rendered images, not drawn at runtime.

## Constraints and things that bite

- **Keep a reference to the `Tray`.** A `Tray` that is only a local variable gets
  garbage-collected and the icon disappears.
- **`app.on('activate')` counts windows.** It recreates the main window only
  when `BrowserWindow.getAllWindows().length === 0`. Once the panel exists that
  count is never 0, so closing the main window (with "Close to background" off)
  and clicking the Dock icon would call `show()` on a destroyed window. Showing
  the main window has to go through one helper that checks
  `mainWindow === null || mainWindow.isDestroyed()` and recreates it; `activate`,
  the menu, the panel and the notifier's `onActivate` all use it.
- **Every send goes through `sendToWindow`**, for the panel too, so nothing
  throws when a window is gone during quit.
- **Packaging:** `electron-builder.yml` lists `resources/icon.png` explicitly
  under `files`. The tray images must be added there, or the icon works in dev
  and is missing from the release build.
- **Second renderer entry:** `electron.vite.config.ts` needs both `index.html`
  and the panel's HTML as renderer inputs. In dev the panel loads
  `${ELECTRON_RENDERER_URL}/<panel>.html`; packaged it loads the file from
  `out/renderer/`. The panel's HTML keeps the same Content-Security-Policy as
  `index.html`.
- **Preload:** the panel reuses the existing preload rather than getting its own.
  It shows only titles, never payload HTML, and everything it needs is already on
  `window.ray` or is a small addition there.
- **The notifier keeps looking at the main window only.** Its `isFocused`
  checks `mainWindow`; the panel having focus must not suppress banners.
- **"Focus on errors" stays as it is.** With it on, every exception brings the
  main window forward (`requestAttention`, no focus check). With the panel open
  that means the window comes forward and the panel closes because it lost
  focus. That is accepted: the setting is an explicit opt-in to exactly that.
- Project conventions: one responsibility per file, dependencies passed in
  rather than imported as module state, comments that explain why.

## Calls made in writing this up

Not discussed explicitly; chosen here, open to correction:

- The Stream's events get their own budget in the main log, following
  `eventBuffer`.
- A recreated main window fills its Stream from the main log.
- Cmd-K removes only the Stream's events from the main log.
- "Focus on errors" keeps bringing the window forward, even with the panel open.
- The pulse plays whether or not the main window is focused.
- Panel rows are one line each and group identical runs (`×N`), like the Stream.
- The panel follows the app's theme, not the system menu style.

## What's left to the builder

- File and channel names, and how the main-process code is split (for example a
  tray module, a panel window module and a pulse module).
- How the tray template image and pulse frames are produced: extending
  `npm run icon` (`build/icon/render.mjs`) is preferred over hand-drawn files,
  as long as the result reads at 16pt.
- Exact panel size, paddings and number of pulse frames, within the behaviour
  above.
- How the main window receives "select this event" and "show Settings".
- The changelog entry for the release, in the existing `changelog/` and in-app
  changelog format.

## Verification

There is no automated test suite. Done means:

- `npm run typecheck` and `npm run build` pass.
- In `npm run dev`, with the main window hidden: a payload sent with `curl` to
  `localhost:23517` pulses the icon once; a burst of fifty pulses once.
- The panel opens under the icon, lists the event at the top with the right
  title, colour and time, and updates live while open.
- Clicking a row brings the main window forward on that event.
- With "Close to background" off: close the main window, click a row in the
  panel; the window comes back with its Stream filled and the event selected.
- With an app sending collected requests: after a few hundred requests the
  panel still lists the earlier `ray()` events the Stream shows.
- Cmd-K in the window, then opening the panel: empty. The Requests view and
  MCP's request lookups still have their requests.
- Starting a second copy of the app (port taken) shows the red status line.
- Right-click menu: each item does what it says; Quit really quits with "Close
  to background" on.
- With "Close to background" off: close the main window, click the Dock icon,
  the window comes back (the `activate` bite above).
- `npm run dist` once, and the packaged app shows the icon.
