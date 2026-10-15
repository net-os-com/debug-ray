import type { SchemaTable } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'
import { schemaTables } from '../tools/schema'
import { phpBootstrap } from '../exec/bootstrap'

const MIGRATE_TIMEOUT_MS = 180_000

/**
 * The schema as the repository's migrations describe it, rather than as the
 * database happens to stand.
 *
 * It runs them rather than reading them: a migration is PHP and may branch,
 * loop or call a helper, so parsing it is a guess while running it is the
 * definition. The scratch database is created, migrated into, read and dropped
 * here, and is never one the application uses — the drop runs whatever
 * happened, so a migration that throws halfway leaves nothing behind.
 */
export async function schemaFromMigrations(
  containerId: string,
  workingDir: string,
): Promise<{ tables: SchemaTable[]; error: string | null }> {
  const root = workingDir || '/var/www/html'
  const database = `netos_debug_erd_${Math.random().toString(36).slice(2, 10)}`

  // The database name is changed ON the default connection rather than a second
  // connection being passed to `migrate --database`. That flag only sets the
  // default, and a migration that names its own connection — several packages'
  // do — would ignore it and run against the real database. Measured: the first
  // attempt failed with "Table horizon_new_dawn_batch_metadata already exists
  // (Database: default)", which is the application's own database saying it had
  // just been written to.
  const created = await php(
    containerId,
    root,
    `$__name = config('database.default');
Illuminate\\Support\\Facades\\DB::statement('CREATE DATABASE \`${database}\`');
config(['database.connections.' . $__name . '.database' => '${database}']);
Illuminate\\Support\\Facades\\DB::purge($__name);
Illuminate\\Support\\Facades\\Artisan::call('migrate', ['--force' => true]);
if (Illuminate\\Support\\Facades\\DB::connection()->getDatabaseName() !== '${database}') {
    throw new RuntimeException('Refusing to read: the connection is not pointed at the scratch database.');
}
echo 'MIGRATED';`,
  )

  if (!created.stdout.includes('MIGRATED')) {
    await drop(containerId, root, database)

    return {
      tables: [],
      error: summarise(`${created.stderr}\n${created.stdout}`) || 'The migrations did not run.',
    }
  }

  try {
    return { tables: await schemaTables(containerId, root, '', database), error: null }
  } finally {
    await drop(containerId, root, database)
  }
}

async function drop(containerId: string, root: string, database: string): Promise<void> {
  await php(
    containerId,
    root,
    `Illuminate\\Support\\Facades\\DB::statement('DROP DATABASE IF EXISTS \`${database}\`');`,
  )
}

function php(
  containerId: string,
  root: string,
  body: string,
): Promise<{ stdout: string; stderr: string }> {
  const program = `<?php
${phpBootstrap(root)}

${body}
`

  return runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program,
    MIGRATE_TIMEOUT_MS,
    // A failure here must read as an error, not reject through the IPC handler.
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))
}

/**
 * The headline of a failure, as a single line.
 *
 * Artisan renders an exception over several lines — the class, a blank line,
 * the message, another blank line, then the file — so the first line of it is
 * the bare class name. Three lines is what makes it say something.
 *
 * Both streams are read together because the two halves do not always arrive
 * on the same one: a migration that throws renders entirely to stdout, while a
 * query that fails during the setup puts "Illuminate\\Database\\QueryException"
 * on stderr and the SQL that caused it on stdout. Reading only the first
 * non-empty stream showed the class name and nothing else.
 */
function summarise(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, 3)
    .join(' · ')
}
