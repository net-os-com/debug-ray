import type { ScoutIndex } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const SCOUT_TIMEOUT_MS = 60_000

/**
 * Compares what is in the database with what the search engine has.
 *
 * Under multi-database tenancy both sides are per tenant, so this only means
 * anything with a tenant chosen: the models live in that tenant's database and
 * the index name is derived from it.
 */
export async function scoutIndexes(
  containerId: string,
  workingDir: string,
  tenant: string,
): Promise<ScoutIndex[]> {
  const result = await runDocker(
    ['exec', '-i', '-w', workingDir || '/var/www/html', containerId, 'php'],
    program(workingDir || '/var/www/html', tenant),
    SCOUT_TIMEOUT_MS,
  )

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('['))

  if (line === undefined) {
    return []
  }

  try {
    return JSON.parse(line) as ScoutIndex[]
  } catch {
    return []
  }
}

function program(root: string, tenant: string): string {
  const initialise =
    tenant === ''
      ? ''
      : `$__tenantModel = config('tenancy.tenant_model');
if (is_string($__tenantModel) && class_exists($__tenantModel)) {
    $__tenant = $__tenantModel::find(${JSON.stringify(tenant)});
    if ($__tenant !== null) { tenancy()->initialize($__tenant); }
}`

  return `<?php
require ${JSON.stringify(root)} . '/vendor/autoload.php';
$__app = require ${JSON.stringify(root)} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

${initialise}

if (! trait_exists(Laravel\\Scout\\Searchable::class)) {
    echo json_encode([]), "\\n";
    exit;
}

$__psr4 = require ${JSON.stringify(root)} . '/vendor/composer/autoload_psr4.php';
$__models = [];

// Only the application's own namespace, and only directories that exist:
// several packages register the App\\ prefix pointing at folders they ship
// without, and iterating one of those is a fatal error rather than an empty
// result.
foreach ((array) ($__psr4['App\\\\'] ?? []) as $__dir) {
    if (! is_dir($__dir)) {
        continue;
    }

    $__files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($__dir, FilesystemIterator::SKIP_DOTS),
    );

    foreach ($__files as $__file) {
        if ($__file->getExtension() !== 'php') {
            continue;
        }

        $__class = 'App\\\\' . str_replace('/', '\\\\', substr($__file->getPathname(), strlen(rtrim($__dir, '/')) + 1, -4));

        if (class_exists($__class) && in_array(Laravel\\Scout\\Searchable::class, class_uses_recursive($__class), true)) {
            $__models[$__class] = true;
        }
    }
}

$__rows = [];

foreach (array_keys($__models) as $__class) {
    $__row = [
        'model' => $__class,
        'index' => '',
        'db' => null,
        'indexed' => null,
        'approximate' => false,
        'indexing' => false,
        'error' => null,
    ];

    try {
        $__row['index'] = (new $__class())->searchableAs();
        $__row['db'] = $__class::count();

        // The engine's own tally, not a search result. A search reports
        // estimatedTotalHits, which Meilisearch caps at maxTotalHits — a
        // default of 1000 — so an index of five thousand documents reads as
        // exactly one thousand and every large model looks catastrophically
        // behind.
        if (class_exists(Meilisearch\\Client::class)) {
            $__stats = app(Meilisearch\\Client::class)->index($__row['index'])->stats();
            $__row['indexed'] = $__stats['numberOfDocuments'] ?? null;
            $__row['indexing'] = (bool) ($__stats['isIndexing'] ?? false);
        }

        if ($__row['indexed'] === null) {
            $__raw = $__class::search('')->raw();
            $__row['indexed'] = $__raw['estimatedTotalHits'] ?? $__raw['totalHits'] ?? $__raw['nbHits'] ?? null;
            $__row['approximate'] = $__row['indexed'] !== null;
        }
    } catch (Throwable $__e) {
        $__row['error'] = class_basename($__e) . ': ' . mb_strimwidth($__e->getMessage(), 0, 120, '…');
    }

    $__rows[] = $__row;
}

usort($__rows, fn (array $a, array $b): int => strcmp($a['model'], $b['model']));

echo json_encode($__rows), "\\n";
`
}
