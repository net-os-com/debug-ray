import type { ArtisanCommand } from '../../../shared/tools'

export type ArtisanValues = {
  /** Argument name to what was typed; an array argument is split on commas. */
  args: Record<string, string>
  /** Option name to a value, or to true for a flag. */
  options: Record<string, string | boolean>
}

/** Commands that throw work away. Running one is a decision, not a click. */
const DESTRUCTIVE =
  /^(migrate:fresh|migrate:refresh|migrate:reset|migrate:rollback|db:wipe|queue:flush|queue:forget|scout:flush|cache:forget|tenants:migrate-fresh|tenants:rollback|tenants:seed|model:prune|schema:dump)$/

export function isDestructive(name: string): boolean {
  return DESTRUCTIVE.test(name)
}

/**
 * Builds the docker argv for one artisan run.
 *
 * `--no-interaction` is not optional. Several commands stop to ask for
 * confirmation, and a prompt nobody can answer is a stream that hangs until it
 * is killed. `--ansi` is the opposite problem: Symfony turns colour off when it
 * sees no terminal, and the console pane wants it on.
 */
export function buildArgv(
  container: { id: string; workingDir: string },
  command: ArtisanCommand,
  values: ArtisanValues,
): string[] {
  const tail: string[] = []

  for (const argument of command.arguments) {
    const raw = (values.args[argument.name] ?? '').trim()

    if (raw === '') {
      continue
    }

    if (argument.array) {
      tail.push(...raw.split(',').map((part) => part.trim()).filter((part) => part !== ''))

      continue
    }

    tail.push(raw)
  }

  for (const option of command.options) {
    const value = values.options[option.name]

    if (value === undefined || value === false || value === '') {
      continue
    }

    if (!option.acceptsValue) {
      tail.push(option.name)

      continue
    }

    const parts = option.multiple
      ? String(value).split(',').map((part) => part.trim()).filter((part) => part !== '')
      : [String(value)]

    for (const part of parts) {
      tail.push(`${option.name}=${part}`)
    }
  }

  return [
    'exec',
    '-i',
    '-w',
    container.workingDir || '/var/www/html',
    container.id,
    'php',
    'artisan',
    command.name,
    ...tail,
    '--no-interaction',
    '--ansi',
  ]
}

/** What the run would look like typed out, for the line above the console. */
export function commandLine(argv: string[]): string {
  const artisan = argv.indexOf('artisan')

  return artisan === -1 ? argv.join(' ') : `php ${argv.slice(artisan).join(' ')}`
}
