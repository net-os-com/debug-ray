import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { dialog } from 'electron'
import { load } from 'js-yaml'
import { readDocument, type ImportedFile } from '../../shared/import/documents'

/**
 * Reading a collection somebody exported from somewhere else.
 *
 * All of it happens here rather than in the container: the file is on this
 * machine, parsing it has nothing to do with the application being debugged,
 * and an import should work before a container is even picked. The container is
 * only asked to do the one thing only it can — write the collection file into
 * the repository.
 */
export async function importFile(): Promise<ImportedFile> {
  const picked = await dialog.showOpenDialog({
    title: 'Import requests',
    message: 'An OpenAPI or Swagger document, or an Insomnia v5 collection',
    filters: [
      { name: 'Collections and specs', extensions: ['yaml', 'yml', 'json'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  const path = picked.filePaths[0]

  if (picked.canceled || path === undefined) {
    return { ...empty(), cancelled: true }
  }

  try {
    const raw = await readFile(path, 'utf8')
    const reading = readDocument(parse(raw, path))

    return {
      ...reading,
      // A document with no title of its own is named after the file it came in.
      name: reading.name === '' ? basename(path, extname(path)) : reading.name,
      file: path,
      cancelled: false,
    }
  } catch (error) {
    return {
      ...empty(),
      file: path,
      cancelled: false,
      problem: error instanceof Error ? error.message : 'That file could not be read.',
    }
  }
}

/**
 * JSON first, because JSON is also valid YAML and the YAML parser is the slower
 * way to read it — and because a JSON error says where the problem is.
 */
function parse(raw: string, path: string): unknown {
  const trimmed = raw.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed)
  }

  if (trimmed === '') {
    throw new Error(`${basename(path)} is empty.`)
  }

  return load(trimmed)
}

function empty(): ImportedFile {
  return { name: '', format: '', requests: [], problem: null, file: '', cancelled: false }
}
