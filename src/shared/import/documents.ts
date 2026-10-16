import type { SavedRequest } from '../api'
import { fromInsomnia, INSOMNIA_TYPE } from './insomnia'
import { fromOpenApi } from './openapi'
import { isRecord, text } from './skeleton'

/**
 * What a file turned out to be, and what it holds.
 *
 * The app cannot tell an OpenAPI file from an Insomnia collection by its name —
 * both are .yaml or .json — so the format is reported rather than asked for,
 * and a document that is neither is an answer rather than an error.
 */
export type ImportReading = {
  /** A name for the collection, taken from the document itself. */
  name: string
  /** `OpenAPI 3.1`, `Swagger 2.0`, `Insomnia 5.1` — shown, not parsed. */
  format: string
  requests: SavedRequest[]
  /** Why nothing came of it, when nothing did. */
  problem: string | null
}

/**
 * A reading, plus where the file came from — the shape that crosses to the
 * renderer. Declared here rather than beside the reader because the preload
 * bridge is typed from shared code, not from the main process.
 */
export type ImportedFile = ImportReading & {
  /** Where it came from, shown so two exports can be told apart. */
  file: string
  /** The picker was dismissed, which is not a problem to report. */
  cancelled: boolean
}

export function readDocument(document: unknown): ImportReading {
  if (!isRecord(document)) {
    return nothing('That file is not a document this could read.')
  }

  if (text(document.type).startsWith(INSOMNIA_TYPE)) {
    return {
      name: text(document.name) || 'insomnia',
      format: `Insomnia ${text(document.schema_version) || '5'}`,
      requests: fromInsomnia(document),
      problem: null,
    }
  }

  if ('openapi' in document || 'swagger' in document) {
    const info = isRecord(document.info) ? document.info : {}
    const swagger = 'swagger' in document

    return {
      name: text(info.title) || 'imported',
      format: `${swagger ? 'Swagger' : 'OpenAPI'} ${text(document.swagger ?? document.openapi)}`.trim(),
      requests: fromOpenApi(document),
      problem: null,
    }
  }

  return nothing('That document is neither OpenAPI, Swagger, nor an Insomnia collection.')
}

function nothing(problem: string): ImportReading {
  return { name: '', format: '', requests: [], problem }
}
