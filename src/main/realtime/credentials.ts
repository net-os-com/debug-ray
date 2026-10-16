import { NO_CREDENTIALS, type PusherCredentials } from '../../shared/realtime'
import { phpBootstrap } from '../exec/bootstrap'
import { runDocker } from '../exec/run-docker'

const TIMEOUT_MS = 30_000

/**
 * Reads the application's own broadcasting configuration.
 *
 * Through `config()` rather than by parsing `.env`, so a cached configuration
 * answers with what the application will actually use — a stack whose config is
 * cached has long stopped reading that file, and a debugger that disagreed with
 * the thing it is debugging would be worse than useless.
 *
 * The secret is deliberately not read. Nothing in this application needs it:
 * the socket authenticates with a user's token, and a broadcast is dispatched
 * inside the container by the application itself. Not asking for it is the only
 * way to be sure it is never written to a log, a preference file or a crash
 * report on this machine.
 */
export async function readCredentials(
  containerId: string,
  workingDir: string,
): Promise<PusherCredentials> {
  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', '-w', root, containerId, 'php'],
    program(root),
    TIMEOUT_MS,
  ).catch((error: Error) => ({ stdout: '', stderr: error.message, code: 1, timedOut: false }))

  const parsed = lastJson(result.stdout)

  if (parsed === null) {
    return {
      ...NO_CREDENTIALS,
      error: firstLine(result.stderr) || 'The broadcasting configuration could not be read.',
    }
  }

  return parsed
}

function lastJson(stdout: string): PusherCredentials | null {
  const line = stdout
    .split('\n')
    .reverse()
    .find((candidate) => candidate.startsWith('{'))

  if (line === undefined) {
    return null
  }

  try {
    return JSON.parse(line) as PusherCredentials
  } catch {
    return null
  }
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}

/** Exported for the shape test; nothing else should need it. */
export function credentialsProgram(root: string): string {
  return program(root)
}

function program(root: string): string {
  return `<?php
${phpBootstrap(root)}

$__pusher = config('broadcasting.connections.pusher') ?? [];
$__options = $__pusher['options'] ?? [];

echo json_encode([
    'driver' => (string) config('broadcasting.default'),
    'key' => (string) ($__pusher['key'] ?? ''),
    'cluster' => (string) ($__options['cluster'] ?? ''),
    'host' => (string) ($__options['host'] ?? ''),
    'port' => (int) ($__options['port'] ?? 443),
    'scheme' => (string) ($__options['scheme'] ?? 'https'),
    'error' => null,
]), "\\n";
`
}
