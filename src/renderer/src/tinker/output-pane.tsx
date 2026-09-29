import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { TinkerError, TinkerOutcome } from '../../../shared/tinker'
import { formatDuration } from '../duration'
import {
  branchPaths,
  flatten,
  pathsWithMatch,
  rowMatches,
  segments,
  typeLabel,
  type Tone,
} from './value-tree'

const TONE: Record<Tone, string> = {
  class: 'var(--sql-kw)',
  string: 'var(--sql-str)',
  number: 'var(--sql-num)',
  bool: 'var(--sql-kw)',
  null: 'var(--t3)',
  plain: 'var(--t2)',
  muted: 'var(--t3)',
}

type OutputPaneProps = {
  /** Share of the width, set by the splitter. */
  flex: number
  outcome: TinkerOutcome | null
  running: boolean
  containerName: string
  collapsed: ReadonlySet<string>
  search: string
  onSearch: (search: string) => void
  onToggle: (path: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onClear: () => void
}

export function OutputPane({
  flex,
  outcome,
  running,
  containerName,
  collapsed,
  search,
  onSearch,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onClear,
}: OutputPaneProps) {
  const value = outcome?.kind === 'value' ? outcome.value : null
  const needle = search.trim()

  // A branch holding a hit is opened for as long as the search stands, without
  // disturbing what the reader collapsed: clearing the box puts it all back.
  const found = value === null ? new Set<string>() : pathsWithMatch(value, needle)
  const shown =
    found.size === 0 ? collapsed : new Set([...collapsed].filter((path) => !found.has(path)))

  const rows = value === null ? [] : flatten(value, shown)
  const hits = needle === '' ? [] : rows.filter((row) => rowMatches(row, needle)).map((row) => row.path)

  const [active, setActive] = useState(0)
  const drawn = useRef(new Map<string, HTMLDivElement>())

  // Clamped while rendering rather than corrected afterwards: typing another
  // letter can shrink the hit list under the cursor, and a frame drawn with an
  // index past the end would highlight nothing at all.
  const index = hits.length === 0 ? 0 : Math.min(active, hits.length - 1)
  const target = hits[index]

  // A new search starts at its first hit instead of wherever the last one
  // happened to leave off.
  useEffect(() => {
    setActive(0)
  }, [needle])

  // Scrolling is the whole point: a match below the fold is a match you cannot
  // see, and the tree is routinely taller than the pane. Keyed on the target
  // path, because the hit list is a new array on every render and depending on
  // it would drag the view back on each one.
  useEffect(() => {
    if (target !== undefined) {
      drawn.current.get(target)?.scrollIntoView({ block: 'nearest' })
    }
  }, [target])

  const step = (by: number): void => {
    if (hits.length > 0) {
      setActive((current) => (Math.min(current, hits.length - 1) + by + hits.length) % hits.length)
    }
  }

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    step(event.shiftKey ? -1 : 1)
  }

  return (
    <section className="tinker-output" style={{ flex: `${flex} 1 0` }}>
      <div className="tinker-output__head">
        <span className="pane__label">Output</span>

        {outcome !== null && !running ? <Stats outcome={outcome} /> : null}

        <div className="tinker-output__actions">
          <div className="tinker-output__search">
            <input
              onChange={(event) => onSearch(event.target.value)}
              onKeyDown={onSearchKey}
              data-find="tinker-output"
              placeholder="Find in output"
              title="Enter for the next match, shift-enter for the previous"
              value={search}
            />
            {needle === '' ? null : (
              <span
                className={
                  hits.length === 0
                    ? 'tinker-output__hits tinker-output__hits--none'
                    : 'tinker-output__hits'
                }
              >
                {hits.length === 0 ? 'none' : `${index + 1}/${hits.length}`}
              </span>
            )}
          </div>

          <button className="button" onClick={onExpandAll} type="button">
            Expand all
          </button>
          <button className="button" onClick={onCollapseAll} type="button">
            Collapse
          </button>
          <button className="button" onClick={onClear} type="button">
            Clear
          </button>
        </div>
      </div>

      <div className="tinker-output__body">
        {running ? (
          <div className="tinker-output__running">
            <span className="tinker-output__pulse" />
            Running in {containerName}…
          </div>
        ) : outcome === null ? (
          <div className="tinker-output__empty">
            <div>
              <div className="tinker-output__empty-title">No output yet</div>
              <div className="tinker-output__empty-body">
                Run the snippet to see what it returns. Press ⌘ Enter from the editor.
              </div>
            </div>
          </div>
        ) : (
          <>
            {'output' in outcome && outcome.output !== '' ? (
              <pre className="tinker-output__echo">{outcome.output}</pre>
            ) : null}

            {outcome.kind === 'unavailable' ? (
              <div className="tinker-output__unavailable">{outcome.message}</div>
            ) : null}

            {outcome.kind === 'throwable' ? <ErrorCard error={outcome.error} /> : null}

            {value === null ? null : (
              <div className="tinker-tree">
                {rows.map((row) => (
                  <div
                    className={rowClass(row.path, target, rowMatches(row, needle))}
                    key={row.path}
                    ref={(element) => {
                      if (element === null) {
                        drawn.current.delete(row.path)
                      } else {
                        drawn.current.set(row.path, element)
                      }
                    }}
                    style={{ paddingLeft: `${row.depth * 18}px` }}
                  >
                    {row.toggle ? (
                      <button
                        className="tinker-tree__toggle"
                        onClick={() => onToggle(row.path)}
                        type="button"
                      >
                        <Chevron open={row.open} />
                      </button>
                    ) : (
                      <span className="tinker-tree__gutter" />
                    )}
                    <span className="tinker-tree__key">
                      <Marked needle={needle} text={row.key} />
                    </span>
                    <span style={{ color: TONE[row.tone] }}>
                      <Marked needle={needle} text={row.value} />
                    </span>
                    <span className="tinker-tree__suffix">{row.suffix}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** Exported so Collapse can reach every branch without walking the tree twice. */
export { branchPaths }

function Stats({ outcome }: { outcome: TinkerOutcome }) {
  const parts: string[] = []

  if (outcome.kind === 'value') {
    parts.push(formatDuration(outcome.durationMs))

    if (outcome.memoryMb !== null) {
      parts.push(`${outcome.memoryMb} MB`)
    }
  }

  if (outcome.kind === 'throwable') {
    parts.push(formatDuration(outcome.durationMs))
  }

  parts.push(new Date(outcome.at).toLocaleTimeString(undefined, { hour12: false }))

  return (
    <div className="tinker-output__stats">
      {outcome.kind === 'value' ? (
        <span className="tinker-output__type">{typeLabel(outcome.value)}</span>
      ) : null}
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </div>
  )
}

/**
 * The design has no error state, so this follows the app's own: the throwable
 * first, then where it came from. A line with no file is a line in the snippet,
 * which is the only one worth pointing at.
 */
function ErrorCard({ error }: { error: TinkerError }) {
  return (
    <div className="tinker-error">
      <div className="tinker-error__head">
        <span className="tinker-error__class">{error.cls}</span>
        {error.line === null ? null : (
          <span className="tinker-error__where">
            {error.file === null ? `snippet line ${error.line}` : `${error.file}:${error.line}`}
          </span>
        )}
      </div>
      <div className="tinker-error__message">{error.message}</div>
      {error.frames.length === 0 ? null : (
        <div className="tinker-error__frames">
          {error.frames.slice(0, 12).map((frame, index) => (
            <div className="tinker-error__frame" key={`${frame.file}:${frame.line}:${index}`}>
              <span className="tinker-error__call">{frame.call}</span>
              <span className="tinker-error__file">
                {frame.file === '' ? `snippet:${frame.line}` : `${frame.file}:${frame.line}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** The row the cursor is on reads differently from the other hits. */
function rowClass(path: string, target: string | undefined, matches: boolean): string {
  if (!matches) {
    return 'tinker-tree__row'
  }

  return path === target
    ? 'tinker-tree__row tinker-tree__row--hit tinker-tree__row--current'
    : 'tinker-tree__row tinker-tree__row--hit'
}

/** The text, with every occurrence of the needle marked. */
function Marked({ text, needle }: { text: string; needle: string }) {
  if (needle === '') {
    return <>{text}</>
  }

  return (
    <>
      {segments(text, needle).map((part, index) =>
        part.hit ? (
          <mark className="tinker-tree__mark" key={index}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      fill="none"
      height="12"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
      viewBox="0 0 24 24"
      width="12"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
