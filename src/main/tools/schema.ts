import type { SchemaTable } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const SCHEMA_TIMEOUT_MS = 60_000

/**
 * The tables on one connection, with their columns, indexes and keys.
 *
 * `db:show` and `db:table` answer the same question, but they answer it for
 * whichever database the connection points at when they run — and under
 * multi-database tenancy that is decided by the tenant, which those commands
 * have no way to take. Asking the schema builder directly does, and it returns
 * the same information the commands print.
 */
export async function schemaTables(
  containerId: string,
  workingDir: string,
  tenant: string,
): Promise<SchemaTable[]> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program(root, tenant),
    SCHEMA_TIMEOUT_MS,
  )

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('['))

  if (line === undefined) {
    return []
  }

  try {
    return JSON.parse(line) as SchemaTable[]
  } catch {
    return []
  }
}

export function program(root: string, tenant: string): string {
  const initialise =
    tenant === ''
      ? ''
      : `$__model = config('tenancy.tenant_model');
if (is_string($__model) && class_exists($__model)) {
    $__tenant = $__model::find(${JSON.stringify(tenant)});
    if ($__tenant !== null) { tenancy()->initialize($__tenant); }
}`

  return `<?php
require ${JSON.stringify(root)} . '/vendor/autoload.php';
$__app = require ${JSON.stringify(root)} . '/bootstrap/app.php';
$__app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

${initialise}

$__schema = Illuminate\\Support\\Facades\\Schema::getFacadeRoot();
$__database = Illuminate\\Support\\Facades\\DB::connection()->getDatabaseName();

// getTables() can see every schema the connection's user can, and root can see
// all of them — which under tenancy means the central tables turn up in a
// tenant's list.
$__tables = array_values(array_filter(
    $__schema->getTables(),
    fn (array $__t): bool => ($__t['schema'] ?? $__database) === $__database,
));

// TABLE_ROWS is the engine's own estimate. It is wrong by a few percent and it
// is instant; count(*) on two hundred tables is right and takes a minute.
$__counts = [];

try {
    foreach (Illuminate\\Support\\Facades\\DB::select(
        'select TABLE_NAME as t, TABLE_ROWS as n from information_schema.TABLES where TABLE_SCHEMA = ?',
        [$__database],
    ) as $__row) {
        $__counts[$__row->t] = (int) $__row->n;
    }
} catch (Throwable $__e) {
    // Not MySQL, or no access: the sizes still mean something without counts.
}

$__rows = [];

foreach ($__tables as $__table) {
    $__name = (string) $__table['name'];
    $__row = [
        'name' => $__name,
        'size' => (int) ($__table['size'] ?? 0),
        'rows' => $__counts[$__name] ?? null,
        'engine' => (string) ($__table['engine'] ?? ''),
        'columns' => [],
        'indexes' => [],
        'keys' => [],
        'error' => null,
    ];

    try {
        foreach ($__schema->getColumns($__name) as $__column) {
            $__row['columns'][] = [
                'name' => (string) $__column['name'],
                'type' => (string) $__column['type'],
                'nullable' => (bool) $__column['nullable'],
                'default' => $__column['default'] === null ? null : (string) $__column['default'],
                'autoIncrement' => (bool) ($__column['auto_increment'] ?? false),
            ];
        }

        foreach ($__schema->getIndexes($__name) as $__index) {
            $__row['indexes'][] = [
                'name' => (string) $__index['name'],
                'columns' => array_values((array) $__index['columns']),
                'unique' => (bool) $__index['unique'],
                'primary' => (bool) $__index['primary'],
            ];
        }

        foreach ($__schema->getForeignKeys($__name) as $__key) {
            $__row['keys'][] = [
                'columns' => array_values((array) $__key['columns']),
                'table' => (string) $__key['foreign_table'],
                'foreignColumns' => array_values((array) $__key['foreign_columns']),
                'onDelete' => (string) ($__key['on_delete'] ?? ''),
            ];
        }
    } catch (Throwable $__e) {
        $__row['error'] = class_basename($__e) . ': ' . mb_strimwidth($__e->getMessage(), 0, 120, '…');
    }

    $__rows[] = $__row;
}

usort($__rows, fn (array $a, array $b): int => strcmp($a['name'], $b['name']));

echo json_encode($__rows), "\\n";
`
}
