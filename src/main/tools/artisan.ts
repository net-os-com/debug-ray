import type { ArtisanCommand } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

/** Every command, every argument: worth asking for once per container. */
const cache = new Map<string, ArtisanCommand[]>()

const LIST_TIMEOUT_MS = 60_000

/**
 * Options Symfony puts on every command. Showing them in a form would bury the
 * three that belong to the command you picked under eight that never vary.
 */
const GLOBAL_OPTIONS = new Set([
  '--help',
  '--quiet',
  '--verbose',
  '--version',
  '--ansi',
  '--no-ansi',
  '--no-interaction',
  '--env',
  '--silent',
])

type RawCommand = {
  name?: string
  description?: string
  hidden?: boolean
  definition?: {
    arguments?: Record<string, RawArgument>
    options?: Record<string, RawOption>
  }
}

type RawArgument = { name?: string; description?: string; is_required?: boolean; is_array?: boolean }
type RawOption = {
  name?: string
  description?: string
  accept_value?: boolean
  is_multiple?: boolean
}

export async function artisanCommands(
  containerId: string,
  workingDir: string,
): Promise<ArtisanCommand[]> {
  const cached = cache.get(containerId)

  if (cached !== undefined) {
    return cached
  }

  const result = await runDocker(
    [
      'exec',
      '-i',
      '-w',
      workingDir || '/var/www/html',
      containerId,
      'php',
      'artisan',
      'list',
      '--format=json',
      '--no-ansi',
    ],
    null,
    LIST_TIMEOUT_MS,
  )

  const start = result.stdout.indexOf('{')

  if (start === -1) {
    return []
  }

  try {
    const parsed = JSON.parse(result.stdout.slice(start)) as { commands?: RawCommand[] }
    const commands = (parsed.commands ?? [])
      .filter((command) => typeof command.name === 'string' && command.hidden !== true)
      .map(shape)
      .sort((a, b) => a.name.localeCompare(b.name))

    cache.set(containerId, commands)

    return commands
  } catch {
    return []
  }
}

export function forgetArtisan(): void {
  cache.clear()
}

function shape(command: RawCommand): ArtisanCommand {
  const args = Object.values(command.definition?.arguments ?? {})
  const options = Object.values(command.definition?.options ?? {})

  return {
    name: command.name as string,
    description: command.description ?? '',
    arguments: args.map((argument) => ({
      name: argument.name ?? '',
      description: argument.description ?? '',
      required: argument.is_required === true,
      array: argument.is_array === true,
    })),
    options: options
      .filter((option) => !GLOBAL_OPTIONS.has(option.name ?? ''))
      .map((option) => ({
        name: option.name ?? '',
        description: option.description ?? '',
        acceptsValue: option.accept_value === true,
        multiple: option.is_multiple === true,
      })),
  }
}
