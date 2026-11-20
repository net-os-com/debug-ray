# Mock server — design

NetOS-ray answers the platform's calls to third-party APIs with fixed
responses, and fires webhooks at the platform. The responses live in the
platform repository, so the whole team shares them. A developer can then test
an integration locally without that third party's token.

## Intent

Third-party tokens are shared with every developer today, only so the
integrations can be run locally. The goal is to stop sharing them and still be
able to test those integrations on a laptop.

Balena is the first real user. The device sync already runs in the scheduler,
and the reboot and the claim flow are coming. The payment provider (Mollie or
Stripe, not chosen yet) comes later and builds on this.

## Goals, non-goals, anti-goals

**Goals:**

- A developer points a service's base URL in `.env` at NetOS-ray, and every
  call to that service is answered from a fixture.
- Each endpoint has a few named, fixed responses. One of them is active per
  developer, and switching is one click.
- The fixtures live in the platform repository, are reviewed in pull requests,
  and are shared by the whole team.
- A webhook stored next to the fixtures can be fired at the local platform,
  signed the way the real provider signs it.
- Every call that reaches the mock server is visible, with the response that
  answered it, or the fact that none did.
- A real outgoing call, recorded by someone who does have the token, can be
  turned into a fixture.

**Non-goals:**

- Simulating a service's behaviour: no remembered state, no checkout page, no
  webhooks firing by themselves. This may come later for the payment provider.
- Variables or templating inside responses.
- Passing a call through to the real API, or a record mode.
- Mocks that keep working while NetOS-ray is closed. No container.
- The platform-side hooks for Mollie (`setApiEndpoint()`) and Stripe
  (`Cashier::$apiBaseUrl`). They arrive with the payment provider work.
- MQTT and EMQX. The local broker already needs no credentials.
- MCP tools for mocks.
- Platform-repository changes: the first `mocks/balena.yaml`, the
  `.env.example` lines and the README note. They are a separate follow-up.
- Firing one webhook several times at once to test idempotency races. This may
  come later with payments.

**Anti-goals:**

- **The mock server calling the real API.** Never, not even as a fallback.
- **A secret in a fixture file.** Signing secrets are read from the app's
  config at send time, and tokens never enter a fixture.
- **Switching the active response showing up as a git diff.** The choice is
  per developer and stays out of the repository.
- **A fixture quietly answering the wrong call.** When nothing matches, the
  call fails loudly.

## Approaches considered

Earlier decisions in the conversation:

| Question | Chosen | Rejected |
|---|---|---|
| What a mock does | Fixed responses per endpoint, webhooks fired by hand | Simulating the service: stateful, with a per-provider upkeep cost |
| Where mocks live | In the platform repository, shared | Per developer in the app: everyone builds their own |
| Where the server runs | Inside NetOS-ray, only while it is open | Its own docker-compose container: an extra container and a platform change for everyone |
| How calls are caught | The base URL points at NetOS-ray | Intercepting in-process in `laravel-netos-debug`: it only sees Laravel's `Http` client, so it misses `stripe-php` |

The file format:

| Approach | Verdict |
|---|---|
| **Our own compact YAML, one file per service.** | **Chosen.** Endpoints are named, and query conditions are part of an endpoint. That matters for Balena: its Pine API puts most of the meaning in `$filter` on a single path (`GET /v7/device`). Delays and webhooks are part of the format too. |
| **OpenAPI 3.1 with named examples**, like the API collections. | Rejected. OpenAPI allows one operation per method and path. Query variants, delays and webhooks would all end up in `x-netos-debug`, and the result would no longer really be OpenAPI. |
| **Embedding Mockoon's engine.** | Rejected. It would put Mockoon's JSON in the repository, which reads poorly in a diff, and it is a heavy dependency. |

## Design

### How the platform reaches it

- **Base URL.** Each service's base URL in the developer's own `.env` points at
  NetOS-ray: `BALENA_API_URL=http://host.docker.internal:23517/mock/balena`.
  `localhost` does not work, because inside a container it means the container
  itself. From the php and worker containers, `host.docker.internal:23517` was
  checked and works.
- **Route.** The existing Ray server (`src/main/ray-server.ts`) serves it under
  `/mock/<service>/…`. A path prefix works because the clients append their
  path to the base URL:
  - Balena: `rtrim(base)/v7/device`,
  - Mollie: `Url::join`,
  - Stripe: `api_base` + `/v1/…`.
- **Opt-in per developer.** No default goes into `.env.example`, only a
  commented example line. When NetOS-ray is closed, calls fail with
  "connection refused": an explicit failure, never a call to the real API.
- **After changing `.env`,** restart the worker and the scheduler. They keep
  the config in memory.
- **Who may call.** The route accepts calls from containers, so it cannot be
  loopback-only like `/api/`. Fixtures hold nothing secret, but the route still
  refuses addresses outside loopback and private ranges, because the server
  listens on `0.0.0.0`.

### The fixture file

There is one file per service, at `mocks/<service>.yaml` in the Laravel app
root. The directory is configurable as `netos-debug.mocks.path` (default
`mocks`), like `collections.path`. The file name is the service's name and its
URL segment: `balena.yaml` is served under `/mock/balena`.

```yaml
name: Balena
endpoints:
  - id: fleet-devices
    name: Devices of a fleet
    method: GET
    path: /v7/device
    query:
      $filter: "belongs_to__application eq *"
    responses:
      - id: three-online
        name: Three online
        status: 200
        body: |
          {"d": [ … ]}
      - id: rate-limited
        name: Rate limited
        status: 429
        headers: { Retry-After: '30' }
        delay_ms: 0
  - id: reboot
    name: Reboot a device
    method: POST
    path: /supervisor/v1/reboot
    responses:
      - { id: ok, name: Rebooting, status: 202, body: "OK" }
webhooks:
  - id: device-online
    name: Device online
    method: POST
    path: /webhooks/balena
    headers: { Content-Type: application/json }
    body: |
      { … }
    signature:
      kind: hmac-sha256          # none | hmac-sha256 | stripe
      header: X-Signature
      prefix: "sha256="
      secret_config: services.balena.webhook_secret
```

**Ids.** Every endpoint, response and webhook has a stable `id`, a slug. The
per-developer choice of active response keys on these ids, so it survives
renames and reordering.

**Bodies are text (decided while planning).** Every response and webhook body
is a string, written in YAML as a literal block (`|`). That way a JSON `{}`
cannot turn into `[]` on its way through PHP, and a webhook is signed over
exactly the bytes in the file. Balena's `$count` answers with a bare number,
and that works the same way.

**Content-Type.** When no `Content-Type` header is set, a body whose trimmed
text starts with `{` or `[` and parses as JSON gets `application/json`.
Anything else gets `text/plain; charset=utf-8`.

**Matching.**
- Method and path must match. `*` matches any run of characters, the same
  semantics as Laravel's `Str::is`.
- Every key under `query` must be present in the call and match its pattern.
  Extra query parameters are ignored.
- The first matching endpoint in file order wins, so specific endpoints go
  above general ones.

### The package: `netos-debug:mocks`

**Commands.** A new command in `laravel-netos-debug`, on the same pattern as
`netos-debug:collections`:

- `list`, which returns every service with its contents, like
  `netos-debug:collections list` does
- `save`, which takes the whole document on stdin
- `forget <service>`
- `secret <config.key>`, which reads a webhook's signing secret

The plan fixed this set.

The answer is JSON on the last line of stdout. The package converts between
YAML and JSON, so NetOS-ray only ever handles JSON and needs no YAML
dependency.

**Writing.** The package writes YAML with a stable key order, so changing one
response is a small diff.

**Validation on save.** It checks:

- ids are unique,
- the method is known,
- status is between 100 and 599,
- the signature kind is known,
- `secret_config` is a config key, not a value.

If any check fails, it refuses with a message instead of writing half a file.

**Scope.** It is local only, like the other commands; the package is
require-dev. Shipping it is a package release, so every developer runs
`composer update net-os/laravel-netos-debug`.

### NetOS-ray main

**Loading the fixtures.** The parsed services are held in memory in main. They
are loaded over `docker exec` (`netos-debug:mocks list`, then `read`):

- at start,
- when the window gains focus,
- after every save.

So a `git pull` comes through without a restart. The container is the one
already chosen in Settings, the same one Tinker and the ERD use.

**Answering calls.**
- Matching runs in memory. There is no `docker exec` per call, because a call
  has to be answered in milliseconds.
- `delay_ms` waits that long before answering.
- When the fixtures have not loaded (no container chosen, Docker down), the
  server answers `503` with the reason.
- When no endpoint matches, it answers `501` with
  `{"message": "No mock for GET /v7/device?$filter=… in balena"}`. Balena's
  client retries 5xx three times. That is accepted: every attempt shows in the
  hit log.

**Active response.** The active choice is kept per developer in a preferences
file in the app's userData, next to `api-environments.json`: a map from
`service/endpointId` to `responseId`. With no choice made, the first response
is active.

**Hit log.** Every call that reaches `/mock/*` is recorded:

- time and service,
- method, path and query,
- the endpoint and response that matched, or none,
- status,
- request headers and body.

The log is pushed to the renderer like other events, and kept in memory with a
cap like the other buffers. Request headers that look like credentials are
hidden the same way the HTTP view hides them. The token the platform sends here
is a dummy, but the habit stays.

### Webhooks

**Sending.** A webhook is sent from main through the existing `send()` in
`src/main/api/send.ts`. That function adds `X-Netos-Debug-Id`, so the incoming
request can be opened in the Requests view. The target is the API tab's
current environment host plus the webhook's `path`. For Local that is
`https://api.net-os.test`, with self-signed certificates allowed.

**Local only (my call).** **Send** is disabled unless the environment's host is
`localhost`, `127.0.0.1` or ends in `.test`. The secret comes from the local
container, so a signature would be wrong anywhere else. And an unsigned fake
webhook, such as Mollie's classic `id=tr_…`, must never reach staging or
production.

**Signatures.** The signature is computed at send time over the exact body
bytes that are sent:

- `none`: nothing is added.
- `hmac-sha256`: an HMAC-SHA256 of the body with the secret, as hex, in
  `header`, after an optional `prefix`. Mollie's next-gen webhooks use this
  scheme: `X-Mollie-Signature: sha256=…`.
- `stripe`: `Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`.
  Stripe accepts a signature for 5 minutes, which is why it is signed at send
  time.

**The secret.** It is read from the app's config at send time, over
`docker exec`, as `config(secret_config)`. It is never stored in NetOS-ray or
in the repository. When it is missing or empty, the webhook is not sent and
the view says why.

**One-off edits (my call).** The body can be edited for a single send without
saving it. A real webhook often carries one varying id, such as Mollie's
`id=tr_…`. **Save** writes the edited body back to the file.

### Save as mock, from the HTTP view

**The button.** The call detail in the HTTP view gets a **Save as mock** button
next to **Copy as cURL**. You pick:

- the service, or a new one,
- the endpoint: an existing one, or a new one prefilled with the call's method,
  path and query,
- a name for the response.

The status, headers and body come from the call. It is written through
`netos-debug:mocks save`.

**Truncated bodies.** The package trims recorded bodies at 16 KB
(`netos-debug.http_client.max_body_bytes`). When a body was trimmed, the
dialog says so and does not save it as is. Raising the limit is the developer's
own config call.

**Real data (Rick's answer).** A recorded response carries real data: device
UUIDs, device names, tenant ids in device variables. The dialog shows the body
editable before saving, with a clear line that this goes into git and that real
customer data has to come out first. Review of the pull request is the
backstop. There is no automatic scrubbing.

**Headers (my call).** The dialog drops two kinds of headers:

- headers the package already replaced with `‹redacted…›`,
- transport headers such as `Date`, `Content-Length`, `Connection` and
  `Transfer-Encoding`.

### The view

**Module.** A new **Mocks** module in the Build group, after API, with the hint
"Fake third-party APIs" (`src/renderer/src/chrome/view-nav.tsx`).

**A full editor (Rick's answer).** Everything in a fixture file can be done in
the view:

- create, rename and delete services,
- add, delete and reorder endpoints, including their query conditions. Order
  decides which endpoint matches.
- add, edit and delete responses and webhooks.

Nobody has to learn the YAML format. The file belongs to the package: a save
rewrites the whole file in its own key order. Editing it by hand is allowed,
but comments are not kept on the next save from the app.

**Layout (my call).** Three columns, like the API view:

1. Services, each with its endpoints and its webhooks.
2. The selected endpoint: its responses, the active one marked, each one
   editable. Or the selected webhook: method, path, headers, body, signature,
   and **Send**.
3. The hit log, filterable to the selected service or endpoint.

**Header.** Above the columns:

- the base URL to put in `.env` for each service, with a copy button,
- the server's state: listening, fixtures loaded from which container, and
  when.

**Look.** The view follows the app's own look (`tokens.css`, which came from
the "NetOS Debug Console" canvas). The mockup is the
[NetOS Debug — Mocks](https://claude.ai/artifact/A4q4tz4wxGFGD8ezzWXmvR)
canvas. It has three screens:

- an endpoint with its responses and the call log,
- a webhook being sent,
- **Save as mock** from the HTTP view.

The build follows it. Where the canvas and this document differ, this
document wins.

### The platform repository: a separate follow-up

This build delivers NetOS-ray and the package only. A separate task covers:

- a first real `mocks/balena.yaml`: the device sync, including paged lists, and
  the reboot,
- a commented example block in `.env.example`: the mock URL, a dummy
  `BALENA_API_TOKEN` (the sync exits early when it is blank) and a dummy
  `BALENA_FLEET_IDS` the fixtures answer for,
- a short "testing integrations without tokens" note in the platform's README.

For the end-to-end check by hand, the builder uses a throwaway local fixture
that is not committed (my call).

## Constraints

- One thing per file, with dependencies injected, in both the app and the
  package. On the PHP side, a store class does the writing, like
  `CollectionStore`.
- Few comments.
- No new runtime dependencies in NetOS-ray. YAML stays in the package.
- Build and typecheck after changes. On the package, `composer analyse`.
- The pure logic gets esbuild-bundled node checks, as in the menu bar work:
  the matcher, the signatures, and the "which response is active" rule. The
  view and the end-to-end flow are checked by hand against the running stack.

## Left to the builder

- The exact JSON contract between the command and the app.
- The exact private-range check for who may call `/mock/*`.
- The hit log's buffer size, and whether it shares components with the HTTP
  view.
- How a trimmed body is detected. If the payload does not mark it yet, add a
  flag in the package's outgoing-request shaper.
- Where Mocks lands in the ⌘ shortcut order.
- How main resolves the container chosen in Settings, and how query values are
  decoded before matching.
- Keeping `{}` and `[]` apart when JSON bodies pass through PHP.
- Refusing a save that would overwrite a newer file (someone pulled meanwhile).
- What the app shows when the installed package is too old to have
  `netos-debug:mocks`.
- Which command reads a webhook's signing secret.
- The view's details, within the mockup.
