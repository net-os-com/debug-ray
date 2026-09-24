# Request collector — implementation plan

Goal: after every HTTP request, ship that request's full debug payload to NetOS
Ray so the Requests view runs on real data instead of fixtures.

## Two findings that change the shape of this

**laravel-debugbar is not installed.** It is absent from `composer.json` and
from `vendor/`. What *is* installed is `laravel/telescope` ^5.22, enabled
(`TELESCOPE_ENABLED=true`), with eighteen watchers — everything debugbar
collects, and more.

**`laravel/octane` ^2.17 is installed.** Debugbar keeps collector state on a
long-lived object, which is the wrong shape for a worker that serves many
requests per process. Telescope is built for that environment. Adding debugbar
here would mean a new dependency that duplicates an existing one and is the
weaker fit for how this application runs.

So the plan below collects from Telescope. The request is otherwise unchanged:
one payload per request, pushed after the response.

## The seam is better than a middleware

Telescope already does the hard part — collecting and correlating a request's
entries under one `batch_id` — and it exposes the result:

```php
Telescope::afterStoring(function (array $entries, string $batchId) { … });
```

That fires at terminate, after the response, with every `IncomingEntry` for
that request. There is nothing left for a middleware to collect; a middleware
would only be re-deriving what this hook hands over. The hook is the seam.

Whether the ray call itself should additionally sit inside `defer()` is worth
settling during implementation, not before: `afterStoring` already runs during
terminate, so a deferred callback registered there may be flushed too late.
Verify it before relying on it. The cost of sending synchronously is small
anyway — ray's client caches "is anything listening" for 30 seconds and returns
false fast, so with NetOS Ray closed the overhead is one failed connect per half
minute, not per request.

## What maps, and what does not

A Telescope query entry carries `connection`, `driver`, `sql`, `time`, `slow`,
`file`, `line`, `hash`. Against the contract in
`src/renderer/src/requests/types.ts` that covers `sql`, `durationMs`, `source`,
`connection` and the slow flag. The request entry covers method, uri, status,
duration, memory, route, action and middleware.

Four things the Requests view draws have no source in Telescope:

- **Bindings.** Telescope substitutes them into the SQL and leaves the
  `bindings` array empty. The "Fill in bindings" toggle would have nothing to
  toggle, and the bindings chips nothing to list.
- **Timeline offsets.** Not recorded. Approximable from each entry's
  `recordedAt` minus the request's start, which is good enough to position a
  bar but is not the real figure.
- **EXPLAIN.** Not recorded at all. Producing it means running `EXPLAIN` against
  each select ourselves — a feature in its own right, with its own cost.
- **Backtrace.** Only the calling frame is kept, not a stack.

These are decisions to take, not gaps to paper over. Drawing an empty EXPLAIN
table or a bindings toggle that does nothing repeats the Copy payload mistake.

**Also:** `.env` currently disables the event, cache, model and redis watchers.
The Events and Cache tabs stay empty until those are turned on.

## Phases

### 1. The payload type

A `Payload` subclass in the application with its own type, say
`netos_request`, so NetOS Ray can route it to the Requests view rather than the
stream. Extending `Spatie\Ray\Payloads\Payload` is enough; `CustomPayload`
would arrive as a generic `custom` and be indistinguishable from `ray()->html()`.

### 2. Shaping

A class that turns `(array $entries, string $batchId)` into the JSON the
contract describes: one request object with its queries. It reads entries by
`type` (`request`, `query`, `event`, `cache`, …) and fills what it can, leaving
the four gaps above explicitly null rather than invented.

Counts for the undesigned collector tabs come free: they are the number of
entries of each type.

### 3. Registration and guards

A service provider registering the hook, active only when ray is enabled and
the environment is not production. Two more guards worth having: a cap on the
number of entries shipped per request, and a skip for requests to Telescope's
own routes, so opening Telescope does not generate payloads about opening
Telescope.

### 4. Receiving

NetOS Ray routes `netos_request` into a request store instead of the stream, and
`useRequests` reads from it instead of `fixtures.ts`. The view itself does not
change — that was the point of writing `types.ts` as the contract.

### 5. Closing the four gaps

Taken one at a time, each on its own merits:

- Bindings: either keep raw SQL plus a real bindings array by collecting from
  `QueryExecuted` ourselves, or drop the toggle.
- Offsets: derive from `recordedAt`, and say in the UI that they are derived.
- EXPLAIN: a deliberate feature, opt-in, select statements only.
- Backtrace: needs its own collection; Telescope will not provide it.

## Open question

Telescope writes every batch to the database. If NetOS Ray becomes where you
actually look, that storage is cost without a reader — worth deciding whether
Telescope stays on for its own UI, or is reduced to a collector that only feeds
this tool.
