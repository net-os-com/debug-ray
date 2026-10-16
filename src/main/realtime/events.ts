import { runDocker } from '../exec/run-docker'

const TIMEOUT_MS = 30_000

/** Scanning the event directory is not worth doing twice per container. */
const cache = new Map<string, string[]>()

/**
 * The application's own broadcastable events, for the composer's suggestions.
 *
 * Only classes that implement `ShouldBroadcast` are offered. An event that does
 * not broadcast would be accepted by the composer and then never arrive, and a
 * list that suggests events the application cannot send is a list that teaches
 * the wrong thing.
 */
export async function broadcastEvents(containerId: string, workingDir: string): Promise<string[]> {
  const key = `${containerId}:${workingDir}`
  const cached = cache.get(key)

  if (cached !== undefined) {
    return cached
  }

  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    eventsProgram(root),
    TIMEOUT_MS,
  ).catch(() => null)

  const line = result?.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('['))

  if (line === undefined) {
    return []
  }

  try {
    const names = JSON.parse(line) as string[]

    cache.set(key, names)

    return names
  } catch {
    return []
  }
}

export function forgetBroadcastEvents(): void {
  cache.clear()
}

/** Exported for the shape test; nothing else should need it. */
export function eventsProgram(root: string): string {
  return `<?php
$__root = ${JSON.stringify(root)};

if (!is_file($__root . '/vendor/autoload.php')) {
    echo json_encode([]), "\\n";
    exit;
}

require $__root . '/vendor/autoload.php';

$__dir = $__root . '/app/Events';

if (!is_dir($__dir)) {
    echo json_encode([]), "\\n";
    exit;
}

$__found = [];
$__files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($__dir));

foreach ($__files as $__file) {
    if ($__file->isDir() || $__file->getExtension() !== 'php') {
        continue;
    }

    $__relative = substr($__file->getPathname(), strlen($__root . '/app/') , -4);
    $__class = 'App\\\\' . str_replace('/', '\\\\', $__relative);

    // class_exists autoloads, which runs the file. Events are declarations, so
    // that is safe here in a way it would not be for the whole application.
    try {
        if (!class_exists($__class)) {
            continue;
        }
    } catch (Throwable $__e) {
        continue;
    }

    $__implements = class_implements($__class) ?: [];

    if (isset($__implements['Illuminate\\\\Contracts\\\\Broadcasting\\\\ShouldBroadcast'])) {
        $__found[] = $__class;
    }
}

sort($__found);

echo json_encode(array_values($__found)), "\\n";
`
}
