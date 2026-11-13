# Menu bar at a glance — design

The menu bar icon from 2.3.0 shows *that* something arrived: it pulses. This
round makes it show more, and lets you do a few things from it:

- **how much** arrived while you were not looking,
- **whether something went wrong**,
- **whether the stream is paused**,
- **what the last HTTP request did**.

It also lets you pause, clear and update the app without bringing the window
forward.

## Intent

NetOS Debug sits behind other windows while you work. The menu bar icon is
there to scan quickly while the app is out of view (see
`2026-11-13-menu-bar-icon-design.md`). Today a glance tells you only that
something happened, and the controls you reach for most still need the main
window:

- pausing a stream that floods,
- clearing it,
- installing an update.

Success means all of the following, with the main window hidden or behind
other apps:

- The icon carries a number for what arrived since you last looked, and the
  number turns red when an exception is among it.
- Pausing from the menu bar silences the app until you resume: no pulse, no
  banners, and the window does not jump forward. Nothing is lost; the number
  keeps counting.
- The panel shows the last request's method, path, status, duration and query
  count. A click opens Requests on it, even if the window was closed meanwhile.
- When an update exists, the right-click menu offers it, from download through
  restart.

This covers ideas 1–4, 9 and 13 from the brainstorm:

| # | Idea |
|---|---|
| 1 | Count of unseen events next to the icon |
| 2 | Error state: the count turns red when an exception is unseen |
| 3 | Paused state: the icon dims while the stream is paused |
| 4 | The last request at the top of the panel |
| 9 | Pause / Resume and Clear Stream in the right-click menu |
| 13 | The update, from download to restart, in the right-click menu |

## Goals, non-goals, anti-goals

**Goals:** the six items above, each working while the main window is hidden
or closed.

**Non-goals (this round):**

- Hiding the Dock icon.
- A global shortcut for the panel.
- Filters in the panel.
- MCP status in the panel.
- Expanding a row in the panel.
- Opening an event in the editor from the panel.
- The "Open…" submenu.
- Muting notifications for an hour.
- Pausing what MCP clients read.
- Keeping the pause across launches.
- Filling the HTTP view from the log the way Requests will be.

**Anti-goals:**

- **A menu bar that never sits still.** A counter is fine, but nothing may
  blink beyond the existing pulse.
- **A count that never returns to zero, or one you cannot explain.** It counts
  exactly what the stream would list, and it goes away when you look.
- **A pause that loses events.** Everything that arrives while paused is shown
  on resume, as today.
- **A count that disagrees with the stream.** Requests, outgoing calls and
  annotations never count, because the stream does not list them.

## Approaches considered

| Question | Considered | Chosen |
|---|---|---|
| How the count and the error show | (a) Text next to the icon through `tray.setTitle`, red through an ANSI colour code. (b) A red dot drawn into the icon image. | **(a).** The icon stays a template image, so macOS keeps tinting it for light, dark and wallpaper-tinted menu bars. (b) needs a non-template image with light and dark variants, which does not follow the menu bar's tint. |
| What pausing from the menu bar silences | (A) Only the lists, as today: pulse and banners carry on. (B) Everything that interrupts: also no pulse, no banners, no "Focus on errors". | **(B)**, Rick's pick. You pause from the menu bar because you are busy with something else, which is exactly when a banner is unwelcome. |
| Who owns the pause | (a) The main process. (b) The window, relaying to main. | **(a).** The menu, the panel and the icon all need it while the window may be closed. Today it is a `useState` in `app.tsx`, which dies with the window. |
| How the paused icon looks | (a) The existing 30% image (`tray-30Template`). (b) The mark with a pause glyph drawn in. | **(a).** No new artwork, and a dimmed icon reads as "inactive". (b) can follow later if the dim turns out too subtle. |

## Design

### Pause moves to the main process

**State.** A `StreamPause` in main holds:

- `paused: boolean`,
- `since: number | null`: when the pause began, in epoch ms.

It is not persisted, so every launch starts running.

**Who sets it.** Three places can set it, all through one IPC call,
`ray:pause:set`:

- the main window's toolbar button,
- the command palette's "Pause the stream",
- the menu bar menu.

**One pause, wherever it was started.** A pause from the window silences the
app just like one from the menu bar. This costs little:

- While you look at the window, banners are suppressed anyway, because the
  notifier skips them when the window has focus.
- "Focus on errors" would only bring forward a window that is already in
  front.

The difference only shows once you switch away while paused, and then
silence is what "paused" should mean. The changelog says so, because it
changes what the existing Pause button does.

**How windows learn it.** Main broadcasts `{ paused, since }` to every stream
window: the main window and the panel. A window reads the current value on
mount.

**While paused:**

- **Lists:** both the main window's stream and the panel's list keep new
  events aside as pending, and show them on resume. This is today's
  `useRayEvents` behaviour; `paused` now comes from main.
- **Pulse:** the icon does not pulse.
- **Banners:** main drops them. Its `ray:notify` handler ignores the call.
- **"Focus on errors":** main drops it too. Its `ray:attention` handler ignores
  the call.
- **Nothing is replayed on resume.**
- **Icon:** shows the dimmed image (see below).
- **Count:** keeps counting (see below).
- **Log, MCP and the local API:** carry on exactly as now.
- **Panel status line:** says the stream is paused and how many events are
  waiting. The exact wording is left to the builder.

**A window that opens while paused.** This is the panel's first open, or a
reopened main window. Snapshot events with `receivedAt > since` go into pending,
not into the list. The window then shows the same thing it would have shown had
it been open all along.

**Clearing while paused** also empties pending, as it does today.

### Count of unseen events (1) and the error state (2)

**Display:**

- The number sits next to the icon through `tray.setTitle`, with
  `fontType: 'monospacedDigit'`.
- An empty title at 0 leaves the bare icon.
- Above 99 it reads `99+`.

**What counts:** stream entries only (`isStreamEntry`), one per payload. A row
shown as ×3 in the stream counts 3. Requests, outgoing calls, annotations and
`clear_all` never count.

**When it counts.** An arriving stream entry adds to the count when nobody is
looking, or while the stream is paused. *Looking* means one of:

- the panel is visible,
- the main window has focus.

**When it resets to 0:**

- The panel opens, or the main window gains focus, and the stream is not
  paused.
- The stream resumes while someone is looking.
- The stream is cleared from anywhere: Cmd-K, the menu, the palette, or a
  `clear_all` payload.

**Error state:**

- When any counted event has type `exception`, the title is red, through the
  ANSI code `\x1b[31m…\x1b[0m`.
- It resets together with the count.
- Exceptions only, the same rule as "Focus on errors". A 5xx request is not a
  stream event, so it does not turn the count red.

**Settings.** The count and the error state appear regardless of the
notification settings. They hide only with the icon itself ("Show in menu
bar").

**Risk.** Electron's typings say `setTitle` supports ANSI colours. Verify this
first, in a throwaway spike. If the red does not render, prefix the count with
`!` instead, uncoloured, and tell Rick.

### Paused icon (3)

- While paused, the resting image is the existing `tray-30Template` image and
  no pulse plays.
- On resume the normal image comes back.

### Last request in the panel (4)

**What it shows.** One line between the status line and the event list:

```
GET  /orders/42            200 · 143 ms · 12 queries  [N+1]
```

- Method and status are coloured the way the Requests list colours them
  (`request-colors.ts`).
- The duration turns red at or above the "slow request" setting
  (`slowRequestMs`).
- The N+1 badge shows when `hasNPlusOne` says so.
- Parsing goes through `toHttpRequest`. The panel does not parse requests
  itself.

**Which request:** the newest `netos_request` that is not an OPTIONS preflight
(`isPreflight`).

**When it is hidden:**

- "Collect requests" is off. The panel reads the setting the way it reads its
  other preferences.
- No request has arrived yet.

**Pause.** The line keeps updating while the stream is paused. It is not part
of the stream, and you only see it when you open the panel.

**Click.** The panel hides, and the main window comes forward on Requests with
that request selected. This uses a new window intent,
`{ kind: 'select-request'; id }`, where `id` is the request's own id, the same
one `toHttpRequest` reads.

**What this needs elsewhere.** Without these, the click lands on nothing:

- **Requests fill from the log** when the main window opens. The stream got the
  same treatment in 2.3.0. Main gains `ray:requests:snapshot`, which returns
  the logged `netos_request` events oldest first. `useRequests` merges them by
  id and keeps at most `requestBuffer` of them. The panel uses the same call to
  find its last request.
- **"Collect requests" off drops requests in main.**
  - What happens: `onRequest` no longer logs `netos_request` payloads while the
    setting is off. They are not sent to windows either.
  - Why: the setting's hint already promises "drops them on arrival". Once
    Requests fill from the log, requests logged while collecting was off would
    come back after it is switched on again, and the renderer cannot tell those
    apart.
  - What it means for MCP: clients can no longer fetch requests that arrived
    while collecting was off. That is intended, and the changelog says so.
  - `MainSettings` gains `collectRequests`, default true.
- **Requests get a log limit of their own,** read per record from
  `requestBuffer`. Today they share 500 slots with outgoing calls, and a busy
  page that calls out a lot would push them out of what a reopened window gets
  back. This is the 2.3.0 reasoning applied once more. Outgoing calls keep the
  existing limit of 500.
- **Clearing requests goes through main.** The Requests view's Clear sends
  `ray:requests:clear`. Main drops the logged requests and broadcasts
  `ray:requests:cleared`, so a reopened window does not bring them back and the
  panel's line disappears. Outgoing calls stay in the log, untouched.

### Right-click menu (9, 13)

```
Open NetOS Debug
Settings…
─────────────
Pause Stream            (Resume Stream while paused)
Clear Stream
─────────────
Download NetOS Debug 2.4.0…    ← only while an update exists, see below
─────────────
Quit NetOS Debug
```

**Clear Stream** does what Cmd-K does: `log.clearStream()`, then broadcast
`ray:stream:cleared`. Windows empty their list and their pending events, and
the count resets.

**The update item** follows the updater's phase:

| Phase | Item | Action |
|---|---|---|
| `available` | Download NetOS Debug 2.4.0… | Starts the download |
| `downloading` | Downloading 2.4.0… 42% | None (disabled) |
| `ready` | Restart to Install 2.4.0 | `updater.install()` |
| `idle`, `checking`, `up-to-date`, `error` | No item, and no separator | — |

**Building the menu.** The menu is built afresh on every right-click, from
the current pause and from `updater.current()`:

- The download percentage is always current.
- Neither the pause nor the updater has to tell the tray about changes.
- A menu that is already open does not change under you. That is how macOS
  menus behave.

The update banner in the main window stays as it is.

## Constraints

- **Code style:** one thing per file, with dependencies injected (Rick's house
  rules). New main-process state lives in classes of its own, for example
  `StreamPause` and an unseen counter, not in `index.ts`.
- **Verification:** there is no test framework. Verification is typecheck, the
  build, and focused node/Electron scripts for the logic, as in 2.3.0.
  Hands-on checks are batched for Rick: clicking the icon, panel and menu, the
  red count, and the dim.
- **Dev runs:** use `RAY_PORT=23518`. The installed NetOS Debug holds 23517.
- **Changelog:** a `changelog/2.4.0.md`. The version is bumped at release time,
  not before.

## Left to the builder

- File and class names, and how `MenuBar` exposes the count and the paused
  image.
- Where the panel lands when it opens. Opening the panel resets the count,
  which shrinks the title and moves the icon. Reset first and read the icon's
  bounds after that, then check by eye that the panel sits under the icon.
- The edge of a pause. An event with `receivedAt` equal to `since` counts as
  pending.
- A request opened from the panel while Requests has a search or filter
  active. Follow the 2.3.0 rule for events: filters stay as they are. The
  detail opens anyway, because the selection is looked up in all requests.
- The wording of the paused status line and the menu labels' exact casing,
  within the style above.
- The layout and CSS of the last-request line, within the panel's existing
  look.
- Whether the last-request line shows a time, and in which form.
