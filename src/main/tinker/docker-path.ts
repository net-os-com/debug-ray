import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

/**
 * An app launched from Finder inherits a bare PATH — not the shell's — so the
 * docker CLI is looked for where it actually installs rather than trusted to be
 * on the path.
 */
const FALLBACKS = [
  '/usr/local/bin/docker',
  '/opt/homebrew/bin/docker',
  '/Applications/Docker.app/Contents/Resources/bin/docker',
  '/usr/bin/docker',
]

let resolved: string | null | undefined

export function dockerPath(): string | null {
  if (resolved !== undefined) {
    return resolved
  }

  resolved = search()

  return resolved
}

function search(): string | null {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (directory !== '' && existsSync(join(directory, 'docker'))) {
      return join(directory, 'docker')
    }
  }

  return FALLBACKS.find((candidate) => existsSync(candidate)) ?? null
}
