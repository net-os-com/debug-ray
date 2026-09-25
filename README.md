# Net OS Ray

An Electron receiver for [spatie/ray](https://github.com/spatie/ray) payloads.
It speaks the HTTP protocol the PHP client expects and renders what it receives
— including Symfony `HtmlDumper` dumps — as a filterable stream with a detail
panel, and turns every finished Laravel request into a debugbar-style Requests
view.

Built to the "NetOS Debug Console" Claude Design canvas.

## Install

Grab the latest DMG from [Releases](https://github.com/net-os-com/debug-ray/releases).
Builds are signed and notarised, so they open normally and update themselves —
**Check for Updates…** sits in the application menu.

To run from source instead:

```bash
npm install
npm run dev     # electron-vite dev, with renderer HMR
npm run build   # production build into out/
npm run start   # run the production build
```

The receiver listens on `0.0.0.0:23517`. Override with `RAY_HOST` / `RAY_PORT`.

## Point your Laravel app at it

`spatie/ray` reads its host and port from a `ray.php` config file only — there is
no environment fallback without one:

```bash
php artisan ray:publish-config --docker
```

That writes `config/ray.php` with `'host' => env('RAY_HOST', 'host.docker.internal')`,
which is what a container needs to reach the app on the host. For PHP running
directly on the host, set `RAY_HOST=localhost`.

That is enough for the Stream. The Requests view needs one more package,
[net-os/laravel-netos-debug](https://github.com/net-os-com/laravel-netos-debug),
which ships the full Debugbar payload of every finished request. It is not on
Packagist, so add the repository first:

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/net-os-com/laravel-netos-debug" }
]
```

```bash
composer require --dev net-os/laravel-netos-debug
```

It reads the host and port from the same `ray.php` and registers its own
middleware, so there is nothing else to wire up.

## Usage

- **[Stream](https://github.com/net-os-com/debug-ray/wiki/Stream)** — every
  `ray()` call as it arrives, filtered by source, type and label, with a detail
  panel and two copy buttons for handing a payload to Claude Code.
- **[Requests](https://github.com/net-os-com/debug-ray/wiki/Requests)** — one row
  per finished HTTP request, with its queries (including N+1 detection and
  `EXPLAIN`), timeline, route, events, cache and response.
- **[MCP server](https://github.com/net-os-com/debug-ray/wiki/MCP-server)** — let
  a Claude Code session read payloads itself. Settings carries the exact command
  for your checkout.

## Keep in mind

- The receiver binds `0.0.0.0` so Docker can reach it, which means anything on
  your network can post to it. Payload HTML is rendered as-is, the same way Ray
  itself does. Keep it off untrusted networks; `RAY_HOST=127.0.0.1` locks it
  down but then containers can no longer reach it.
- `ray()->trace()` needs a booted Laravel app (`base_path()`); it works from the
  app, not from a bare `php -r` script.

## Documentation

The [wiki](https://github.com/net-os-com/debug-ray/wiki) carries the long form:
the two views in detail, the
[ray protocol](https://github.com/net-os-com/debug-ray/wiki/Protocol-notes) this
app implements,
[releasing and signing](https://github.com/net-os-com/debug-ray/wiki/Releasing),
and where the
[app name and icon](https://github.com/net-os-com/debug-ray/wiki/App-name-and-icon)
come from.
