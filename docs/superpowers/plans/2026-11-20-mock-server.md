# Mock server — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NetOS-ray answers the platform's calls to third-party APIs from fixed
responses kept in the platform repository, and fires signed webhooks at the
local platform. Developers can then test integrations without third-party
tokens.

**Architecture:**

- **The package** (`net-os/laravel-netos-debug`) owns the fixture files,
  `mocks/<service>.yaml`. It reads and writes them through a new
  `netos-debug:mocks` command and speaks JSON to the app.
- **The main process** loads the fixtures over `docker exec` into memory. It
  answers `/mock/<service>/…` on the existing Ray server (port 23517) from that
  memory, logs every call, and signs and sends webhooks through the existing
  `send()`.
- **The renderer** gets a Mocks module, a full editor for the fixtures, and a
  **Save as mock** dialog in the HTTP view.

**Tech stack:**
- NetOS-ray: Electron 44, React 19, TypeScript 7, no new dependencies.
- Package: PHP 8.4, Laravel 12/13, Symfony YAML. YAML already arrives
  through the framework; nothing new is installed.

**Spec:** `docs/superpowers/specs/2026-11-20-mock-server-design.md`. The mockup
is the [NetOS Debug — Mocks](https://claude.ai/artifact/A4q4tz4wxGFGD8ezzWXmvR)
canvas. Where the two differ, the spec wins.

## Global Constraints

**Where the work happens**
- NetOS-ray: branch `feature/mock-server`, cut from `main`, built in a git
  worktree (superpowers:using-git-worktrees). The main checkout has
  uncommitted work in `app.tsx`, `settings-view.tsx` and `use-settings.ts`
  that is not part of this.
- Package: `/Users/rickbongers/Code/laravel-netos-debug`, branch
  `feature/mocks`, cut from `main`. The platform pins it at `^0.2` and has
  `v0.2.6`; this ships as `v0.3.0`.

**Code style**
- One thing per file, with dependencies injected.
- Few comments: only where the code cannot say it.
- No new runtime dependencies in NetOS-ray. `js-yaml` is already installed but
  is not used here: YAML stays in the package.
- UI copy is English, in sentence case, as in the rest of the app.

**The fixture format**
- **Bodies are text.** A response or webhook body is a string, written in
  YAML as a literal block (`|`). This keeps a JSON `{}` from turning into
  `[]` on its way through PHP. And a webhook signature is computed over
  exactly the bytes the file holds.
- **Content-Type.** When a body's trimmed text starts with `{` or `[` and
  parses as JSON, and no `Content-Type` header is set (compared
  case-insensitively), the answer gets `Content-Type: application/json`.
  Otherwise it gets `text/plain; charset=utf-8`.
- **Key names.** The JSON between package and app uses camelCase: `delayMs`,
  `secretConfig`. The YAML file uses snake_case: `delay_ms`, `secret_config`.
  Only the package translates between them.
- **Service names.** A service's `name` is its slug: the file name and the
  URL segment, matching `[a-z0-9][a-z0-9-]*`. It is fixed once created; the
  view renames `title` only.
- **Ids.** Endpoint, response and webhook ids are slugs, unique at their
  level, and never change when a name changes.

**The mock server**
- **Route:** `/mock/<service>/<path>?<query>` on the existing Ray server.
  Callers outside loopback and private ranges get `403`.
- **No match:** `501`, with JSON `{"message": "…"}`. This covers an unknown
  service, no matching endpoint, and an endpoint with no responses.
- **Not loaded:** `503`, with JSON `{"message": "…"}`. This covers fixtures
  that were never loaded, and a load that failed.
- **Matching:** method (case-insensitive) and path match with `*` as the
  only wildcard, anchored at both ends. Every `query` key must be present and
  match after URL-decoding; extra query parameters are ignored. The first
  matching endpoint in file order wins.
- **Active response:** the developer's choice, stored in
  `userData/mock-choices.json` under the key `<service>/<endpointId>`. With no
  choice, or a choice whose response is gone, the first response is active.
- **Hit log:** keeps the newest 200 calls in memory. Request headers that
  look like credentials are hidden in the view, the same way the HTTP view
  does it.

**Webhooks**
- **Local only.** **Send** works only when the target host is `localhost`,
  `127.0.0.1`, `::1`, or ends in `.test`. Main enforces this too.
- **Signatures**, over the exact body string:
  - `hmac-sha256`: `<header>: <prefix><hex HMAC-SHA256(secret, body)>`
  - `stripe`: `Stripe-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`
- **The secret** is read at send time with `netos-debug:mocks secret <key>`.
  It is never stored in the app or in a file.

**Save as mock**
- **Headers left out:** `Date`, `Content-Length`, `Connection`,
  `Transfer-Encoding` and `Keep-Alive`, compared case-insensitively, plus any
  header whose value starts with `‹redacted`.
- **A trimmed body** ends in `\n\n‹truncated at <n> bytes›`, which is the
  package's own marker. A trimmed body is never saved.

**Checks and safety**
- No test framework on either side.
  - **NetOS-ray:** pure logic gets esbuild-bundled node checks (below), plus
    `npm run typecheck && npm run build`.
  - **Package:** `vendor/bin/pint && vendor/bin/phpstan analyse --no-progress`,
    plus artisan runs in the real container.
- Never commit `Certificates.p12`, `p12_password.txt`,
  `developerID_application.cer` or `.env`. No version bump in NetOS-ray: add
  `changelog/2.5.0.md` instead.
- Pushing, tagging and `composer update` in the platform happen only in
  Task 9, and only after Rick says go.

**Running NetOS-ray checks.** Checks live in
`CHECKS=/tmp/netos-ray-checks/mock-server`, outside the repo. They import
source by absolute path from the worktree and end with `console.log('ok')`.

```bash
check() { npx esbuild "$CHECKS/$1.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$CHECKS/out/$1.mjs" && node "$CHECKS/out/$1.mjs"; }
```

Expected output: `ok`.

**Running package changes in the platform without releasing.** The platform's
`vendor/` is bind-mounted into the container, so copying the package source
over the vendored copy is enough. `composer install` puts the released copy
back later.

```bash
PKG=/Users/rickbongers/Code/laravel-netos-debug
VENDORED=/Users/rickbongers/Code/NetOS-monorepo/laravel/server/vendor/net-os/laravel-netos-debug
sync_pkg() { rsync -a --delete "$PKG/src/" "$VENDORED/src/" && rsync -a "$PKG/config/" "$VENDORED/config/"; }
artisan() { docker exec -i -w /var/www/html net-os_local-php-1 php artisan "$@"; }
```

## Review Focus

1. **Balena's real query encoding.** `BalenaClient` sends
   `$filter=belongs_to__application%20eq%201876543`: the `$` is left
   unencoded, spaces are `%20`, and quotes are literal. The pattern
   `belongs_to__application eq *` must match it. Pinned in Task 2's
   `match.ts` check.
2. **The client gives up during a delay.** The "Balena hangs" response waits
   16 s, and Balena's client times out at 15 s. The server must not throw
   when it answers a closed socket. The hit is logged with status 0 and the
   note `Client gave up before the answer`. Pinned in Task 3, Step 7.
3. **One hand-edited file is broken.** Invalid YAML or an unknown method in
   `mocks/stripe.yaml` must not take Balena down. It shows up as a problem
   for that file, and the other services still load and answer. Pinned in
   Task 1, Step 6 and Task 5, Step 6.
4. **Saving over a file someone just pulled.** The save is refused with a
   message that says the file changed on disk, and the draft stays. Pinned in
   Task 1, Step 6 and Task 6, Step 6.
5. **A webhook body with a trailing newline or CRLF.** The signature is
   computed over exactly the string that is sent, nothing re-serialised.
   Pinned in Task 4's `sign.ts` check.

## File map

**Package** (`/Users/rickbongers/Code/laravel-netos-debug`)

| File | Responsibility |
|---|---|
| `src/Mocks/MockDocument.php` | YAML array ↔ JSON contract, key order, snake/camel translation |
| `src/Mocks/MockValidator.php` | The rules a service must meet before it is written |
| `src/Mocks/MockStore.php` | List, save and forget files under `netos-debug.mocks.path`, with a hash per file |
| `src/Console/MocksCommand.php` | `netos-debug:mocks list\|save\|forget\|secret` |
| `config/netos-debug.php` | `mocks.path`, env `NETOS_DEBUG_MOCKS_PATH`, default `mocks` |
| `src/NetOsDebugServiceProvider.php` | Registers the command |
| `README.md` | A "Mocks" section |

**NetOS-ray: shared** (`src/shared/mocks/`)

| File | Responsibility |
|---|---|
| `types.ts` | Every mock type, and `choiceKey` |
| `parse.ts` | Tolerant reading of what the package answered |
| `glob.ts` | `*`-only wildcard matching |
| `match.ts` | Which endpoint answers a call |
| `active.ts` | Which response is active |
| `local-host.ts` | Whether a webhook target is the local stack |

**NetOS-ray: main** (`src/main/mocks/`)

| File | Responsibility |
|---|---|
| `private-address.ts` | Who may call `/mock/*` |
| `content-type.ts` | The default `Content-Type` |
| `decide.ts` | What to answer: a response or a refusal |
| `mock-registry.ts` | The loaded services, in memory |
| `choices-store.ts` | `mock-choices.json` |
| `hit-log.ts` | The newest 200 calls |
| `package-bridge.ts` | `docker exec … netos-debug:mocks` |
| `mock-route.ts` | The HTTP handler for `/mock/*` |
| `sign.ts` | Signature headers |
| `fire-webhook.ts` | Sending a webhook |
| `mock-ipc.ts` | The IPC handlers |

**NetOS-ray: renderer** (`src/renderer/src/mocks/`)

| File | Responsibility |
|---|---|
| `use-mocks.ts` | App-level data: state, hits, sends, choices, load, save |
| `use-mock-editor.ts` | Selection and draft |
| `edit-service.ts` | Pure edits on a `MockService` |
| `from-call.ts` | Turning an outgoing call into a response or an endpoint |
| `json-tokens.ts` | JSON highlighting for `CodeEditor` |
| `mocks-view.tsx`, `service-bar.tsx`, `service-list.tsx`, `endpoint-editor.tsx`, `response-list.tsx`, `response-editor.tsx`, `hit-log.tsx`, `webhook-editor.tsx`, `send-log.tsx`, `save-as-mock-dialog.tsx` | The screens |

---

### Task 1: The package — fixture files and `netos-debug:mocks`

**Files:** the package rows of the file map.

**Interfaces — Produces:** the JSON contract every later task reads.

`list` prints:

```json
{ "services": [MockService], "problems": [{ "file": "mocks/x.yaml", "error": "…" }], "directory": "mocks", "error": null }
```

A `MockService` in JSON looks like this:

```json
{ "name": "balena", "title": "Balena", "file": "mocks/balena.yaml", "hash": "<sha1 of the file>",
  "endpoints": [{ "id": "fleet", "name": "…", "method": "GET", "path": "/v7/device", "query": {"$filter": "…"},
    "responses": [{ "id": "three", "name": "…", "status": 200, "headers": {}, "delayMs": 0, "body": "{…}" }] }],
  "webhooks": [{ "id": "…", "name": "…", "method": "POST", "path": "/…", "headers": {}, "body": "…",
    "signature": { "kind": "none|hmac-sha256|stripe", "header": "", "prefix": "", "secretConfig": "" } }] }
```

`query` and `headers` are always written as JSON objects, never `[]`.

- **`save`** reads one `MockService` on stdin and takes `--hash=<expected>`.
  It prints `{"file": "mocks/balena.yaml", "hash": "<new sha1>", "error": null}`.
- **`forget <name> --hash=<expected>`** prints `{"error": null}`.
- **`secret <config.key>`** prints `{"secret": "…", "error": null}`.

**The YAML file**

- Top-level keys, in this order: `name`, `endpoints`, `webhooks`. The
  top-level `name` holds the title.
- Endpoint keys, in this order: `id`, `name`, `method`, `path`, `query`,
  `responses`.
- Response keys, in this order: `id`, `name`, `status`, `headers`,
  `delay_ms`, `body`.
- Webhook keys, in this order: `id`, `name`, `method`, `path`, `headers`,
  `signature`, `body`. The signature's keys are `kind`, `header`, `prefix`,
  `secret_config`.
- Empty keys are left out: `query: {}`, `headers: {}`, `delay_ms: 0`, a
  signature of kind `none`, and `body: ''`.
- Dump with `Yaml::dump($doc, 10, 2, Yaml::DUMP_MULTI_LINE_LITERAL_BLOCK)`.

**Validation** (`MockValidator::errors(array $service): list<string>`) checks
that:

- ids match `^[a-z0-9][a-z0-9-]*$` and are unique at their level;
- the method is one of GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS;
- the path starts with `/`;
- the status is an integer from 100 to 599;
- `delayMs` is an integer from 0 to 60000;
- the signature kind is known;
- for any kind other than `none`, `secretConfig` matches
  `^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$`. A dotted key, so a pasted secret is
  refused.
- for `hmac-sha256`, `header` is not empty.

**Saving.** On save, the hash rules come first:

- the file exists and `--hash` is missing or different: refuse with
  `mocks/balena.yaml changed on disk. Reload, then save again.`
- the file does not exist and `--hash` is given: refuse with
  `mocks/balena.yaml is gone. Reload, then save again.`

**Listing.** A file that fails to parse or to validate becomes one `problems`
entry, with the parser's or the validator's first message. It is left out of
`services`.

- [ ] **Step 1: Create the branch.** In the package:
  `git checkout -b feature/mocks`.

- [ ] **Step 2: Add the config key.** In `config/netos-debug.php`, below
  `erd`, add `'mocks' => ['path' => env('NETOS_DEBUG_MOCKS_PATH', 'mocks')]`
  with a two-line comment in the style of its neighbours.

- [ ] **Step 3: Implement the classes.**
  - `MockDocument::toContract(string $name, array $yaml): array` and
    `MockDocument::toYaml(array $contract): array`.
  - `MockValidator::errors(array $contract): array`.
  - `MockStore`, a `final readonly class` built like `CollectionStore`:
    - `list(): array{services: list<array>, problems: list<array{file: string, error: string}>}`
    - `save(array $contract, ?string $expectedHash): array{file: string, hash: string}`,
      which throws `RuntimeException` with the refusal message
    - `forget(string $name, ?string $expectedHash): void`
    - `directory(): string`
    - The name slug is built like `CollectionStore::file()`.
  - `MocksCommand`, built like `CollectionsCommand`: signature
    `netos-debug:mocks {action : list, save, forget or secret} {name? : service name or config key} {--hash= : the hash the caller last read}`.
  - `secret` reads `config($key)`:
    - The key must match the `secretConfig` pattern.
    - An empty or non-string value is refused with
      `<key> is empty in this application.`

- [ ] **Step 4: Register the command.** Add `->hasCommand(MocksCommand::class)`
  next to the other two in `configurePackage()`, and bind `MockStore` as a
  singleton.

- [ ] **Step 5: Lint.** Run `vendor/bin/pint && vendor/bin/phpstan analyse --no-progress`.
  Expected: both exit 0.

- [ ] **Step 6: Verify in the container.** Run `sync_pkg`, then:

  ```bash
  echo '{"name":"plan-check","title":"Plan check","endpoints":[{"id":"fleet","name":"Fleet","method":"GET","path":"/v7/device","query":{"$filter":"belongs_to__application eq *"},"responses":[{"id":"empty","name":"Empty","status":200,"headers":{},"delayMs":0,"body":"{\"d\":{}}\n"}]}],"webhooks":[]}' | artisan netos-debug:mocks save
  cat /Users/rickbongers/Code/NetOS-monorepo/laravel/server/mocks/plan-check.yaml
  artisan netos-debug:mocks list
  ```

  Expected:
  - `save` prints a `hash`.
  - The YAML has `body: |` with `{"d":{}}` under it, and no `headers:` or
    `delay_ms:` lines.
  - `list` returns the service with `"body":"{\"d\":{}}\n"` (still `{}`) and
    `"headers":{}`.

  Then the refusals:

  ```bash
  echo '{"name":"plan-check","title":"Plan check","endpoints":[],"webhooks":[]}' | artisan netos-debug:mocks save --hash=stale
  printf 'name: Broken\nendpoints:\n  - { id: x, name: X, method: FETCH, path: /x, responses: [] }\n' > /Users/rickbongers/Code/NetOS-monorepo/laravel/server/mocks/broken.yaml
  artisan netos-debug:mocks list
  artisan netos-debug:mocks secret app.name
  artisan netos-debug:mocks secret whsec_pasted
  ```

  Expected:
  - The stale save prints `mocks/plan-check.yaml changed on disk. Reload, then save again.`
  - `list` still returns `plan-check`, and gives `broken.yaml` one problem
    that names the method.
  - `secret app.name` prints the app name.
  - `secret whsec_pasted` is refused.

  Then clean up:
  `rm …/laravel/server/mocks/broken.yaml` and
  `artisan netos-debug:mocks forget plan-check --hash=<hash from list>`.
  The `mocks/` directory is gone or empty.

- [ ] **Step 7: Document and commit.** Add a "Mocks" section to the README,
  in the style of "Saved API requests": the four actions, one YAML example,
  the "bodies are text" rule, and the secret rule. Then commit with
  `git commit -m "feat: mock fixtures for third-party APIs"`.

### Task 2: The shared model and matching

**Files:** create `src/shared/mocks/types.ts`, `parse.ts`, `glob.ts`,
`match.ts`, `active.ts`, and `src/main/mocks/private-address.ts`,
`content-type.ts`, `decide.ts`. Checks: `$CHECKS/match.ts`,
`$CHECKS/decide.ts`.

**Interfaces — Produces:**

```ts
// types.ts
type MockResponse = { id: string; name: string; status: number; headers: Record<string, string>; delayMs: number; body: string }
type MockEndpoint = { id: string; name: string; method: string; path: string; query: Record<string, string>; responses: MockResponse[] }
type SignatureKind = 'none' | 'hmac-sha256' | 'stripe'
type MockSignature = { kind: SignatureKind; header: string; prefix: string; secretConfig: string }
type MockWebhook = { id: string; name: string; method: string; path: string; headers: Record<string, string>; body: string; signature: MockSignature }
type MockService = { name: string; title: string; file: string; hash: string | null; endpoints: MockEndpoint[]; webhooks: MockWebhook[] }
type MockProblem = { file: string; error: string }
type MockState = { services: MockService[]; problems: MockProblem[]; directory: string; container: string; loadedAt: number | null; error: string | null }
type MockChoices = Record<string, string>
type MockHit = { id: string; at: number; service: string; method: string; path: string; query: string; endpointId: string | null; responseId: string | null; status: number; durationMs: number; requestHeaders: { key: string; value: string }[]; requestBody: string; note: string | null }
type WebhookFire = { containerId: string; workingDir: string; host: string; insecure: boolean; webhook: MockWebhook }
type WebhookOutcome = { webhookId: string; at: number; sent: boolean; result: ApiResult | null; error: string | null; edited: boolean }
const EMPTY_STATE: MockState // services [], problems [], directory '', container '', loadedAt null, error null
function choiceKey(service: string, endpointId: string): string // `${service}/${endpointId}`

// parse.ts
function toServices(raw: unknown): MockService[] // drops entries without name; [] for query/headers becomes {}; missing fields get defaults
function toProblems(raw: unknown): MockProblem[]

// glob.ts
function globMatches(pattern: string, value: string): boolean

// match.ts
function matchEndpoint(endpoints: MockEndpoint[], method: string, path: string, query: URLSearchParams): MockEndpoint | null

// active.ts
function activeResponse(service: string, endpoint: MockEndpoint, choices: MockChoices): MockResponse | null

// private-address.ts
function isPrivateAddress(address: string | undefined): boolean

// content-type.ts
function withContentType(headers: Record<string, string>, body: string): Record<string, string>

// decide.ts
type MockDecision =
  | { kind: 'answer'; service: string; endpoint: MockEndpoint; response: MockResponse; path: string; query: string }
  | { kind: 'refuse'; status: 501 | 503; message: string; service: string; path: string; query: string }
function decide(state: MockState, choices: MockChoices, method: string, url: string): MockDecision // url is req.url, e.g. /mock/balena/v7/device?…
```

- [ ] **Step 1: Create the branch and the worktree.** Branch
  `feature/mock-server`, cut from `main`. Then `mkdir -p $CHECKS/out`.

- [ ] **Step 2: Write `$CHECKS/match.ts`.**

  ```ts
  const [balena] = toServices([{ name: 'balena', title: 'Balena', file: 'mocks/balena.yaml', hash: 'h', webhooks: [], endpoints: [
    { id: 'one', name: 'One device', method: 'GET', path: "/v7/device(uuid='*')", query: [], responses: [] },
    { id: 'fleet', name: 'Fleet', method: 'GET', path: '/v7/device', query: { $filter: 'belongs_to__application eq *' }, responses: [
      { id: 'three', name: 'Three', status: 200, headers: [], delayMs: 0, body: '{"d":[]}' },
      { id: 'empty', name: 'Empty', status: 200, headers: {}, delayMs: 0, body: '{"d":[]}' } ] },
    { id: 'any', name: 'Any', method: 'GET', path: '/v7/device', query: {}, responses: [] } ] }])
  assert.deepEqual(balena.endpoints[0].query, {})
  assert.deepEqual(balena.endpoints[1].responses[0].headers, {})

  assert.ok(globMatches('belongs_to__application eq *', 'belongs_to__application eq 1876543'))
  assert.ok(!globMatches('belongs_to__application eq *', 'is_online eq true'))
  assert.ok(globMatches("/v7/device(uuid='*')", "/v7/device(uuid='4f1c')"))
  assert.ok(globMatches('a.b', 'a.b') && !globMatches('a.b', 'aXb'))
  assert.ok(!globMatches('/v7/device', '/v7/device/extra'))

  const balenaQuery = new URLSearchParams('$filter=belongs_to__application%20eq%201876543&$select=id,uuid')
  assert.equal(matchEndpoint(balena.endpoints, 'GET', '/v7/device', balenaQuery)?.id, 'fleet')
  assert.equal(matchEndpoint(balena.endpoints, 'get', '/v7/device', balenaQuery)?.id, 'fleet')
  assert.equal(matchEndpoint(balena.endpoints, 'GET', '/v7/device', new URLSearchParams('$filter=is_online%20eq%20true'))?.id, 'any')
  assert.equal(matchEndpoint(balena.endpoints, 'POST', '/v7/device', balenaQuery), null)

  const fleet = balena.endpoints[1]
  assert.equal(activeResponse('balena', fleet, {})?.id, 'three')
  assert.equal(activeResponse('balena', fleet, { [choiceKey('balena', 'fleet')]: 'empty' })?.id, 'empty')
  assert.equal(activeResponse('balena', fleet, { [choiceKey('balena', 'fleet')]: 'gone' })?.id, 'three')
  assert.equal(activeResponse('balena', balena.endpoints[0], {}), null)
  console.log('ok')
  ```

- [ ] **Step 3: Write `$CHECKS/decide.ts`.** It uses the same `balena` fixture.

  ```ts
  const loaded = { ...EMPTY_STATE, services: [balena], directory: 'mocks', container: 'net-os_local-php-1', loadedAt: 1 }
  let d = decide(loaded, {}, 'GET', '/mock/balena/v7/device?$filter=belongs_to__application%20eq%201')
  assert.equal(d.kind, 'answer'); assert.equal(d.kind === 'answer' && d.response.id, 'three')
  d = decide(loaded, {}, 'GET', '/mock/balena/v7/device_tag')
  assert.deepEqual([d.kind, d.kind === 'refuse' && d.status], ['refuse', 501])
  assert.match(d.kind === 'refuse' ? d.message : '', /No mock for GET \/v7\/device_tag in balena/)
  d = decide(loaded, {}, 'GET', "/mock/balena/v7/device(uuid='x')")
  assert.match(d.kind === 'refuse' ? d.message : '', /One device has no responses/)
  d = decide(loaded, {}, 'GET', '/mock/stripe/v1/customers')
  assert.match(d.kind === 'refuse' ? `${d.status} ${d.message}` : '', /^501 No mock service 'stripe'\. Known: balena\.$/)
  d = decide(EMPTY_STATE, {}, 'GET', '/mock/balena/v7/device')
  assert.equal(d.kind === 'refuse' && d.status, 503)
  d = decide({ ...loaded, error: 'Docker was not found on this machine.' }, {}, 'GET', '/mock/balena/v7/device')
  assert.match(d.kind === 'refuse' ? `${d.status} ${d.message}` : '', /^503 .*Docker was not found/)

  for (const yes of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.65.1', '::ffff:192.168.65.1', '10.0.0.4', '172.17.0.1', '172.31.255.255', 'fd00::1'])
    assert.ok(isPrivateAddress(yes), yes)
  for (const no of [undefined, '8.8.8.8', '172.32.0.1', '::ffff:8.8.8.8', '2001:db8::1'])
    assert.ok(!isPrivateAddress(no), String(no))

  assert.deepEqual(withContentType({}, ' {"d":[]}'), { 'Content-Type': 'application/json' })
  assert.deepEqual(withContentType({}, '3'), { 'Content-Type': 'text/plain; charset=utf-8' })
  assert.deepEqual(withContentType({}, '{not json'), { 'Content-Type': 'text/plain; charset=utf-8' })
  assert.deepEqual(withContentType({ 'content-type': 'text/csv' }, '{}'), { 'content-type': 'text/csv' })
  console.log('ok')
  ```

- [ ] **Step 4: Run both checks.** Run `check match && check decide`.
  Expected: they fail to bundle, because the modules do not exist yet.

- [ ] **Step 5: Implement the eight files to the interfaces above.**
  - The `503` message for "never loaded" is
    `Mocks are not loaded. Open NetOS Debug and pick a container in Settings.`
  - A failed load answers `503` with `state.error` as the message.
  - `decide` keeps `path` without the `/mock/<service>` prefix (at least
    `/`), and `query` as the raw string after `?`.

- [ ] **Step 6: Run the checks, typecheck and build.** Run
  `check match && check decide && npm run typecheck && npm run build`.
  Expected: `ok`, `ok`, then exit 0.

- [ ] **Step 7: Commit.** Message: `feat: the mock model and how a call finds its answer`.

### Task 3: The mock server in main

**Files:**
- Create in `src/main/mocks/`: `mock-registry.ts`, `choices-store.ts`,
  `hit-log.ts`, `package-bridge.ts`, `mock-route.ts`, `mock-ipc.ts`.
- Modify `src/main/ray-server.ts`: a `mocks: MockRouteDeps` option, and a
  `path.startsWith('/mock/')` branch placed before `/api/`.
- Modify `src/main/index.ts`: build the pieces and pass them in.
- Modify `src/preload/index.ts`: the methods below.

**Interfaces:**
- **Consumes:** Task 2's types, `decide`, `toServices`, `toProblems` and
  `withContentType`; `readBody` from `src/main/read-body.ts`; `runDocker`;
  `sendToWindows`.
- **Produces:**

```ts
class MockRegistry { constructor(onChange: (state: MockState) => void); state(): MockState; replace(next: MockState): void }
class MockChoicesStore { constructor(file?: string /* userData/mock-choices.json */); all(): MockChoices; set(key: string, responseId: string): MockChoices }
class MockHitLog { constructor(max: number /* 200 */, publish: (hit: MockHit) => void); add(hit: Omit<MockHit, 'id'>): MockHit; all(): MockHit[]; clear(): void }

listMocks(containerId: string, workingDir: string): Promise<{ services: MockService[]; problems: MockProblem[]; directory: string; error: string | null }>
saveMockService(containerId: string, workingDir: string, service: MockService): Promise<{ file: string; hash: string | null; error: string | null }> // passes --hash when service.hash !== null
forgetMockService(containerId: string, workingDir: string, name: string, hash: string): Promise<{ error: string | null }>
readSecret(containerId: string, workingDir: string, key: string): Promise<{ secret: string | null; error: string | null }>

type MockRouteDeps = { state: () => MockState; choices: () => MockChoices; log: MockHitLog; now: () => number; wait: (ms: number) => Promise<void> }
mockRoute(req: IncomingMessage, res: ServerResponse, deps: MockRouteDeps): Promise<void>

registerMockIpc(deps: { registry: MockRegistry; choices: MockChoicesStore; log: MockHitLog; fire: (fire: WebhookFire) => Promise<WebhookOutcome> }): void
```

**IPC channels:**
- `mocks:load` `(containerId, workingDir, containerName) → MockState`. It
  calls `listMocks` and replaces the registry. On failure it keeps the
  services it had and sets `error`.
- `mocks:state → MockState`
- `mocks:save` `(containerId, workingDir, service)`. It calls
  `saveMockService` and then reloads, so the registry and the hash are fresh.
- `mocks:forget` `(containerId, workingDir, name, hash)`, which also reloads.
- `mocks:choices` (sync) `→ MockChoices`
- `mocks:choose` `(key, responseId) → MockChoices`
- `mocks:hits → MockHit[]`
- `mocks:hits:clear`
- `mocks:fire` is wired here to a stub that answers `{ sent: false, error: 'Not yet' }`.
  Task 4 replaces it.
- Pushed to the windows: `mocks:state` on every registry change, and
  `mocks:hit` on every hit.

**Preload** adds:

```ts
mocksLoad(containerId, workingDir, containerName): Promise<MockState>
mocksState(): Promise<MockState>
mocksSave(containerId, workingDir, service): Promise<{ file: string; hash: string | null; error: string | null }>
mocksForget(containerId, workingDir, name, hash): Promise<{ error: string | null }>
mocksChoices(): MockChoices
mocksChoose(key, responseId): Promise<MockChoices>
mocksHits(): Promise<MockHit[]>
mocksClearHits(): void
mocksFire(fire: WebhookFire): Promise<WebhookOutcome>
onMocksState(listener): () => void
onMockHit(listener): () => void
```

- [ ] **Step 1: Implement the three stateful classes and the bridge.**
  - The bridge follows `src/main/api/collections.ts` exactly: the last JSON
    line and a 30 s timeout. When the command answers nothing, the message is
    `The mocks command answered nothing. Mocks need net-os/laravel-netos-debug v0.3 or newer.`
  - `MockChoicesStore` follows `Environments`: the file lives in userData,
    with a 200 ms debounced save.

- [ ] **Step 2: Implement `mockRoute`.**
  - It refuses non-private callers with `403` and
    `{"message":"Mocks only answer this machine and its containers."}`.
  - It reads the body.
  - It calls `decide` with `req.method` and `req.url`.
  - For an answer, it waits `delayMs` and then writes the status, the
    response headers through `withContentType`, and the body.
  - For a refusal, it writes JSON `{"message"}`.
  - **The client gave up.** When `res.destroyed` or `req.socket.destroyed` is
    true after the wait, it writes nothing. The hit gets status 0 and the
    note `Client gave up before the answer`.
  - It always logs one hit, timed with `now()`.

- [ ] **Step 3: Wire main.** In `index.ts`:
  - build `MockRegistry` (its `onChange` pushes `mocks:state` through
    `sendToWindows`), `MockChoicesStore` and `MockHitLog` (its publish pushes
    `mocks:hit`);
  - pass `mocks` into `createRayServer`;
  - call `registerMockIpc`;
  - add the preload methods.

- [ ] **Step 4: Typecheck and build.** Run `npm run typecheck && npm run build`.
  Expected: exit 0.

- [ ] **Step 5: Check before anything is loaded.** Start `npm run dev`. Then,
  from the container:

  ```bash
  docker exec net-os_local-php-1 curl -s -w ' %{http_code}\n' http://host.docker.internal:23517/mock/balena/v7/device
  ```

  Expected: the "Mocks are not loaded…" message and `503`.

- [ ] **Step 6: Check with a loaded fixture.** Write a throwaway
  `mocks/plan-check.yaml` in the platform with `artisan netos-debug:mocks save`
  (Task 1, Step 6). It needs:
  - the `fleet` endpoint with responses `three` (200) and `hangs` (status
    503, `delayMs` 16000),
  - an endpoint `whoami` at `GET /user/v1/whoami`.

  Call `mocksLoad` from the DevTools console of the running app:
  `await window.ray.mocksLoad('<id>', '/var/www/html', 'net-os_local-php-1')`.
  Get the id from `await window.ray.tinkerContainers()`. Then:

  ```bash
  docker exec net-os_local-php-1 curl -s -i "http://host.docker.internal:23517/mock/plan-check/v7/device?\$filter=belongs_to__application%20eq%201"
  docker exec net-os_local-php-1 curl -s -w ' %{http_code}\n' http://host.docker.internal:23517/mock/plan-check/v7/device_tag
  ```

  Expected:
  - The first answers 200 with `Content-Type: application/json` and the body.
  - The second answers `501` and names the path.
  - `await window.ray.mocksHits()` lists both: the first with
    `endpointId: 'fleet'`, the second with `endpointId: null`.

- [ ] **Step 7: Check that a client giving up is handled.** Run
  `window.ray.mocksChoose('plan-check/fleet', 'hangs')`, then:

  ```bash
  docker exec net-os_local-php-1 curl -s -m 2 "http://host.docker.internal:23517/mock/plan-check/v7/device?\$filter=belongs_to__application%20eq%201"
  ```

  After 16 s, `mocksHits()` has a hit with status 0 and the note
  `Client gave up before the answer`, and the `npm run dev` terminal shows no
  error. Choose `three` again. Keep the fixture for Task 4.

- [ ] **Step 8: Commit.** Message: `feat: answer the platform's third-party calls from fixtures`.

### Task 4: Webhooks — signing and sending

**Files:**
- Create: `src/shared/mocks/local-host.ts`, `src/main/mocks/sign.ts`,
  `src/main/mocks/fire-webhook.ts`.
- Modify: `src/main/mocks/mock-ipc.ts`, so that `mocks:fire` calls
  `fireWebhook`.
- Checks: `$CHECKS/sign.ts`.

**Interfaces:**
- **Consumes:** `send(options: ApiSend): Promise<ApiResult>` from
  `src/main/api/send.ts`; Task 3's `readSecret`; Task 2's `withContentType`.
- **Produces:**

```ts
isLocalHost(url: string): boolean
signatureHeaders(signature: MockSignature, secret: string, body: string, nowSeconds: number): Record<string, string>
fireWebhook(fire: WebhookFire, deps: { readSecret: typeof readSecret; send: (o: ApiSend) => Promise<ApiResult>; now: () => number }): Promise<WebhookOutcome>
```

`fireWebhook` sends:
- `ApiSend` with `environmentId: ''`, `url: host + path`, `body` exactly
  `webhook.body`, `form: null`, `insecure: fire.insecure` and
  `timeoutMs: 30000`;
- headers: `withContentType(webhook.headers, body)` plus the signature
  headers.

It returns `edited: false`; the renderer sets it.

- [ ] **Step 1: Write `$CHECKS/sign.ts`.**

  ```ts
  const hmac = (s: string) => createHmac('sha256', 'whsec_local').update(s).digest('hex')
  const none: MockSignature = { kind: 'none', header: '', prefix: '', secretConfig: '' }
  const mollie: MockSignature = { kind: 'hmac-sha256', header: 'X-Mollie-Signature', prefix: 'sha256=', secretConfig: 'services.mollie.webhook_secret' }
  const stripe: MockSignature = { kind: 'stripe', header: '', prefix: '', secretConfig: 'cashier.webhook.secret' }
  const body = '{"id":"evt_1"}\n'
  assert.deepEqual(signatureHeaders(none, 'x', body, 1795167431), {})
  assert.deepEqual(signatureHeaders(mollie, 'whsec_local', body, 0), { 'X-Mollie-Signature': 'sha256=' + hmac(body) })
  assert.deepEqual(signatureHeaders(stripe, 'whsec_local', body, 1795167431), { 'Stripe-Signature': `t=1795167431,v1=${hmac('1795167431.' + body)}` })
  const crlf = '{"a":1}\r\n'
  assert.equal(signatureHeaders(mollie, 'whsec_local', crlf, 0)['X-Mollie-Signature'], 'sha256=' + hmac(crlf))

  for (const yes of ['https://api.net-os.test', 'http://localhost:8091', 'http://127.0.0.1', 'https://acme.net-os.test/x']) assert.ok(isLocalHost(yes), yes)
  for (const no of ['https://staging.net-os.com', 'https://net-os.test.evil.com', 'not a url', 'https://test']) assert.ok(!isLocalHost(no), no)

  const webhook: MockWebhook = { id: 'paid', name: 'Paid', method: 'POST', path: '/stripe/webhook', headers: {}, body, signature: stripe }
  const fire: WebhookFire = { containerId: 'c', workingDir: '/var/www/html', host: 'https://api.net-os.test', insecure: true, webhook }
  const okResult = { status: 200 } as ApiResult
  let sent: ApiSend | null = null
  const deps = { readSecret: async () => ({ secret: 'whsec_local', error: null }), send: async (o: ApiSend) => { sent = o; return okResult }, now: () => 1795167431000 }
  let out = await fireWebhook({ ...fire, host: 'https://staging.net-os.com' }, deps)
  assert.deepEqual([out.sent, sent], [false, null]); assert.match(out.error ?? '', /only go to the local stack/)
  out = await fireWebhook(fire, deps)
  assert.equal(out.sent, true); assert.equal(sent!.url, 'https://api.net-os.test/stripe/webhook'); assert.equal(sent!.body, body)
  assert.ok(sent!.headers.some((h) => h.key === 'Stripe-Signature' && h.value.startsWith('t=1795167431,v1=')))
  out = await fireWebhook(fire, { ...deps, readSecret: async () => ({ secret: null, error: 'cashier.webhook.secret is empty in this application.' }) })
  assert.deepEqual([out.sent, out.error], [false, 'cashier.webhook.secret is empty in this application.'])
  let asked = false
  await fireWebhook({ ...fire, webhook: { ...webhook, signature: none } }, { ...deps, readSecret: async () => { asked = true; return { secret: 'x', error: null } } })
  assert.equal(asked, false)
  console.log('ok')
  ```

- [ ] **Step 2: Run it.** Run `check sign`. Expected: it fails to bundle.

- [ ] **Step 3: Implement the three files.** The refusal message is
  `Webhooks only go to the local stack: localhost, 127.0.0.1 or a .test host.`
  Wire `mocks:fire` with the real `readSecret`, `send` and `Date.now`.

- [ ] **Step 4: Run the check, typecheck and build.** Run
  `check sign && npm run typecheck && npm run build`. Expected: `ok`, then
  exit 0.

- [ ] **Step 5: Send a real one.** From DevTools, fire a webhook of kind
  `hmac-sha256` with `secretConfig: 'app.key'` and path `/up`, at
  `https://api.net-os.test` with `insecure: true`. Expected:
  - `sent: true` with a status from the app;
  - the Requests view shows the incoming `POST /up` with the
    `X-Netos-Debug-Id` that `send()` adds.

  Then delete the throwaway fixture with `forget`.

- [ ] **Step 6: Commit.** Message: `feat: sign and send webhooks to the local stack`.

### Task 5: The Mocks module — data, service list and service bar

**Files:**
- Create in `src/renderer/src/mocks/`: `use-mocks.ts`, `use-mock-editor.ts`,
  `edit-service.ts`, `mocks-view.tsx`, `service-bar.tsx`,
  `service-list.tsx`.
- Modify:
  - `src/renderer/src/chrome/view-nav.tsx`: `'mocks'` in `View`, and a
    module `{ key: 'mocks', label: 'Mocks', hint: 'Fake third-party APIs', group: 'Build' }`
    placed after API.
  - `src/renderer/src/chrome/module-icons.tsx`: the Heroicons beaker
    outline path from the mockup's rail.
  - `src/renderer/src/app.tsx`: `const mocks = useMocks(tinker.container)`,
    and the route `view === 'mocks'`.
  - `src/renderer/src/app.css`: a `.mk-*` block, built from the existing
    tokens.
- Check: `$CHECKS/edit.ts`.

**Interfaces:**
- **Consumes:** Task 3's preload methods; `TinkerContainer`;
  `ApiEnvironment` (`api.environment`).
- **Produces:**

```ts
// edit-service.ts — pure, never mutates its input
slug(text: string): string
uniqueId(base: string, taken: string[]): string
newService(title: string, existing: MockService[]): MockService // hash null, file '', no endpoints or webhooks
addEndpoint(s: MockService, method: string, path: string, name: string): { service: MockService; endpointId: string } // starts with one response { id 'ok', name 'OK', status 200, headers {}, delayMs 0, body '' }
updateEndpoint(s, endpointId, patch: Partial<Omit<MockEndpoint, 'id' | 'responses'>>): MockService
removeEndpoint(s, endpointId): MockService
moveEndpoint(s, from: number, to: number): MockService
addResponse(s, endpointId, name): { service: MockService; responseId: string }
updateResponse(s, endpointId, responseId, patch: Partial<Omit<MockResponse, 'id'>>): MockService
removeResponse(s, endpointId, responseId): MockService
addWebhook(s, name): { service: MockService; webhookId: string } // POST, path '/', headers {}, body '', signature none
updateWebhook(s, webhookId, patch: Partial<Omit<MockWebhook, 'id'>>): MockService
removeWebhook(s, webhookId): MockService

// use-mocks.ts — owned by App, like useHttpClient
type MocksData = ReturnType<typeof useMocks>
useMocks(container: TinkerContainer | null): {
  state: MockState; hits: MockHit[]; sends: WebhookOutcome[]; choices: MockChoices; busy: boolean
  load(): Promise<void>
  save(service: MockService): Promise<string | null> // error, or null when saved
  forget(service: MockService): Promise<string | null>
  choose(service: string, endpointId: string, responseId: string): void
  fire(webhook: MockWebhook, environment: ApiEnvironment | null, edited: boolean): Promise<WebhookOutcome>
  clearHits(): void
}

// use-mock-editor.ts
type MockSelection = { service: string; kind: 'endpoint' | 'webhook'; id: string } | { service: string; kind: 'service' } | null
useMockEditor(mocks: MocksData): {
  selection: MockSelection; select(next: MockSelection): void
  draft: MockService | null; dirty: boolean
  edit(change: (s: MockService) => MockService): void; discard(): void; save(): Promise<string | null>
}
```

`useMocks` loads in three cases:
- when the container changes;
- on `window` `focus`, when the last load was more than 2 s ago;
- after `save` and `forget`, through main.

`useMockEditor` asks `window.confirm('Discard unsaved changes?')` before
switching away from a dirty draft.

- [ ] **Step 1: Write `$CHECKS/edit.ts`.**

  ```ts
  assert.equal(slug('Devices of a fleet!'), 'devices-of-a-fleet')
  assert.equal(uniqueId('three-online', ['three-online', 'three-online-2']), 'three-online-3')
  let s = newService('Balena', [])
  assert.deepEqual([s.name, s.title, s.hash, s.file], ['balena', 'Balena', null, ''])
  assert.equal(newService('Balena', [s]).name, 'balena-2')
  const frozen = s
  let r = addEndpoint(s, 'GET', '/v7/device', 'Devices of a fleet'); s = r.service
  assert.equal(frozen.endpoints.length, 0)
  assert.equal(r.endpointId, 'devices-of-a-fleet')
  assert.deepEqual(s.endpoints[0].responses, [{ id: 'ok', name: 'OK', status: 200, headers: {}, delayMs: 0, body: '' }])
  s = addEndpoint(s, 'POST', '/supervisor/v1/reboot', 'Reboot').service
  s = moveEndpoint(s, 1, 0); assert.deepEqual(s.endpoints.map((e) => e.id), ['reboot', 'devices-of-a-fleet'])
  s = removeEndpoint(s, 'reboot'); assert.equal(s.endpoints.length, 1)
  const added = addResponse(s, 'devices-of-a-fleet', 'Rate limited'); assert.equal(added.responseId, 'rate-limited')
  s = updateResponse(added.service, 'devices-of-a-fleet', 'rate-limited', { status: 429, headers: { 'Retry-After': '30' } })
  assert.equal(s.endpoints[0].responses[1].status, 429)
  assert.equal(updateEndpoint(s, 'devices-of-a-fleet', { name: 'Fleet devices' }).endpoints[0].id, 'devices-of-a-fleet')
  const w = addWebhook(s, 'Device online'); assert.equal(w.webhookId, 'device-online')
  assert.equal(w.service.webhooks[0].signature.kind, 'none')
  console.log('ok')
  ```

- [ ] **Step 2: Run it.** Run `check edit`. Expected: it fails to bundle.

- [ ] **Step 3: Implement `edit-service.ts`.** Run `check edit`. Expected:
  `ok`.

- [ ] **Step 4: Implement the hooks and the first screens.**
  - `useMocks`, `useMockEditor` and the nav entry.
  - `MocksView`, laid out as in the mockup's "Mocks — endpoint and
    responses" artboard: the service bar on top; the service list on the
    left, 264 px, the same width as `.api-side`; a placeholder middle and
    right for now.
  - **`ServiceBar`** shows for the selected service:
    - the title, editable;
    - the `.env` line, with a Copy button that uses `window.ray.copy`. For
      `balena` the line is
      `BALENA_API_URL=http://host.docker.internal:23517/mock/balena`. For any
      other service it is the bare URL
      `http://host.docker.internal:23517/mock/<name>`.
    - `<file> from <container> · loaded <relative time>`, using the existing
      `relative-time.ts`;
    - a Reload icon button;
    - Delete service (an icon button, with a confirm), which calls
      `mocks.forget`.
  - **`ServiceList`** groups each service's endpoints (method colour from
    `methodColor`) and webhooks. It has:
    - Add endpoint, Add webhook and New service;
    - one row per `problems` entry, in error colour, naming the file and the
      error;
    - "First match wins" next to the label.

- [ ] **Step 5: Typecheck and build.** Run `npm run typecheck && npm run build`.
  Expected: exit 0.

- [ ] **Step 6: Hands-on check.** With `npm run dev` and a throwaway
  `mocks/plan-check.yaml` plus a broken `mocks/broken.yaml` in the platform
  (as in Task 1, Step 6):
  - Mocks is in the rail under Build, after API.
  - The list shows Plan check with its endpoints, and a problem row for
    `broken.yaml`.
  - Editing the YAML by hand and focusing the window again updates the list.

  Remove `broken.yaml`.

- [ ] **Step 7: Commit.** Message: `feat: a Mocks module with the services and where to point them`.

### Task 6: Endpoints, responses and the call log

**Files:**
- Create in `src/renderer/src/mocks/`: `endpoint-editor.tsx`,
  `response-list.tsx`, `response-editor.tsx`, `hit-log.tsx`,
  `json-tokens.ts`.
- Create: `src/renderer/src/http-client/headers.tsx`, moved out of
  `call-detail.tsx`.
- Modify: `mocks-view.tsx`, `service-list.tsx` (drag to reorder),
  `src/renderer/src/http-client/call-detail.tsx` (imports `Headers`),
  `app.css`.

**Interfaces:**
- **Consumes:** `useMockEditor`, `edit-service.ts`, `activeResponse`,
  `choiceKey`, `CodeEditor` (`src/renderer/src/ui/code-editor.tsx`),
  `PairRows` (`src/renderer/src/api/pair-rows.tsx`), `methodColor`,
  `statusColor` and `statusBackground`.
- **Produces:** `tokenizeJson(line: string): EditorToken[]`, which colours
  keys, strings (`--dump-string`), numbers (`--dump-number`) and
  `true`/`false`/`null` (`--dump-const`).

The layout follows the mockup.

**Endpoint editor**
- The name, in a borderless field.
- An "Unsaved changes" dot, Delete (icon, with a confirm), Discard and Save
  (primary).
- A method picker and a path field.
- "Match when the query has": key and value rows, with the hint
  "`*` matches anything. Other query parameters are ignored."

**Responses**
- A two-column grid of radio cards: the name, a summary line, and a status
  chip.
- Picking a radio calls `mocks.choose`. That works without saving, because
  the choice is per developer.
- The hint below the grid reads
  "The active response is yours alone. Switching it never changes the file."

**Response editor** (the selected response)
- The name, status, and delay in ms.
- Body and Headers tabs. The body uses `CodeEditor` with `tokenizeJson`; the
  headers use `PairRows`.

**Hit log** (right column, at most 360 px)
- A "This endpoint / All of <title>" toggle.
- Each row shows the time, the method, the status chip, the path and query,
  and the response name (or `No mock` in error colour).
- A no-mock row has an **Add endpoint** button. It calls `addEndpoint` with
  the hit's method, path and decoded query.
- A hit with a `note` shows the note.
- Clicking a hit expands its request headers and body. Credential headers are
  masked with the HTTP view's own rule: move `SECRET`, `redacted()` and
  `Headers` out of `call-detail.tsx` into
  `src/renderer/src/http-client/headers.tsx`, and use them from both places.

- [ ] **Step 1: Write `tokenizeJson`.** Add a case to `$CHECKS/edit.ts`:

  ```ts
  assert.deepEqual(tokenizeJson('  "id": 1043,').map((t) => t.text).join(''), '  "id": 1043,')
  ```

  The tokens put the line back together exactly.

- [ ] **Step 2: Build the editor, the response list, the response editor and
  the hit log.** Wire them in `MocksView`.

- [ ] **Step 3: Add drag-to-reorder.** Use HTML drag events on a grip in
  `ServiceList`; a drop calls `moveEndpoint`. No library.

- [ ] **Step 4: Typecheck and build.** Run `npm run typecheck && npm run build`.
  Expected: exit 0.

- [ ] **Step 5: Hands-on check: editing.** With the throwaway fixture:
  - Add a response "Rate limited" with status 429 and a
    `Retry-After: 30` header, then save. The YAML in the platform shows it,
    with `body` as a literal block.
  - Pick "Rate limited". A `curl` from the container returns 429 at once,
    with no save and no change in `git status` of the monorepo.
  - Reorder two endpoints and save. The YAML order follows.
  - An unknown path shows in the log as `No mock`. Its **Add endpoint**
    creates a prefilled endpoint.

- [ ] **Step 6: Hands-on check: a stale save.** Edit a response in the app
  without saving. Change the same YAML file by hand. Press Save. The app
  shows `mocks/plan-check.yaml changed on disk. Reload, then save again.`,
  and the draft is still there.

- [ ] **Step 7: Commit.** Message: `feat: edit endpoints and responses, and see every call`.

### Task 7: The webhook editor

**Files:**
- Create: `src/renderer/src/mocks/webhook-editor.tsx`,
  `src/renderer/src/mocks/send-log.tsx`.
- Modify: `mocks-view.tsx`, `use-mock-editor.ts`, `app.css`, and `app.tsx`
  (pass `api.environment` into `MocksView`).

**Interfaces:**
- **Consumes:** `mocks.fire`, `isLocalHost`, `useMockEditor`, and the API
  tab's `api.environment: ApiEnvironment | null`.
- **Produces:** `useMockEditor` gains:

```ts
oneOffBody: string | null
setOneOffBody(body: string | null): void
saveOneOff(): void // writes oneOffBody into the draft webhook and clears it
```

The layout follows the mockup's "Mocks — send a webhook" artboard.

**Webhook editor**
- The name, Delete, and **Send** (primary, with the `⌘↵` hint).
- A method picker. The path field carries the environment host as a fixed
  prefix.
- A "Local only" chip.
- **Send is disabled** when `!isLocalHost(environment.host)`. Its title then
  reads
  `Webhooks only go to the local stack. Pick Local in the API tab.`
- **The signature panel:**
  - a kind picker: None, HMAC-SHA256, Stripe;
  - for HMAC-SHA256, header and prefix fields;
  - "Secret from config", the `secretConfig` field;
  - one line on what happens: "Signed at send time, over the exact body that
    goes out."
- **The body:**
  - Editing it starts a one-off edit, shown by the yellow bar "Edited for
    this send only. The file keeps the original." with Revert and Save to
    file.
  - **Send** uses the one-off body when there is one, and passes
    `edited: true`.

**Send log** (right column, when a webhook is selected)
- The newest sends first: time, status chip or "Not sent", duration, and
  "Edited body" when edited.
- An "Open in Requests" link with `result.debugId`. `MocksView` gets
  `onOpenInRequests: ((debugId: string) => void) | null` from `app.tsx`: the
  same callback `ApiView` receives.
- A refusal shows the error text in error colour.

- [ ] **Step 1: Build the editor and the send log.** Add `⌘↵` to send, the
  same way the API view registers its shortcut.

- [ ] **Step 2: Typecheck and build.** Run `npm run typecheck && npm run build`.
  Expected: exit 0.

- [ ] **Step 3: Hands-on check.** Add a webhook to the throwaway fixture: path
  `/up`, kind HMAC-SHA256, header `X-Signature`, prefix `sha256=`, secret
  config `app.key`.
  - Send it with Local selected in the API tab. The send log shows a status,
    and "Open in Requests" opens the incoming request.
  - Edit the body and send again: "Edited body", and the file is unchanged.
  - Set the secret config to `app.nothing`. Send shows
    `app.nothing is empty in this application.`
  - Pick a non-local environment in the API tab. Send is disabled.

- [ ] **Step 4: Commit.** Message: `feat: send signed webhooks from the Mocks view`.

### Task 8: Save as mock, from the HTTP view

**Files:**
- Create: `src/renderer/src/mocks/from-call.ts`,
  `src/renderer/src/mocks/save-as-mock-dialog.tsx`.
- Modify:
  - `src/renderer/src/http-client/call-detail.tsx`: Actions gets an
    `onSaveAsMock` button next to Copy as cURL.
  - `src/renderer/src/http-client/http-view.tsx`: it takes `mocks: MocksData`
    and holds the dialog.
  - `app.tsx`: pass `mocks`.
  - `app.css`.
- Check: `$CHECKS/from-call.ts`.

**Interfaces:**
- **Consumes:** `OutgoingCall`, `matchEndpoint`, `edit-service.ts`, and
  `mocks.save`.
- **Produces:**

```ts
TRANSPORT_HEADERS: readonly string[] // date, content-length, connection, transfer-encoding, keep-alive
isTruncated(body: string): boolean
responseFromCall(call: OutgoingCall, name: string, takenIds: string[]): { response: MockResponse; dropped: string[] }
endpointFor(services: MockService[], call: OutgoingCall): { service: string; endpointId: string } | null // path and query come from new URL(call.url)
endpointFromCall(call: OutgoingCall, takenIds: string[]): MockEndpoint // id slug(`${method} ${path}`), name `${method} ${path}`, query decoded, responses []
```

- [ ] **Step 1: Write `$CHECKS/from-call.ts`.** `balena` is the fixture from
  `match.ts`; `base` is a full `OutgoingCall` with empty fields.

  ```ts
  const call: OutgoingCall = { ...base, method: 'GET', url: 'https://api.balena-cloud.com/v7/device?$filter=belongs_to__application%20eq%201876543', status: 200,
    responseHeaders: [ { key: 'Content-Type', value: 'application/json' }, { key: 'Date', value: 'Fri, 20 Nov 2026 09:00:00 GMT' }, { key: 'content-length', value: '6400' }, { key: 'Connection', value: 'keep-alive' }, { key: 'X-Balena-Session', value: '‹redacted, 31 characters›' } ],
    responseBody: '{"d":[]}' }
  const { response, dropped } = responseFromCall(call, 'Two online', ['three-online'])
  assert.deepEqual(response, { id: 'two-online', name: 'Two online', status: 200, headers: { 'Content-Type': 'application/json' }, delayMs: 0, body: '{"d":[]}' })
  assert.deepEqual(dropped, ['Date', 'content-length', 'Connection', 'X-Balena-Session'])
  assert.ok(isTruncated('{"d":[\n\n‹truncated at 16384 bytes›'))
  assert.ok(!isTruncated('{"d":[]}'))
  assert.deepEqual(endpointFor([balena], call), { service: 'balena', endpointId: 'fleet' })
  assert.equal(endpointFor([balena], { ...call, method: 'DELETE' }), null)
  assert.deepEqual(endpointFromCall(call, []), { id: 'get-v7-device', name: 'GET /v7/device', method: 'GET', path: '/v7/device', query: { $filter: 'belongs_to__application eq 1876543' }, responses: [] })
  console.log('ok')
  ```

- [ ] **Step 2: Run it.** Run `check from-call`. Expected: it fails to
  bundle. Then implement `from-call.ts` and run it again. Expected: `ok`.

- [ ] **Step 3: Build the dialog.** It follows the mockup's "HTTP — save a
  call as mock" artboard. From top to bottom:
  - **Title** "Save as mock", with the call's method, URL, status and origin.
  - **Service picker**, preset from `endpointFor`. It also offers "New
    service…", which uses `newService`.
  - **Response name.**
  - **Endpoint:** a radio between the matched endpoint ("Matches this call")
    and "New endpoint", with the hint "Prefilled with this call's method,
    path and query. Swap a value for * to match more."
  - **Warning callout:** "This goes into git. Take real customer data out
    first: device names, UUIDs and tenant ids in variables."
  - **Body:** editable, in `CodeEditor`.
  - **Headers:** the kept headers, and the left-out ones struck through.
  - **Footer:** "Written through `netos-debug:mocks save`. Review it in the
    pull request." Then Cancel, and "Save to `<file>`".

  For a truncated body, the dialog replaces the body with
  `This body was cut at the package's limit. Raise netos-debug.http_client.max_body_bytes and record the call again.`,
  and disables Save. A save error shows inline, and the dialog stays open.

- [ ] **Step 4: Typecheck and build.** Run `npm run typecheck && npm run build`.
  Expected: exit 0.

- [ ] **Step 5: Hands-on check.** Point the platform at a real or
  local-reachable API through Laravel's `Http` client. With no Balena token,
  a tinker call such as `Http::get('https://httpbin.org/json')` is enough.
  - Open the call in HTTP and press **Save as mock** into the throwaway
    service as a new endpoint. The YAML gains it, and the left-out headers
    are not in it.
  - Repeat on a call whose body is over 16 KB, such as
    `Http::get('https://httpbin.org/range/20000')`. Save is disabled with the
    truncation message.

- [ ] **Step 6: Commit.** Message: `feat: save an outgoing call as a mock`.

### Task 9: Ship it

**Files:**
- Create: `changelog/2.5.0.md`, in the style of `changelog/2.4.0.md`, titled
  "Mocks".
- Modify: `README.md` in NetOS-ray (one short "Mocks" paragraph in the
  feature list).

- [ ] **Step 1: Write the changelog and the README paragraph.** Cover:
  - fixtures in the platform repository;
  - the `.env` line;
  - switching the active response;
  - webhooks signed and sent to the local stack;
  - Save as mock;
  - that the package needs `v0.3.0`;
  - that the worker and the scheduler need a restart after changing `.env`.

- [ ] **Step 2: End-to-end check by hand.** Use the platform with a throwaway
  `mocks/balena.yaml` that answers the device sync's calls, and set these in
  your own `.env` (not committed):
  - `BALENA_API_URL=http://host.docker.internal:23517/mock/balena`
  - a dummy `BALENA_API_TOKEN`
  - `BALENA_FLEET_IDS`

  Restart the worker and the scheduler. Then:
  - Run `artisan balena:sync-device-statuses`. It completes against the
    mock, and every call shows in the hit log.
  - Close NetOS-ray and run it again. It fails with "connection refused"
    and never reaches api.balena-cloud.com.

  Remove the throwaway fixture, and restore `.env`.

- [ ] **Step 3: Final checks.** NetOS-ray: run
  `npm run typecheck && npm run build`, then every check:
  `check match && check decide && check sign && check edit && check from-call`.
  Package: run `vendor/bin/pint --test && vendor/bin/phpstan analyse --no-progress`.
  Expected: everything passes.

- [ ] **Step 4: Ask Rick before releasing.** Releasing means:
  - merge `feature/mocks` into the package's `main`;
  - tag `v0.3.0`;
  - push both;
  - in the platform, change the constraint to `^0.3` and run
    `docker compose exec -T php composer update net-os/laravel-netos-debug`.

  Do none of it until Rick says go. Then run `composer install` in the
  platform to restore the vendored copy that `sync_pkg` overwrote, if it has
  not been updated.

- [ ] **Step 5: Commit.** Message: `docs: changelog and readme for mocks`.
  Hand the branch to superpowers:finishing-a-development-branch.
