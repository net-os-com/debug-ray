import { toProblems, toServices } from '../../shared/mocks/parse'
import type { MockProblem, MockService } from '../../shared/mocks/types'
import { runDocker } from '../exec/run-docker'

const MOCKS_TIMEOUT_MS = 30_000

/** Talks to the Laravel package, which owns the fixture files. */
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
      'netos-debug:mocks',
      ...args,
      '--no-interaction',
    ],
    input,
    MOCKS_TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const line = result.stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return {
      error:
        firstLine(result.stderr) ||
        'The mocks command answered nothing. Mocks need net-os/laravel-netos-debug v0.3 or newer.',
    }
  }

  try {
    return JSON.parse(line) as Record<string, unknown>
  } catch {
    return { error: 'The mocks command answered something that is not JSON.' }
  }
}

function errorOf(answer: Record<string, unknown>): string | null {
  return typeof answer.error === 'string' ? answer.error : null
}

export async function listMocks(
  containerId: string,
  workingDir: string,
): Promise<{ services: MockService[]; problems: MockProblem[]; directory: string; error: string | null }> {
  const answer = await run(containerId, workingDir, ['list'])

  return {
    services: toServices(answer.services),
    problems: toProblems(answer.problems),
    directory: typeof answer.directory === 'string' ? answer.directory : '',
    error: errorOf(answer),
  }
}

export async function saveMockService(
  containerId: string,
  workingDir: string,
  service: MockService,
): Promise<{ file: string; hash: string | null; error: string | null }> {
  const answer = await run(
    containerId,
    workingDir,
    ['save', ...(service.hash === null ? [] : [`--hash=${service.hash}`])],
    JSON.stringify(service),
  )

  return {
    file: typeof answer.file === 'string' ? answer.file : '',
    hash: typeof answer.hash === 'string' ? answer.hash : null,
    error: errorOf(answer),
  }
}

export async function forgetMockService(
  containerId: string,
  workingDir: string,
  name: string,
  hash: string,
): Promise<{ error: string | null }> {
  return { error: errorOf(await run(containerId, workingDir, ['forget', name, `--hash=${hash}`])) }
}

export async function readSecret(
  containerId: string,
  workingDir: string,
  key: string,
): Promise<{ secret: string | null; error: string | null }> {
  const answer = await run(containerId, workingDir, ['secret', key])

  return {
    secret: typeof answer.secret === 'string' ? answer.secret : null,
    error: errorOf(answer),
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}
