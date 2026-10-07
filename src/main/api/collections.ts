import type { CollectionSummary, SavedRequest } from '../../shared/api'
import { runDocker } from '../exec/run-docker'

const COLLECTIONS_TIMEOUT_MS = 30_000

/**
 * Talks to the Laravel package, which owns the files.
 *
 * The app knows about requests; the package knows where this project keeps its
 * repository and what an OpenAPI document should look like. Keeping the writing
 * on that side means the path is configuration in the application rather than
 * an assumption compiled into a desktop app, and the file lands inside the
 * container's bind mount, which is the same directory git is watching.
 */
async function run(
  containerId: string,
  workingDir: string,
  args: string[],
  input: string | null = null,
): Promise<Record<string, unknown>> {
  const result = await runDocker(
    [
      'exec',
      ...(input === null ? [] : ['-i']),
      '-w',
      workingDir || '/var/www/html',
      containerId,
      'php',
      'artisan',
      'netos-debug:collections',
      ...args,
      '--no-interaction',
    ],
    input,
    COLLECTIONS_TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return {
      error:
        firstLine(result.stderr) ||
        'The collections command answered nothing. Is net-os/laravel-netos-debug installed?',
    }
  }

  try {
    return JSON.parse(line) as Record<string, unknown>
  } catch {
    return { error: 'The collections command answered something that is not JSON.' }
  }
}

export async function listCollections(
  containerId: string,
  workingDir: string,
): Promise<{ collections: CollectionSummary[]; directory: string; error: string | null }> {
  const answer = await run(containerId, workingDir, ['list'])

  return {
    collections: Array.isArray(answer.collections) ? (answer.collections as CollectionSummary[]) : [],
    directory: typeof answer.directory === 'string' ? answer.directory : '',
    error: typeof answer.error === 'string' ? answer.error : null,
  }
}

export async function readCollection(
  containerId: string,
  workingDir: string,
  name: string,
): Promise<SavedRequest[]> {
  const answer = await run(containerId, workingDir, ['read', name])

  return Array.isArray(answer.requests) ? (answer.requests as SavedRequest[]) : []
}

export async function saveToCollection(
  containerId: string,
  workingDir: string,
  name: string,
  request: SavedRequest,
): Promise<{ file: string; operations: number; error: string | null }> {
  const answer = await run(containerId, workingDir, ['save', name], JSON.stringify(request))

  return {
    file: typeof answer.file === 'string' ? answer.file : '',
    operations: typeof answer.operations === 'number' ? answer.operations : 0,
    error: typeof answer.error === 'string' ? answer.error : null,
  }
}

export async function forgetInCollection(
  containerId: string,
  workingDir: string,
  name: string,
  operationId: string,
): Promise<{ file: string; operations: number; error: string | null }> {
  const answer = await run(containerId, workingDir, ['forget', name, operationId])

  return {
    file: typeof answer.file === 'string' ? answer.file : '',
    operations: typeof answer.operations === 'number' ? answer.operations : 0,
    error: typeof answer.error === 'string' ? answer.error : null,
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}
