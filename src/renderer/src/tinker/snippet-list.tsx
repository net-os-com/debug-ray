import { useState } from 'react'
import type { SnippetsState } from './use-snippets'

type SnippetListProps = {
  snippets: SnippetsState
  width: number
}

export function SnippetList({ snippets, width }: SnippetListProps) {
  // Deleting cannot be undone, so the button asks once rather than acting on a
  // stray click in a list you are scanning quickly.
  const [arming, setArming] = useState<string | null>(null)

  return (
    <aside className="snippets" style={{ width: `${width}px` }}>
      <div className="snippets__head">
        <div className="snippets__title-row">
          <span className="pane__label">Snippets</span>
          <button className="button" onClick={snippets.create} type="button">
            <PlusIcon />
            New
          </button>
        </div>

        <div className="snippets__search">
          <SearchIcon />
          <input
            onChange={(event) => snippets.setQuery(event.target.value)}
            placeholder="Search snippets"
            value={snippets.query}
          />
        </div>
      </div>

      <div className="snippets__list" onMouseLeave={() => setArming(null)}>
        {snippets.shown.map((snippet) => (
          <div
            className={
              snippet.id === snippets.activeId ? 'snippet snippet--active' : 'snippet'
            }
            key={snippet.id}
            onClick={() => snippets.select(snippet.id)}
          >
            <div className="snippet__top">
              <span className="snippet__name">{snippet.name}</span>
              {snippets.dirtyIds.has(snippet.id) ? (
                <span className="snippet__dirty" title="Unsaved changes" />
              ) : null}
              <button
                className={arming === snippet.id ? 'snippet__delete snippet__delete--armed' : 'snippet__delete'}
                onClick={(event) => {
                  event.stopPropagation()

                  if (arming === snippet.id) {
                    snippets.remove(snippet.id)
                    setArming(null)

                    return
                  }

                  setArming(snippet.id)
                }}
                title={arming === snippet.id ? 'Click again to delete' : 'Delete snippet'}
                type="button"
              >
                {arming === snippet.id ? 'Delete?' : <TrashIcon />}
              </button>
            </div>
            <span className="snippet__preview">{preview(snippet.code)}</span>
          </div>
        ))}

        {snippets.shown.length === 0 ? (
          <div className="snippets__none">No snippets match “{snippets.query}”</div>
        ) : null}
      </div>
    </aside>
  )
}

/** The first line that says something: imports and comments are not the point. */
function preview(code: string): string {
  return (
    code
      .split('\n')
      .find((line) => line.trim() !== '' && !line.startsWith('use ') && !line.startsWith('//')) ?? ''
  ).trim()
}

function PlusIcon() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
      width="16"
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      fill="none"
      height="13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="13"
    >
      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
