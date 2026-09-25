# Requests view — implementation plan

Source: the "NetOS Debug Requests" canvas in the NetOS design-system project.

A debugbar-style view of HTTP requests: a list on the left, and per request a set
of collector tabs of which **Queries and Timeline are designed**. The other six tabs carry
the canvas' own placeholder — "This collector gets its own screen in the next
pass" — so they are in scope as tabs with counts, not as screens.

## Scope

The back end is explicitly out of scope for this pass. Nothing collects request
data yet, so the view runs on fixtures. The point of this pass is the UI and the
shape of the data it consumes; wiring a real collector comes later.

That shape matters more than usual here, because it is the thing a later
collector has to satisfy. The types in `src/renderer/src/requests/types.ts` are
therefore written as the contract, and the fixtures are one implementation of it.

## Phases

Each phase leaves the app working and is verifiable on its own.

### 1. Navigation and tokens

- The rail gains a segmented Stream / Requests control, and the app subtitle
  moves next to it.
- `view` in `app.tsx` becomes `'stream' | 'requests' | 'settings'`.
- `tokens.css` gains the variables the canvas introduces, in both themes:
  `--app-accent-fg`, `--sql-kw`, `--sql-str`, `--sql-num`, `--warn-bg`,
  `--warn-fg`, `--warn-line`, `--err-bg`, `--err-fg`, `--ok-fg`,
  `--btn-primary-bg`, `--btn-primary-fg`.
  Note the primary button inverts in dark: white background, navy text.
- The traffic-light gutter stays. The canvas draws the rail starting at 16px
  because it does not know about the frameless window; 84px wins.

Decision: **the settings gear stays in the rail.** The canvas drops it, but the
app has real settings behind it and losing the only way in would be a
regression.

### 2. Request list

- `requests/types.ts`, `requests/fixtures.ts`.
- `requests/request-list.tsx` — search field, the All / Errors / Slow / N+1
  filter pills, and the rows: colour-coded method, uri, status, then time,
  duration, query count and the N+1 badge.
- Filtering and selection live in a `use-requests.ts` hook, mirroring how
  `use-ray-events` owns the stream's state.

Colour rules from the canvas: status is green under 300, grey to 400, amber to
500, red above; method is blue for GET, amber for writes, red for DELETE.

### 3. Request header and tabs

- Method pill, uri, status pill, and the meta row: Route, Action, Middleware,
  Duration, Memory, Time.
- The tab bar with counts, and the placeholder body for the six undesigned tabs.
- **Copy as cURL** is built from the fixture data and works.
- **Replay** cannot work without a collector to replay through. It renders
  disabled with a title saying so, rather than as a button that silently does
  nothing — the Copy payload lesson.

### 4. Queries tab

- Four stat cards: count, time in database with its share of the request,
  duplicates, slow queries.
- The N+1 banner with its "Show duplicates" action, which switches the filter
  and opens the first duplicate.
- Filter pills, sort pills, the "Fill in bindings" toggle and "Copy all as SQL".
- The query rows: index, syntax-highlighted SQL, source, connection, Duplicate
  and Slow badges, duration, and the timeline bar positioned by the query's
  offset into the request.

`requests/sql-tokens.ts` is the one piece here with real logic — it splits SQL
on backticked identifiers, quoted strings, numbers, punctuation and whitespace,
and classifies each token. It also substitutes bindings when the toggle is on.
This project has no test suite by choice; if that ever changes, this function is
the first thing worth covering.

### 5. Expanded query row

- Copy as SQL, Open in editor.
- Bindings as numbered chips.
- The EXPLAIN table, with amber cells for an `ALL` access type and for
  `filesort` in extra.
- The backtrace, application frames highlighted over vendor frames.

## Built

All five phases are in. Two departures from the canvas worth recording:

- The canvas invents an EXPLAIN row when a query has none. This shows "No
  EXPLAIN was captured for this query." instead — fabricated query plans are
  worse than an absent one.
- Duplicates, the N+1 message and the badge counts are derived from the query
  list rather than carried as flags, so a collector will not have to compute
  them.

## Fitting the existing app

The stream keeps its own sidebar; Requests brings a different one. The switch
therefore happens above `app__main`, with each view owning its sidebar and body.

`ConfettiOverlay`, the title rail and the settings view stay where they are.

## What this pass deliberately does not do

- No collector, no correlation of ray payloads into requests. That is the next
  conversation, and it has its own architectural choice to make: stamping a
  request id onto ray payloads, reading Telescope, or a dedicated package.
- No screens for Timeline, Route, Events, Request, Cache or Mail & jobs.
- No Replay.
