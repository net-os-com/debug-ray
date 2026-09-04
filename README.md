# NetOS Ray

A minimal Electron receiver for [spatie/ray](https://github.com/spatie/ray) payloads.
It speaks the same HTTP protocol the PHP client expects and renders everything it
receives — including Symfony `HtmlDumper` dumps — in one chronological stream.

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

## Scope

Deliberately simple: one flat stream, no screens, no per-payload colours, no
filtering. `ray()->clearAll()` clears the list; every other payload type renders,
falling back to raw JSON for types without a dedicated view
(`src/renderer/src/payload-view.tsx`).

All visual choices live in `src/renderer/src/tokens.css`.

## Two things to know

- The receiver binds `0.0.0.0` so Docker can reach it, which means anything on
  your network can post to it. Payload HTML is rendered as-is, the same way Ray
  itself does. Keep it off untrusted networks.
- `ray()->trace()` needs a booted Laravel app (`base_path()`); it works from the
  app, not from a bare `php -r` script.
