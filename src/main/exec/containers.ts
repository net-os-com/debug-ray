import type { TinkerContainer } from '../../shared/tinker'
import { runDocker } from './run-docker'

/** Containers a PHP snippet could plausibly run in, by image, name or layout. */
const PHP_HINT = /php|laravel|octane|frankenphp|artisan|worker|scheduler|queue|horizon|app/i
const CODE_DIRS = ['/var/www', '/app', '/srv', '/usr/src']

type PsRow = {
  ID?: string
  Names?: string
  Image?: string
  Status?: string
  State?: string
}

/**
 * Lists the containers the picker offers.
 *
 * Stopped ones are kept: the design shows them greyed out, and a container that
 * died is worth seeing rather than silently missing from the list.
 */
export async function listContainers(): Promise<TinkerContainer[]> {
  const ps = await runDocker(['ps', '--all', '--no-trunc', '--format', '{{json .}}'], null, 10_000)

  if (ps.code !== 0) {
    throw new Error(firstLine(ps.stderr) || 'docker ps failed.')
  }

  const rows = ps.stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as PsRow)
    .filter((row) => typeof row.ID === 'string' && row.ID !== '')

  if (rows.length === 0) {
    return []
  }

  const dirs = await workingDirs(rows.map((row) => row.ID as string))
  const running = rows.filter((row) => (row.State ?? '') === 'running')
  const laravel = await holdsLaravel(
    running.map((row) => ({ id: row.ID as string, dir: dirs.get(row.ID as string) ?? '' })),
  )

  const all = rows.map((row) => ({
    id: row.ID as string,
    name: row.Names ?? '',
    image: row.Image ?? '',
    status: row.Status ?? '',
    workingDir: dirs.get(row.ID as string) ?? '',
    running: (row.State ?? '') === 'running',
    laravel: (row.State ?? '') === 'running' ? (laravel.get(row.ID as string) ?? false) : null,
  }))

  const likely = all.filter(
    (container) =>
      PHP_HINT.test(`${container.name} ${container.image}`) ||
      CODE_DIRS.some((dir) => container.workingDir.startsWith(dir)),
  )

  // Better a list with noise in it than an empty picker on a setup that names
  // its containers something we did not think of.
  const shown = likely.length > 0 ? likely : all

  // Containers that hold this application come first, then the rest of the PHP
  // ones. Sorting on `running` and the name alone put a WordPress container
  // called houtstaet-wordpress-1 ahead of net-os_local-php-1, and the app
  // picked it — the name tells you nothing about what is inside.
  return shown.sort(
    (a, b) =>
      Number(b.running) - Number(a.running) ||
      Number(b.laravel === true) - Number(a.laravel === true) ||
      a.name.localeCompare(b.name),
  )
}

const LARAVEL_PROBE_MS = 8_000

/**
 * Which running containers have a Laravel application where they start.
 *
 * `artisan` as well as the autoloader: a package with a `vendor` directory of
 * its own is not an application you can boot. One exec per container, all at
 * once, because a call each makes opening the picker crawl; a container that
 * does not answer is simply not one we can say yes about.
 */
async function holdsLaravel(
  containers: { id: string; dir: string }[],
): Promise<Map<string, boolean>> {
  const answers = await Promise.all(
    containers.map(async ({ id, dir }) => {
      const root = dir || '/var/www/html'
      const result = await runDocker(
        ['exec', id, 'sh', '-c', `test -f ${shellQuote(`${root}/artisan`)} && test -f ${shellQuote(`${root}/vendor/autoload.php`)} && echo yes`],
        null,
        LARAVEL_PROBE_MS,
      ).catch(() => ({ stdout: '', stderr: '', code: 1, timedOut: false }))

      return [id, result.stdout.includes('yes')] as const
    }),
  )

  return new Map(answers)
}

/** A path inside a `sh -c` string, so a directory with a space still works. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\''`)}'`
}

/** One inspect for every container; a call each would make opening the picker crawl. */
async function workingDirs(ids: string[]): Promise<Map<string, string>> {
  const dirs = new Map<string, string>()

  const inspect = await runDocker(
    ['inspect', '--format', '{{.Id}}\t{{.Config.WorkingDir}}', ...ids],
    null,
    10_000,
  )

  for (const line of inspect.stdout.split('\n')) {
    const [id, dir] = line.split('\t')

    if (id !== undefined && id !== '') {
      dirs.set(id, dir ?? '')
    }
  }

  return dirs
}

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}
