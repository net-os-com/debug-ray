import { runDocker } from './run-docker'

/** Scanning sixteen thousand files is not something to do twice. */
const cache = new Map<string, string[]>()

const BUILD_TIMEOUT_MS = 30_000

/**
 * Every class the application could autoload, read from Composer's own PSR-4
 * roots and classmap.
 *
 * Deliberately does not boot the framework: this only needs the autoloader's
 * bookkeeping, and skipping the boot turns a three-second answer into a
 * one-second one.
 */
export async function classIndex(containerId: string, workingDir: string): Promise<string[]> {
  const cached = cache.get(containerId)

  if (cached !== undefined) {
    return cached
  }

  const result = await runDocker(
    ['exec', '-i', '-w', workingDir || '/var/www/html', containerId, 'php'],
    program(workingDir || '/var/www/html'),
    BUILD_TIMEOUT_MS,
  )

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('['))

  if (line === undefined) {
    return []
  }

  try {
    const classes = JSON.parse(line) as string[]

    cache.set(containerId, classes)

    return classes
  } catch {
    return []
  }
}

export function forgetClasses(): void {
  cache.clear()
}

function program(root: string): string {
  return `<?php
$root = ${JSON.stringify(root)};
$psr4 = @include $root . '/vendor/composer/autoload_psr4.php';
$classmap = @include $root . '/vendor/composer/autoload_classmap.php';

if (!is_array($psr4)) {
    echo json_encode([]), "\\n";
    exit;
}

$classes = [];

foreach ($psr4 as $prefix => $dirs) {
    foreach ((array) $dirs as $dir) {
        if (!is_dir($dir)) {
            continue;
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        );

        foreach ($files as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $relative = substr($file->getPathname(), strlen(rtrim($dir, '/')) + 1, -4);
            $classes[$prefix . str_replace('/', '\\\\', $relative)] = true;
        }
    }
}

if (is_array($classmap)) {
    foreach (array_keys($classmap) as $name) {
        $classes[$name] = true;
    }
}

echo json_encode(array_keys($classes)), "\\n";
`
}
