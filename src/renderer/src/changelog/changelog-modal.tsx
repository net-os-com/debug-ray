import { useEffect, useRef } from 'react'
import { CHANGELOG, readableDate } from './entries'

type ChangelogModalProps = {
  /** The version running now, marked in the list so you can place yourself. */
  current: string
  onClose: () => void
}

/**
 * What changed, release by release.
 *
 * Reads from the files bundled with the build rather than from the network, so
 * it answers the same whether or not the machine is online — and so the notes
 * belong to the version you are actually running.
 */
export function ChangelogModal({ current, onClose }: ChangelogModalProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)
    panel.current?.focus()

    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="changelog" onClick={onClose}>
      <div
        className="changelog__panel"
        onClick={(event) => event.stopPropagation()}
        ref={panel}
        tabIndex={-1}
      >
        <div className="changelog__head">
          <div>
            <div className="changelog__title">What&apos;s new</div>
            <div className="changelog__subtitle">
              You are running {current}
              {CHANGELOG.length === 0 ? '' : ` · ${CHANGELOG.length} releases`}
            </div>
          </div>
          <button className="button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="changelog__scroll">
          {CHANGELOG.length === 0 ? (
            <p className="changelog__empty">
              Nothing written yet. Releases are described in <code>changelog/</code>, one file
              per version.
            </p>
          ) : (
            CHANGELOG.map((entry) => (
              <section className="changelog__entry" key={entry.version}>
                <div className="changelog__entry-head">
                  <span className="changelog__version">{entry.version}</span>
                  {entry.version === current ? (
                    <span className="changelog__here">installed</span>
                  ) : null}
                  <span className="changelog__date">{readableDate(entry.date)}</span>
                </div>

                <div className="changelog__entry-title">{entry.title}</div>

                <ul className="changelog__items">
                  {entry.items.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
