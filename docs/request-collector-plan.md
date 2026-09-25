# Request collector — implementation plan

Ship one payload per HTTP request from the NetOS monorepo to NetOS Debug, so the
Requests view runs on real data instead of `requests/fixtures.ts`.

Source: `barryvdh/laravel-debugbar ^4.4`, installed as a dev dependency in
`laravel/server` (commit adding it is on `feature/SOFT-2872`). Transport:
the existing ray channel, with a custom payload type.

**Status: all phases are built and verified against live traffic.** Phase 3
(config) was folded into phase 2 because several of its keys turned out to be
load-bearing. Sections below are corrected where building proved the plan
wrong; those corrections are called out inline.

Everything below was verified against the installed vendor code and against a
live `Debugbar::getData()` dump taken inside the `php` container — not from
the package README.

## What debugbar actually hands us

`Debugbar::getData()` returns one array keyed by collector name. The live dump:

```
__meta, request, php, messages, memory, route, queries, inertia,
symfonymailer_mails, gate, jobs, session, http_client, time, event
```

The three that carry the Requests view:

**`__meta`** — `id` (ULID), `datetime`, `utime`, `method`, `uri`, `ip`.
Under Octane/console the method becomes `CLI`/`JOB`; we only ship real requests.

**`time`** — `start`, `end`, `duration` (seconds, float), plus `measures[]`
with `label`, `start`, `relative_start`, `duration`, `collector`, `group`.
`time.start` is the request's t0, which is what makes `Query.offsetMs`
computable.

**`queries`** — `nb_statements`, `accumulated_duration`, and `statements[]`.
A statement (real dump, transaction entry):

```json
{
  "sql": "select * from users where id = 1",
  "type": "query",
  "params": ["1"],
  "backtrace": [{ "index": 8, "namespace": null, "name": "app/Foo.php", "file": "…", "line": 8 }],
  "start": 1790319427.915325,
  "duration": 0.00042,
  "slow": false,
  "filename": "Foo.php:8",
  "source": { "file": "…", "line": 8, "name": "…" },
  "connection": "default"
}
```

**`route`** — `uri` ("GET api/foo"), `as`, `controller`, `middleware[]`, `file`,
`prefix`, `namespace`. Exactly the `route` / `action` / `middleware` fields the
view needs.

**`memory`** — `peak_usage` in bytes → `memoryMb`.

Note `sql` is already display-ready: `options.db.with_params` defaults to true,
so debugbar substitutes bindings via `Grammar::substituteBindingsIntoRawSql()`.
`params` still carries the raw bindings separately, so both
`Query.sql` and `Query.bindings` come straight off one statement.

## Three gaps between debugbar and the design

1. **EXPLAIN is not in the payload.** In 4.x, `statements[].explain` is not the
   EXPLAIN result — it is `{url, driver, connection, query, modes, hash}`, a
   handle for an on-demand AJAX call to the `debugbar.queries.explain` route.
   It is also only populated when `debugbar.isStorageOpen()`. Closed in phase 5
   by running the plans ourselves; see below.
2. **`hints` no longer exists.** Debugbar v4 dropped the hint feature; there is
   no `hint` key anywhere in `src/`. This costs nothing: the renderer already
   derives its own via `duplicateQueries()`, `hasNPlusOne()`, `repeatCount()` and
   `worstRepeat()` in `src/renderer/src/requests/types.ts`. `Query.hint` stays
   `null` and the UI keeps computing it.
3. **`status` is not on the debugbar payload.** `__meta` has no response status.
   We read it from the response in the middleware and pass it through ourselves.

## Config: already published, but stale

`laravel/server/config/debugbar.php` is **already committed** — it has been in
the repo since `af2826c37` (RE ND-2790), from an earlier round with debugbar.
That is why `collectors.route` is already `true`.

It was written for debugbar v3, though. Its `options.db` block still has
`hints`, `show_copy` and an array-shaped `explain`, and it is missing the v4
keys `exclude_paths`, `backtrace_editor_links`, `show_query_result`,
`only_slow_queries`, `memory_usage`, `soft_limit` and `hard_limit`. Nothing
breaks — the collector providers read every one of those with an inline
`?? default` — but the file no longer documents what is actually in effect.

So phase 3 is a re-publish and merge, not a fresh publish:

```
php artisan vendor:publish --tag=debugbar-config --force
```

then re-apply what we want on top:

| Key | State today | We need | Why |
|---|---|---|---|
| `collectors.route` | `true` | keep | route name, action and middleware |
| `options.db.with_params` | `true` | **`false`** | see below |
| `options.db.backtrace` | `true` | keep | `Query.trace` |
| `options.db.timeline` | `false` | `true` | puts queries on the shared timeline |
| `options.db.soft_limit` | missing (100) | make explicit | past 100 queries, params/backtrace are dropped |
| `options.db.hard_limit` | missing (500) | make explicit | past 500, queries are ignored entirely |
| `debug_backtrace_limit` | `10` | **`50`** | ten frames never reaches app code |

**Correction — `with_params` has to be off.** The plan first said to keep it
on. That is wrong: with it on, debugbar substitutes the bindings into `sql` via
`Grammar::substituteBindingsIntoRawSql()` and the placeholders are gone for
good. `query-row.tsx` and `sql-tokens.ts` want the opposite — raw SQL with `?`
plus the bindings beside it, so the view can toggle between the two and build a
runnable "Copy as SQL". With it on, that toggle is dead. Turning it off costs
nothing here: this is an API-only app, so debugbar's own HTML bar is never
injected and nobody reads its SQL tab.

A consequence: since the view substitutes the bindings itself, string bindings
must arrive **already quoted and escaped** (`'net-os'`, not `net-os`), which is
what `ShapeDebugbarRequestAction::bindings()` does. Numbers, booleans and null
stay bare.

`options.db.only_slow_queries` defaults to `true` but is inert while
`slow_threshold` is falsy — `DatabaseCollectorProvider` collects everything when
no threshold is set. Leave both alone.

The soft/hard limits are worth knowing about: when either trips, debugbar
injects synthetic `type: "info"` statements into `statements[]` explaining
itself. The shaper must skip anything whose `type` is not `query`.

## Where to hook

Debugbar collects on the `RequestHandled` event (`handleResponse()` →
`sendDataInHeaders()` → `collect()`), well before termination. `getData()` also
collects lazily if nothing has yet. So any post-response hook is safe.

Use a `terminate()` middleware — it runs in `Kernel::terminate()` after the
response is flushed, and it is the seam the codebase already uses for
post-response work (see the notifications read-marking).

**Correction — no `defer()` inside it.** The plan first said to wrap the send in
`defer()`. That silently does nothing. Laravel prepends `InvokeDeferredCallbacks`
to the middleware stack, so it terminates *before* this middleware does, and a
callback queued here is never invoked. Measured with temporary logging: the
`terminate reached` line appeared on every request, the `defer ran` line never
did, and no payload arrived. Removing `defer()` fixed it immediately.

`defer()` was redundant anyway — `terminate()` already runs after the response
has been sent, which is the whole point of using it.

Do **not** hook the `Terminating` event either: debugbar's own listener is
registered there, and relying on listener ordering is fragile.

## Guards

All of these live in the middleware, checked before we touch debugbar:

- `app()->environment('local')` only — never test, never production.
- `Debugbar::isEnabled()` — if the developer turned it off, ship nothing.
- Skip debugbar's and telescope's own routes (`_debugbar/*`, `telescope/*`) and
  the ray availability probe.
- Size cap: json-encode the shaped payload, and if it exceeds ~512 KB drop
  `queries.statements[].backtrace` first, then truncate the statement list,
  rather than sending a payload the Electron app's 500-entry ring buffer will
  choke on.
- Wrap the whole body in `rescue()`. A debug tool must never be able to fail a
  request.

Registration goes in `AppServiceProvider::boot()`, beside the existing Telescope
guard, **not** in `bootstrap/app.php`. The `withMiddleware` callback runs on
`afterResolving(HttpKernel)`, which is before `LoadConfiguration`, so
`environment()` is not answerable there yet.

**Octane caveat:** the monorepo runs classic FrankenPHP locally and Octane on
GKE. Since this is local-only, Octane is not on the path — but debugbar already
resets itself per Octane request via `ResetDebugbar` on `RequestReceived`, so
the hook stays correct if that ever changes.

## Transport

`Spatie\Ray\Ray::sendRequest(array $payloads, array $meta = [])` is public and
takes `Payload` objects, so we define our own type rather than squeezing this
through `sendCustom()` (which hardcodes `type: "custom"`).

```php
final class HttpRequestPayload extends Payload
{
    public function __construct(private readonly array $request) {}

    public function getType(): string
    {
        return 'netos_request';
    }

    public function getContent(): array
    {
        return $this->request;
    }
}
```

Note the project's lint rules forbid the `ray()` helper
(`ForbiddenFunctionsSniff`), so the middleware resolves
`app(Spatie\LaravelRay\Ray::class)` — the same instance the helper would have
returned.

`ray.php` already exists at `laravel/server/ray.php` (spatie/ray reads it from
the project root, not from `config/`) and already points at
`host.docker.internal`, so nothing has to be published for the transport.

On the Electron side, `event-log.ts` keeps `netos_request` out of the default
listing the same way `ANNOTATIONS` are, and `use-requests.ts` subscribes to the
same event channel to pick them up.

## Phases

### 1. Payload type and shaper — done
- `app/Services/Debug/HttpRequestPayload.php`, type `netos_request`.
- `app/Actions/Debug/ShapeDebugbarRequestAction.php`: `array $data, Request,
  Response` → the `HttpRequest` shape from `requests/types.ts`.
  `offsetMs = ($statement['start'] - $data['time']['start']) * 1000`,
  `durationMs = $data['time']['duration'] * 1000`,
  `memoryMb = $data['memory']['peak_usage'] / 1024 / 1024`,
  `collectorCounts` from each collector's `count` (`nb_statements` for queries,
  `nb_templates` for views). Statements whose `type` is not `query` are skipped,
  which covers both transactions and debugbar's synthetic limit notices.

`QueryFrame.callable` is thinner than the fixtures suggested. Debugbar's frames
carry no class or method, only a normalized path — or a view name, a middleware
alias, or the literal "Route binding". The canvas' `Class::method()` cannot be
backed by real data, so the frame's name is what is shown.

### 2. Middleware and config — done
- `app/Http/Middleware/SendRequestToNetosDebug.php`, `terminate()` only, all
  guards above, size cap, `rescue(..., report: false)`.
- Registered from `AppServiceProvider::boot()` for local, non-console runs.
- `config/debugbar.php`: `options.db.with_params` off, `options.db.timeline` on.
  Folded in from phase 3, because the shaper is wrong without the first one.

### 3. Config re-publish — still open
- `vendor:publish --tag=debugbar-config --force` to drop the v3-era keys and
  pick up `soft_limit`, `hard_limit`, `exclude_paths` and the rest, then
  re-apply the two settings above. Cosmetic: the collectors already fall back to
  these values, so nothing behaves differently until it is done.

### 4. Receiving — done
- `REQUEST_PAYLOAD_TYPE` in `src/shared/ray-event.ts`, so main and renderer
  agree on the string.
- `event-log.ts` keeps them out of the default listing; they stay in the buffer
  and are still reachable with `?type=netos_request` and by id.
- `use-ray-events.ts` skips them, so the stream and its type filters stay clean.
- `use-requests.ts` subscribes to the same channel, parses through
  `to-http-request.ts` and keeps the last 100. A payload whose shape has drifted
  is dropped rather than rendered half-empty.

**Correction — the fixtures are not kept as a fallback.** The plan said to fall
back to `fixtures.ts` when nothing is connected. That is a bad idea in a debug
tool: nine fabricated requests that look real are something you can waste an
afternoon chasing. The view now distinguishes "nothing collected yet" from
"filtered away" and says so. `fixtures.ts` is no longer imported anywhere.

### 5. EXPLAIN — done, off by default
- `config/netos-debug.php`: `explain_queries` (default off) and
  `max_explained_queries` (default 25).
- `app/Actions/Debug/ExplainQueriesAction.php` runs `EXPLAIN` on each select and
  fills `Query.explain`. It walks `ShapeDebugbarRequestAction::queryStatements()`
  so it lines up with exactly the rows the view renders.
- MySQL returns twelve columns and the design's table shows eight, so the row is
  projected onto `id, select_type, table, type, key, rows, filtered, Extra`.

**The connection is the hard part.** Debugbar reduces a query's connection to
the *database name* it ran against, not the connection name — and under tenancy
the connection that name refers to has been repointed at the tenant database by
the time `terminate()` runs. Explaining on the current connection therefore
failed for every central-database query (measured: the `tenants` lookup came
back with no plan while an INFORMATION_SCHEMA query succeeded, because the
latter works from any database).

The fix is a throwaway `netos-debug-explain` connection, cloned from the default
and pinned to the database the statement names, purged afterwards. Both queries
then get plans.

## Two defects found after the first pass

**The container-path worry was unfounded.** The plan flagged that
`statements[].source.file` is an absolute container path and that ray's
`remotePath`/`localPath` rewriting would be needed. It is not: the shaper never
ships that field. `source` comes from debugbar's `filename` and each trace
frame's path from its `name`, both of which `normalizeFilePath()` has already
made relative to the project root. Measured across a live payload: zero absolute
paths. Nothing to fix.

**Queries arrived with no source at all.** Real, and the cause was the stale
config again: it pins `debug_backtrace_limit` to `10`, where the package default
is `50`. Ten frames is not enough to walk out of Eloquent's internals, so
`findSource()` filtered everything and the query reached the view with no origin
and an empty trace. Raising it to the package default fixed it — sources went
from missing to present, and traces from one frame to the full five that
`findSource()` slices.

## Open questions

- Does the monorepo want this committed to `develop`, or kept on a local-only
  branch? It is dev-only and guarded, but it does add three app files and a
  config change.
- `queries.statements[].source.file` is a container path (`/var/www/...`).
  Ray's `remotePath`/`localPath` rewriting exists for exactly this; we should
  reuse it so the trace lines are clickable on the host.
- The collector tabs other than Queries are still placeholders; `collectorCounts`
  already carries the numbers to fill them, and Mail and Jobs are now separate
  tabs.
- One request can be a 230 KB payload (measured on a 191-query index call).
  `EventLog` keeps 500 entries of any type, so a busy session could hold well
  over a hundred megabytes. The renderer already caps requests at 100; the main
  process buffer probably wants its own, smaller cap for this type.
