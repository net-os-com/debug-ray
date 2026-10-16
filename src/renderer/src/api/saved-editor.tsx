import { useState } from 'react'
import type { SavedRequest } from '../../../shared/api'
import { folderPaths } from './folders'
import type { ApiState } from './use-api'

type SavedEditorProps = {
  api: ApiState
  collection: string
  request: SavedRequest
  onDone: () => void
}

/**
 * Changing where a saved request lives, without opening it.
 *
 * Saving from the request pane can do this too — it is the same three fields —
 * but only for the request currently in the boxes. Tidying a collection is the
 * other way round: you are looking at the list, and the one you want to move is
 * a row, not the thing you are working on.
 */
export function SavedEditor({ api, collection, request, onDone }: SavedEditorProps) {
  const [into, setInto] = useState(collection)
  const [folder, setFolder] = useState(request.folder)
  const [name, setName] = useState(request.name)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const folders = folderPaths(api.saved[into] ?? [])
  const changed =
    into !== collection || folder.trim() !== request.folder || name.trim() !== request.name

  const apply = async (): Promise<void> => {
    if (!changed) {
      onDone()

      return
    }

    setSaving(true)
    setProblem(null)

    const failed = await api.updateSaved(
      collection,
      request,
      { name: name.trim() || request.name, folder: folder.trim() },
      into.trim() || collection,
    )

    setSaving(false)

    if (failed === null) {
      onDone()

      return
    }

    setProblem(failed)
  }

  return (
    <div className="api-save__menu api-save__menu--row">
      <div className="api-save__head">Move or rename</div>

      <label className="api-save__field">
        <span>Collection</span>
        <input
          list="api-collections"
          onChange={(event) => setInto(event.target.value)}
          value={into}
        />
      </label>

      <label className="api-save__field">
        <span>Folder</span>
        <input
          list="api-folders-row"
          onChange={(event) => setFolder(event.target.value)}
          placeholder="None · Desks/Bookings"
          value={folder}
        />
        <datalist id="api-folders-row">
          {folders.map((one) => (
            <option key={one} value={one} />
          ))}
        </datalist>
      </label>

      <label className="api-save__field">
        <span>Name</span>
        <input onChange={(event) => setName(event.target.value)} value={name} />
      </label>

      <div className="api-save__note">
        {request.method} {request.path} — the call itself is unchanged. Moving it rewrites the file
        it is in, and a different collection is a different file.
      </div>

      {problem === null ? null : <div className="api-save__problem">{problem}</div>}

      <div className="api-save__actions">
        <button className="button" disabled={saving} onClick={onDone} type="button">
          Cancel
        </button>
        <button
          className="button button--primary"
          disabled={saving}
          onClick={() => void apply()}
          type="button"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
