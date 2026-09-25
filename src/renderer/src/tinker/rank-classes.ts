export type ClassEntry = {
  fqcn: string
  short: string
  /** Lower-cased short name, kept so the search does not re-derive it per keystroke. */
  key: string
  /** Lower is likelier to be what you meant; see rank(). */
  rank: number
}

export type ClassIndex = ClassEntry[]

/** The application's own code is almost always what you meant. */
const APP = /^App\\/
const FRAMEWORK = /^(Illuminate|Symfony)\\/

export function buildIndex(classes: string[]): ClassIndex {
  const entries: ClassIndex = []

  for (const fqcn of classes) {
    const short = fqcn.slice(fqcn.lastIndexOf('\\') + 1)

    if (short === '' || !/^[A-Za-z_]/.test(short)) {
      continue
    }

    entries.push({ fqcn, short, key: short.toLowerCase(), rank: rank(fqcn) })
  }

  return entries
}

/**
 * Matches on the short name only, which is what you type.
 *
 * `User` has nine candidates in a Laravel application and the one you meant is
 * not first alphabetically, so ranking is not a nicety here — it is the whole
 * difference between a useful list and a lottery.
 */
export function searchClasses(index: ClassIndex, prefix: string, limit = 20): ClassEntry[] {
  const needle = prefix.toLowerCase()

  if (needle === '') {
    return []
  }

  const matches = index.filter((entry) => entry.key.startsWith(needle))

  /*
   * Name length comes before namespace rank, and that order matters: sorting
   * App\ first but alphabetically within it buried App\Models\User\User under
   * App\Data\…\UserInfoData and four event classes. What you typed is a prefix
   * of what you want, so the closest length is the best guess, and the
   * application's own namespace breaks the ties.
   */
  matches.sort(
    (a, b) =>
      a.short.length - b.short.length ||
      a.rank - b.rank ||
      a.fqcn.length - b.fqcn.length ||
      a.fqcn.localeCompare(b.fqcn),
  )

  return matches.slice(0, limit)
}

function rank(fqcn: string): number {
  if (APP.test(fqcn)) {
    return 0
  }

  if (FRAMEWORK.test(fqcn)) {
    return 1
  }

  // Everything else by depth: a shallow vendor class is likelier than one
  // buried six namespaces deep in a contract or a stub.
  return 2 + Math.min(5, fqcn.split('\\').length)
}
