import type { SavedRequest } from '../../../shared/api'

/**
 * One folder inside a collection, with what it holds.
 *
 * Built from the requests rather than stored beside them: a folder is where
 * requests say they are, so a collection file cannot describe a folder that
 * does not exist and cannot lose one that does. The price is that an empty
 * folder is not a thing — which is the right trade for a file in a repository,
 * where an empty folder would be a line of YAML nobody can act on.
 */
export type FolderNode = {
  /** The last segment: what the row says. */
  name: string
  /** The whole path inside the collection: what the row is keyed by. */
  path: string
  folders: FolderNode[]
  requests: SavedRequest[]
}

/** The root of a collection. Its own `requests` are the ones in no folder. */
export function folderTree(requests: SavedRequest[]): FolderNode {
  const root: FolderNode = { name: '', path: '', folders: [], requests: [] }

  for (const request of requests) {
    let at = root

    for (const segment of segmentsOf(request.folder)) {
      const path = at.path === '' ? segment : `${at.path}/${segment}`
      const existing = at.folders.find((one) => one.name === segment)

      if (existing !== undefined) {
        at = existing

        continue
      }

      const made: FolderNode = { name: segment, path, folders: [], requests: [] }

      at.folders.push(made)
      at = made
    }

    at.requests.push(request)
  }

  return sorted(root)
}

/** Every folder in a collection, including the levels above each one. */
export function folderPaths(requests: SavedRequest[]): string[] {
  const paths = new Set<string>()

  for (const request of requests) {
    const segments = segmentsOf(request.folder)

    for (let depth = 1; depth <= segments.length; depth += 1) {
      paths.add(segments.slice(0, depth).join('/'))
    }
  }

  return [...paths].sort((a, b) => a.localeCompare(b))
}

/**
 * The same reduction the package makes when it stores one, so what the sidebar
 * draws and what the file holds cannot drift apart over a stray slash.
 */
export function segmentsOf(folder: string): string[] {
  return folder
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '')
}

/** Folders above requests, each side in its own alphabetical order. */
function sorted(node: FolderNode): FolderNode {
  return {
    ...node,
    folders: node.folders.map(sorted).sort((a, b) => a.name.localeCompare(b.name)),
    requests: [...node.requests].sort((a, b) => a.name.localeCompare(b.name)),
  }
}
