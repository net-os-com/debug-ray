/**
 * The changelog, read from the files beside the source.
 *
 * One file per release under `changelog/`, named for its version, bundled at
 * build time by Vite rather than read from disk. A packaged app has no
 * repository to read from, and a changelog that only works in development is
 * worse than none: it would look right every time anyone checked it.
 */
const FILES = import.meta.glob('../../../../changelog/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

export type ChangelogEntry = {
  version: string
  title: string
  /** ISO day, as written in the file. */
  date: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = Object.entries(FILES)
  .map(([path, text]) => parseEntry(versionOf(path), text))
  .sort((a, b) => compareVersions(b.version, a.version))

/** The release at the top, or null when there are no entries at all. */
export const LATEST: string | null = CHANGELOG[0]?.version ?? null

function versionOf(path: string): string {
  return path.split('/').pop()?.replace(/\.md$/, '') ?? path
}

/**
 * Front matter, then a list.
 *
 * Deliberately not a Markdown parser. The files are written to one shape, and
 * a real parser would be a dependency for a bundle that is already too large —
 * so this reads the two keys it needs and treats the rest as bullets.
 */
function parseEntry(version: string, text: string): ChangelogEntry {
  const fenced = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text.trim())
  const head = fenced?.[1] ?? ''
  const body = fenced?.[2] ?? text

  const setting = (key: string): string =>
    new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(head)?.[1]?.trim() ?? ''

  const items: string[] = []

  for (const line of body.split('\n')) {
    const bullet = /^[-*][ \t]+(.*)$/.exec(line)

    if (bullet !== null) {
      items.push(bullet[1]?.trim() ?? '')
    } else if (items.length > 0 && line.trim() !== '') {
      // A wrapped bullet continues the one above it, so the files can be
      // written to a sane width without the app showing the wrapping.
      items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`
    }
  }

  return {
    version,
    title: setting('title') || version,
    date: setting('date'),
    items,
  }
}

/** Newest-first ordering, by number rather than by string. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)

    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

/** How the date reads in the modal, falling back to whatever was written. */
export function readableDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
