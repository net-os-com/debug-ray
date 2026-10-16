import { useState } from 'react'
import type { ImportedFile } from '../../../shared/import/documents'
import type { ApiState } from './use-api'

type ImportPanelProps = {
  api: ApiState
  read: ImportedFile
  onDone: () => void
}

/**
 * What a picked file turned out to hold, before any of it is written.
 *
 * An import is somebody else's idea of a collection landing in your repository,
 * so it says what it found and where it will go, and waits. The collection name
 * is theirs to change — the document's own title is only a suggestion, and it is
 * often something like "Swagger Petstore - OpenAPI 3.0".
 */
export function ImportPanel({ api, read, onDone }: ImportPanelProps) {
  const [collection, setCollection] = useState(() => slug(read.name))
  const [importing, setImporting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<{ file: string; added: number; replaced: number } | null>(null)

  const folders = [...new Set(read.requests.map((one) => one.folder).filter((one) => one !== ''))]

  const write = async (): Promise<void> => {
    setImporting(true)
    setProblem(null)

    const answer = await api.importRequests(collection.trim() || 'imported', read.requests)

    setImporting(false)

    if (answer === null) {
      setProblem('No container is selected, so there is nowhere to write.')

      return
    }

    if (answer.error !== null) {
      setProblem(answer.error)

      return
    }

    setDone({ file: answer.file, added: answer.added, replaced: answer.replaced })
  }

  if (done !== null) {
    return (
      <div className="api-save__menu api-save__menu--row">
        <div className="api-save__head api-save__head--done">Imported</div>
        <div className="api-save__file">{done.file}</div>
        <div className="api-save__note">
          {done.added === 0 ? 'Nothing new' : `${done.added} request${done.added === 1 ? '' : 's'} added`}
          {done.replaced === 0 ? '' : `, ${done.replaced} replaced`}. The file is in the repository —
          commit it and everyone has them.
        </div>
        <div className="api-save__actions">
          <button className="button button--primary" onClick={onDone} type="button">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="api-save__menu api-save__menu--row">
      <div className="api-save__head">Import</div>

      <div className="api-save__file">{read.format}</div>

      <div className="api-save__note">
        {read.requests.length} request{read.requests.length === 1 ? '' : 's'}
        {folders.length === 0 ? ' at the root' : ` in ${folders.length} folder${folders.length === 1 ? '' : 's'}`}
        {folders.length === 0 ? '' : `: ${folders.slice(0, 3).join(', ')}${folders.length > 3 ? '…' : ''}`}. Tokens and
        passwords are left behind — only the kind of authentication travels.
      </div>

      <label className="api-save__field">
        <span>Collection</span>
        <input
          list="api-collections"
          onChange={(event) => setCollection(event.target.value)}
          value={collection}
        />
      </label>

      {problem === null ? null : <div className="api-save__problem">{problem}</div>}

      <div className="api-save__actions">
        <button className="button" disabled={importing} onClick={onDone} type="button">
          Cancel
        </button>
        <button
          className="button button--primary"
          disabled={importing}
          onClick={() => void write()}
          type="button"
        >
          {importing ? 'Importing…' : `Import ${read.requests.length}`}
        </button>
      </div>
    </div>
  )
}

/**
 * The document's title as a file name: the package slugs it anyway, and showing
 * what it will become beats showing what was typed.
 */
function slug(name: string): string {
  const reduced = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')

  return reduced === '' ? 'imported' : reduced
}
