import type { ErdPoint, ErdSaved, ErdStored } from '../../shared/erd'
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
    ['exec', '-i', '-w', workingDir, containerId, 'php', 'artisan', 'netos-debug:erd', action],
    input,
    ERD_TIMEOUT_MS,
  )

  try {
    return JSON.parse(result.stdout.trim()) as Record<string, unknown>
  } catch {
    // Artisan writes its own errors to stdout as prose; anything unparseable is
    // reported as it arrived rather than swallowed into an empty diagram.
    return { error: result.stderr.trim() || result.stdout.trim() || 'The command returned nothing.' }
  }
}

export async function readErd(containerId: string, workingDir: string): Promise<ErdStored> {
  const data = await run(containerId, workingDir, 'read')

  return {
    layout: (data.layout as Record<string, ErdPoint> | undefined) ?? {},
    savedAt: (data.savedAt as string | null | undefined) ?? null,
    error: (data.error as string | null | undefined) ?? null,
  }
}

export async function saveErd(
  containerId: string,
  workingDir: string,
  dbml: string,
  layout: Record<string, ErdPoint>,
): Promise<ErdSaved> {
  const data = await run(containerId, workingDir, 'save', JSON.stringify({ dbml, layout }))

  return {
    files: (data.files as string[] | undefined) ?? [],
    error: (data.error as string | null | undefined) ?? null,
  }
}
