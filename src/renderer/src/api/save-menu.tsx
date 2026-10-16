import { useEffect, useMemo, useRef, useState } from 'react'
import { StrokeIcon } from '../chrome/module-icons'
import { folderPaths } from './folders'
import type { ApiState } from './use-api'

/** A tick, on the same 24 grid as every other icon in the app. */
const TICK_PATH = 'M20 6 9 17l-5-5'

/** How long the button keeps saying it saved, once the panel is closed. */
const CONFIRM_FOR_MS = 4_000

type Done = {
  file: string
  operations: number
  /** Which folder inside the file, when it went into one. */
  folder: string
}

/**
 * Saving a request into the repository.
 *
 * The collection is a file and the name is what you will recognise it by in six
 * weeks, so both are asked for rather than guessed — but only once: saving the
 * same verb and path again replaces it instead of piling up near-duplicates.
 *
 * Writing goes through the container and takes about a second, which is long
 * enough that a button doing nothing visible reads as a button that did
 * nothing. So the wait is shown, and so is what came of it: the path of the
 * file that now exists, because the whole point of saving here rather than in
 * this app's own storage is that the file can be committed.
 */
export function SaveMenu({ api }: { api: ApiState }) {
  const [open, setOpen] = useState(false)
  const [collection, setCollection] = useState('')
  const [folder, setFolder] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  /**
   * The folders this collection already has, offered rather than remembered: a
   * new one is made by typing a path nothing is in yet.
   */
  const folders = useMemo(() => folderPaths(api.saved[collection] ?? []), [api.saved, collection])

  const start = (): void => {
    // Where it came from is where it goes back, which is what makes Save on a
    // request opened from a folder a single press.
    setCollection(api.origin?.collection ?? api.collections[0]?.name ?? 'requests')
    setFolder(api.request.folder)
    setName(api.request.name)
    setProblem(null)
    setDone(null)
    setOpen(true)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setProblem(null)

    try {
      const answer = await api.saveTo(
        collection.trim() || 'requests',
        name.trim(),
        folder.trim(),
      )

      if (answer === null) {
        setProblem('No container is selected, so there is nowhere to write.')

        return
      }

      if (answer.error !== null) {
        setProblem(answer.error)

        return
      }

      setDone({ file: answer.file, operations: answer.operations, folder: folder.trim() })
    } finally {
      setSaving(false)
    }
  }

  /**
   * Closing on the confirmation keeps it on the button for a few seconds. The
   * panel is gone by then and the only thing left saying the file was written
   * would otherwise be the sidebar, which is a different corner of the window.
   */
  const close = (): void => {
    setOpen(false)

    if (done !== null) {
      clearTimeout(timer.current ?? undefined)
      timer.current = setTimeout(() => setDone(null), CONFIRM_FOR_MS)
    }
  }

  const saved = done !== null && !open

  return (
    <div className="api-save">
      <button
        className={
          saved
            ? 'button api-save__button--done'
            : api.dirty
              ? 'button api-save__button--dirty'
              : 'button'
        }
        onClick={() => (open ? close() : start())}
        title={
          api.dirty ? `Changed since it was saved to ${api.origin?.collection ?? ''}` : undefined
        }
        type="button"
      >
        {saved ? (
          <>
            <StrokeIcon path={TICK_PATH} size={13} />
            Saved
          </>
        ) : (
          <>
            Save
            {/* A request that came from a file and no longer matches it. The
                same dot is on its row in the sidebar, so the two places this
                can be noticed agree with each other. */}
            {api.dirty ? <span className="api-save__dot" /> : null}
          </>
        )}
      </button>

      {open ? (
        <div className="api-save__menu">
          {done === null ? (
            <>
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
                <span>Folder</span>
                <input
                  list="api-folders"
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="None · Desks/Bookings"
                  value={folder}
                />
                <datalist id="api-folders">
                  {folders.map((one) => (
                    <option key={one} value={one} />
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
                <code>{'{{ braces }}'}</code> are stored as the reference, so nothing secret goes
                in.
              </div>

              {problem === null ? null : <div className="api-save__problem">{problem}</div>}

              <div className="api-save__actions">
                <button className="button" disabled={saving} onClick={close} type="button">
                  Cancel
                </button>
                <button
                  className="button button--primary"
                  disabled={saving}
                  onClick={() => void save()}
                  type="button"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="api-save__head api-save__head--done">
                <StrokeIcon path={TICK_PATH} size={14} />
                Saved
              </div>

              <div className="api-save__file">
                {done.file}
                {done.folder === '' ? null : <span className="api-save__in"> · {done.folder}</span>}
              </div>

              <div className="api-save__note">
                In the repository, so <code>git add</code> it and everyone on the project opens the
                same request.{' '}
                {done.operations === 1 ? 'One request' : `${done.operations} requests`} in this
                collection — they are read back into the sidebar every time the app starts.
              </div>

              <div className="api-save__actions">
                <button className="button button--primary" onClick={close} type="button">
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
