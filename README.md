# NetOS Ray

An Electron receiver for [spatie/ray](https://github.com/spatie/ray) payloads,
built to the "NetOS Debug Console" Claude Design canvas. It speaks the HTTP
protocol the PHP client expects and renders what it receives — including
Symfony `HtmlDumper` dumps — as a filterable stream with a detail panel.

## Run

```bash
npm install
npm run dev     # electron-vite dev, with renderer HMR
npm run build   # production build into out/
npm run start   # run the production build
```

The receiver listens on `0.0.0.0:23517`. Override with `RAY_HOST` / `RAY_PORT`.

## Point the Laravel app at it

`spatie/ray` reads its host and port from a `ray.php` config file only — there is
no environment fallback without one. In `laravel/server`:

```bash
php artisan ray:publish-config --docker
```

That writes `config/ray.php` with `'host' => env('RAY_HOST', 'host.docker.internal')`,
which is what a container needs to reach the app on the host. For PHP running
directly on the host, set `RAY_HOST=localhost`.

## Protocol notes

The endpoints in `src/main/routes/` mirror `vendor/spatie/ray/src/Client.php`:

- `GET /_availability_check` returns **404** on purpose. The client sets
  `CURLOPT_FAILONERROR` and reads an HTTP error as "a Ray app is listening";
  answering 200 makes it drop every payload.
- `POST /` carries `{ uuid, payloads[], meta }`. Each payload becomes one row.
- `GET /locks/:name` always reports the lock released, so `ray()->pause()` does
  not block the PHP process.
- `GET /windows` and `GET /theme` return empty stubs.

## Build a DMG

```bash
npm run dist
```

Writes `dist/NetOS Debug-<version>-arm64.dmg` (arm64, unsigned — see
`electron-builder.yml`). `dist/` is gitignored; the DMG belongs on a GitHub
release, not in the repo.

The packaged bundle carries `CFBundleName = NetOS Debug`, so the process name is
right there too.

### Opening a downloaded build

The build is unsigned, and macOS quarantines anything downloaded from a browser.
After dragging the app to Applications:

```bash
xattr -dr com.apple.quarantine "/Applications/NetOS Debug.app"
```

Signing and notarising with a Developer ID removes that step; set `mac.identity`
in `electron-builder.yml` and add the notarize credentials.

## App name

`productName` in `package.json` plus `app.setName()` at load time give the menu
bar, the About panel and the window title "NetOS Debug".

macOS still reports the *process* as "Electron" — in the dock tooltip, the
Force Quit list and Activity Monitor. That name is `CFBundleName` inside the
vendored `node_modules/electron/dist/Electron.app`, so only a packaged build
fixes it. Add a packager (electron-builder reads `productName` and `mac.icon`)
if that matters.

## App icon

`resources/icon.icns` and `resources/icon.png` are generated from the
"NetOS Debug App Icon" canvas:

```bash
npm run icon
```

`build/icon/icon.html` is the 1024x1024 source (824px squircle inset by 100px,
leaving that margin for the baked shadow, per Apple's icon grid).
`build/icon/render.mjs` renders it in an offscreen Electron window and builds the
iconset with `sips` and `iconutil`, so what ships is exactly the CSS rendering.

Following the canvas' own note, the two mark bars use the gradient fills at 256px
and up, and flat 55% fills at 128px and below so the mark still reads at 32px.

The dock icon is set at runtime because an unpackaged macOS app otherwise shows
Electron's own. A packaged build takes the icon from the bundle instead — point
your packager at `resources/icon.icns` (electron-builder: `mac.icon`).

## How ray concepts map to the UI

- **Sources** are `origin.hostname`, so the host and each container appear
  separately. The rail shows `meta.project_name`.
- **Types** are the eight kinds from the design, derived from the payload type.
  A `log` payload counts as `dump` when its value is a var-dump.
- **Labels and colours** (`ray()->label()`, `ray()->green()`) arrive as their own
  payloads reusing the request uuid. Ray attaches them to the entry rather than
  listing them, so they become the row's label pill and stripe colour.
- **Connected clients** in Settings are derived from who has posted recently;
  ray has no handshake.
- `ray()->clearAll()` clears the stream. Unknown payload types still show up,
  as raw JSON.

**Pause buffers rather than drops.** The canvas simply skips events while
paused; silently losing payloads in a debug tool is worse than holding them, so
incoming events queue up and the Resume button shows the count.

## Not built

- Grouping by request (`uuid`), the canvas' "Group by request" toggle.
- "Open in editor" and "Bookmark" in the detail panel.
- Screens (`ray()->newScreen()`) — everything lands in one stream.
- Host Grotesk is not bundled; the font stack falls back to Inter and system-ui.
  Add the `.otf` files and `@font-face` rules in `tokens.css` for the real face.

## Two things to know

- The receiver binds `0.0.0.0` so Docker can reach it, which means anything on
  your network can post to it. Payload HTML is rendered as-is, the same way Ray
  itself does. Keep it off untrusted networks; `RAY_HOST=127.0.0.1` locks it
  down but then containers can no longer reach it.
- `ray()->trace()` needs a booted Laravel app (`base_path()`); it works from the
  app, not from a bare `php -r` script.
