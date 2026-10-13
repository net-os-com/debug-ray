import type { ErdPoint, ErdSaved, ErdSticky, ErdStored } from '../../shared/erd'
import { runDocker } from '../exec/run-docker'

const ERD_TIMEOUT_MS = 30_000

/**
 * Talks to the Laravel package, which owns the files. Same reasoning as
 * collections: the path stays configuration in the application rather than an
 * assumption compiled into this app, and the file lands in the bind mount that
 * git is watching.
 */
async function run(
  containerId: string,
  workingDir: string,
  action: string,
  input: string | null = null,
): Promise<Record<string, unknown>> {
  const result = await runDocker(
    [
      'exec',
      '-i',
      '-w',
      workingDir || '/var/www/html',
      containerId,
      'php',
      'artisan',
      'netos-debug:erd',
      action,
      '--no-interaction',
    ],
    input,
    ERD_TIMEOUT_MS,
    // Without this, Docker missing from PATH rejects all the way through the
    // IPC handler and the view reports nothing at all.
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  // The last JSON line, not the whole of stdout: a deprecation notice or an
  // Xdebug banner ahead of the answer would otherwise turn it into an error.
  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.trim().startsWith('{'))

  if (line === undefined) {
    return {
      error:
        result.stderr.trim() ||
        result.stdout.trim() ||
        'The erd command answered nothing. Is net-os/laravel-netos-debug installed?',
    }
  }

  try {
    const parsed: unknown = JSON.parse(line)

    // `null`, `[]` and `3` all parse; reading a field off any of them throws.
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { error: 'The erd command answered something unreadable.' }
  } catch {
    return { error: result.stderr.trim() || 'The erd command answered something unreadable.' }
  }
}

export async function readErd(containerId: string, workingDir: string): Promise<ErdStored> {
  const data = await run(containerId, workingDir, 'read')

  return {
    dbml: typeof data.dbml === 'string' ? data.dbml : '',
    stickies: Array.isArray(data.stickies) ? (data.stickies as ErdSticky[]) : [],
    layout:
      typeof data.layout === 'object' && data.layout !== null && !Array.isArray(data.layout)
        ? (data.layout as Record<string, ErdPoint>)
        : {},
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : null,
    error: typeof data.error === 'string' ? data.error : null,
  }
}

export async function saveErd(
  containerId: string,
  workingDir: string,
  dbml: string,
  layout: Record<string, ErdPoint>,
  stickies: ErdSticky[],
): Promise<ErdSaved> {
  const data = await run(containerId, workingDir, 'save', JSON.stringify({ dbml, layout, stickies }))

  return {
    files: Array.isArray(data.files) ? data.files.filter((one): one is string => typeof one === 'string') : [],
    error: typeof data.error === 'string' ? data.error : null,
  }
}
