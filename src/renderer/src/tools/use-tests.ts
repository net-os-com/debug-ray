import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { TestFile } from '../../../shared/tools'
import { parseSummary } from './test-summary'
import { useExecStream } from './use-exec-stream'

export type TestsState = ReturnType<typeof useTests>

/**
 * The suite is migrated and seeded once, out of band, and each test wraps
 * itself in a transaction — so a run against the existing database is safe and
 * a `migrate:fresh` is not. Only the safe one is offered here.
 */
const ENV = '--env=testing'

export function useTests(container: TinkerContainer | null) {
  const [files, setFiles] = useState<TestFile[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  /** What the last run was for, so the console header can say so. */
  const [target, setTarget] = useState('')
  const stream = useExecStream()

  useEffect(() => {
    if (container === null) {
      return
    }

    setLoading(true)
    setFiles([])

    void window.ray
      .getTestFiles(container.id, container.workingDir)
      .then(setFiles)
      .finally(() => setLoading(false))
  }, [container])

  const run = useCallback(
    (args: string[], label: string) => {
      if (container === null) {
        return
      }

      setTarget(label)
      void stream.start([
        'exec',
        '-i',
        '-w',
        container.workingDir || '/var/www/html',
        container.id,
        'php',
        'artisan',
        'test',
        ENV,
        ...args,
      ])
    },
    [container, stream],
  )

  const shown = useMemo(() => filterFiles(files, query), [files, query])
  const summary = useMemo(() => parseSummary(stream.lines), [stream.lines])

  return {
    files,
    shown,
    loading,
    query,
    setQuery,
    open,
    toggle: useCallback((path: string) => setOpen((current) => (current === path ? null : path)), []),
    target,
    summary,
    stream,
    runFile: useCallback((file: TestFile) => run([file.path], file.path), [run]),
    /** Pest matches the filter against the test's name, not the file's. */
    runCase: useCallback(
      (file: TestFile, name: string) => run([file.path, `--filter=${name}`], name),
      [run],
    ),
    runSuite: useCallback((suite: string) => run([`tests/${suite}`], `tests/${suite}`), [run]),
    runAll: useCallback(() => run([], 'the whole suite'), [run]),
  }
}

/** Matches a file by its path and by any test name inside it. */
export function filterFiles(files: TestFile[], query: string): TestFile[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return files
  }

  return files
    .map((file) => {
      if (file.path.toLowerCase().includes(needle)) {
        return file
      }

      const cases = file.cases.filter((name) => name.toLowerCase().includes(needle))

      return cases.length === 0 ? null : { ...file, cases }
    })
    .filter((file): file is TestFile => file !== null)
}

/** The suites present, with how many files each holds. */
export function suitesOf(files: TestFile[]): { name: string; files: number }[] {
  const counts = new Map<string, number>()

  for (const file of files) {
    counts.set(file.suite, (counts.get(file.suite) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, files: count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
