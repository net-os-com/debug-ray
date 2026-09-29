import type { TestFile } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const DISCOVER_TIMEOUT_MS = 30_000

/** Every test file and every name inside it: worth asking for once per container. */
const cache = new Map<string, TestFile[]>()

/**
 * Pest names its tests in strings, so the suite's own table of contents lives
 * in the source rather than anywhere it can be asked for. One grep across the
 * tests directory is both faster than booting the framework and the only way to
 * get the names without running anything.
 */
const DISCOVER = String.raw`
cd "$1" 2>/dev/null || exit 1
[ -d tests ] || exit 2
find tests -name '*Test.php' -type f -print0 |
  xargs -0 grep -HoE "^[[:space:]]*(it|test|arch|describe)\('[^']*'" 2>/dev/null
`

export async function testFiles(containerId: string, workingDir: string): Promise<TestFile[]> {
  const cached = cache.get(containerId)

  if (cached !== undefined) {
    return cached
  }

  const root = workingDir || '/var/www/html'
  const result = await runDocker(
    ['exec', '-i', containerId, 'sh', '-s', root],
    DISCOVER,
    DISCOVER_TIMEOUT_MS,
  ).catch(() => null)

  if (result === null || result.stdout.trim() === '') {
    return []
  }

  const files = group(result.stdout)

  cache.set(containerId, files)

  return files
}

export function forgetTests(): void {
  cache.clear()
}

/** `tests/Unit/Thing/AThingTest.php:it('does a thing'` — one line per test. */
export function group(output: string): TestFile[] {
  const byPath = new Map<string, TestFile>()

  for (const line of output.split('\n')) {
    const match = /^([^:]+):\s*(it|test|arch|describe)\('(.*)'$/.exec(line)

    if (match === null) {
      continue
    }

    const [, path, , name] = match
    const file = byPath.get(path) ?? {
      path,
      suite: suiteOf(path),
      name: path.split('/').pop()?.replace(/\.php$/, '') ?? path,
      cases: [],
    }

    file.cases.push(name)
    byPath.set(path, file)
  }

  return [...byPath.values()].sort(
    (a, b) => a.suite.localeCompare(b.suite) || a.path.localeCompare(b.path),
  )
}

/** `tests/Feature/Booking/…` groups under Feature; the top folder is the suite. */
function suiteOf(path: string): string {
  return path.split('/')[1] ?? 'tests'
}
