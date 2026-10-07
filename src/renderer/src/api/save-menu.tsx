import { useState } from 'react'
import type { ApiState } from './use-api'

/**
 * Saving a request into the repository.
 *
 * The collection is a file and the name is what you will recognise it by in six
 * weeks, so both are asked for rather than guessed — but only once: saving the
 * same verb and path again replaces it instead of piling up near-duplicates.
 */
export function SaveMenu({ api }: { api: ApiState }) {
  const [open, setOpen] = useState(false)
  const [collection, setCollection] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const start = (): void => {
    setCollection(api.collections[0]?.name ?? 'requests')
    setName(api.request.name)
    setResult(null)
    setOpen(true)
  }

  const save = async (): Promise<void> => {
    const answer = await api.saveTo(collection.trim() || 'requests', name.trim())

    if (answer === null) {
      setResult('No container is selected, so there is nowhere to write.')

      return
    }

    setResult(answer.error ?? `Saved to ${answer.file}`)

    if (answer.error === null) {
      setOpen(false)
    }
  }

  return (
    <div className="api-save">
      <button className="button" onClick={() => (open ? setOpen(false) : start())} type="button">
        Save
      </button>

      {open ? (
        <div className="api-save__menu">
          <div className="api-save__head">Save to collection</div>

          <label className="api-save__field">
            <span>Collection</span>
            <input
              list="api-collections"
              onChange={(event) => setCollection(event.target.value)}
              placeholder="requests"
              value={collection}
            />
            <datalist id="api-collections">
              {api.collections.map((one) => (
                <option key={one.name} value={one.name} />
              ))}
            </datalist>
          </label>

          <label className="api-save__field">
            <span>Name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="List desks"
              value={name}
            />
          </label>

          <div className="api-save__note">
            Written as OpenAPI into the application's repository. Values behind{' '}
            <code>{'{{ braces }}'}</code> are stored as the reference, so nothing secret goes in.
          </div>

          {result === null ? null : <div className="api-save__result">{result}</div>}

          <div className="api-save__actions">
            <button className="button" onClick={() => setOpen(false)} type="button">
              Cancel
            </button>
            <button className="button button--primary" onClick={() => void save()} type="button">
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
