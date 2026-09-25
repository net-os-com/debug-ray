# Request collector — implementation plan

Ship one payload per HTTP request from the NetOS monorepo to NetOS Debug, so the
Requests view runs on real data instead of `requests/fixtures.ts`.

Source: `barryvdh/laravel-debugbar ^4.4`, installed as a dev dependency in
`laravel/server` (commit adding it is on `feature/SOFT-2872`). Transport:
the existing ray channel, with a custom payload type.

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
   It is also only populated when `debugbar.isStorageOpen()`. So `Query.explain`
   ships as `null` in phase 1. Closing it means running `EXPLAIN` ourselves
   inside the deferred callback for `select` statements — cheap, but it doubles
   the query count, so it goes behind its own config flag in a later phase.
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
| `options.db.with_params` | `true` | keep | `Query.sql` + `Query.bindings` |
| `options.db.backtrace` | `true` | keep | `Query.trace` |
| `options.db.timeline` | `false` | `true` | puts queries on the shared timeline |
| `options.db.soft_limit` | missing (100) | make explicit | past 100 queries, params/backtrace are dropped |
| `options.db.hard_limit` | missing (500) | make explicit | past 500, queries are ignored entirely |

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
post-response work (see the notifications read-marking). Inside it, call
`defer()` so a slow or unreachable NetOS Debug can never hold the worker.

Do **not** hook the `Terminating` event: debugbar's own listener is registered
there, and relying on listener ordering is fragile.

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

On the Electron side, `event-log.ts` routes `type === 'netos_request'` into the
Requests store instead of the event list, the same way `ANNOTATIONS` are
filtered out of the listing today.

## Phases

### 1. Payload type and shaper
- `HttpRequestPayload` (one file).
- `ShapeDebugbarData` action: `array $data, Response $response` →
  the `HttpRequest` shape from `src/renderer/src/requests/types.ts`.
  `offsetMs = ($statement['start'] - $data['time']['start']) * 1000`,
  `durationMs = $data['time']['duration'] * 1000`,
  `memoryMb = $data['memory']['peak_usage'] / 1024 / 1024`,
  `collectorCounts` from `count()` per collector key.
  Skips statements whose `type !== 'query'`.

### 2. Middleware
- `SendRequestToNetosDebug` with a `terminate()` method, wrapping a `defer()`
  that calls the shaper and `sendRequest()`. All guards above.
- Registered in `bootstrap/app.php` behind the environment check.

### 3. Config
- Re-publish `config/debugbar.php` with `--force`, re-apply
  `options.db.timeline` and make the limits explicit, commit it.
- Also publish `config/ray.php` — still missing in the monorepo — so the host
  and port are explicit rather than defaulted.

### 4. Receiving
- `netos_request` routing in `event-log.ts`.
- Swap `fixtures.ts` for the live store; keep the fixtures as the empty-state
  fallback so the view still renders with nothing connected.

### 5. EXPLAIN (optional, behind a flag)
- In the deferred callback, for each `select` statement, run
  `EXPLAIN` on the same connection and attach the rows as `Query.explain`.
- Off by default; it doubles query count on every request.

## Open questions

- Does the monorepo want this committed to `develop`, or kept on a local-only
  branch? It is dev-only and guarded, but it does add two app files and a
  config.
- `queries.statements[].source.file` is a container path (`/var/www/...`).
  Ray's `remotePath`/`localPath` rewriting exists for exactly this; we should
  reuse it so the trace lines are clickable on the host.
