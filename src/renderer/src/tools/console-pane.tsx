import { useEffect, useMemo, useRef, useState } from 'react'
import { parseAnsi } from './ansi'
import type { StreamLine } from './stream-lines'

type ConsolePaneProps = {
  lines: StreamLine[]
  running: boolean
  exitCode: number | null | undefined
  problem: string | null
  empty: string
  onStop: () => void
  onClear: () => void
}

export function ConsolePane({
  lines,
  running,
  exitCode,
  problem,
  empty,
  onStop,
  onClear,
}: ConsolePaneProps) {
  const [filter, setFilter] = useState('')
  const body = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()

    return needle === '' ? lines : lines.filter((line) => line.text.toLowerCase().includes(needle))
  }, [lines, filter])

  // Follow the tail, unless you have scrolled up to read something — then
  // staying put is the whole point.
  useEffect(() => {
    const element = body.current

    if (element !== null && stick.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [shown])

  return (
    <div className="console">
      <div className="console__head">
        <span className="pane__label">Output</span>

        {running ? (
          <span className="console__status">
            <span className="console__pulse" />
            running
          </span>
        ) : exitCode === undefined ? null : (
          <span
            className="console__status"
            style={{ color: exitCode === 0 ? 'var(--ok-fg)' : 'var(--err-fg)' }}
          >
            exited {exitCode === null ? 'unexpectedly' : exitCode}
          </span>
        )}

        <input
          className="console__filter"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          value={filter}
        />

        <button className="button" disabled={!running} onClick={onStop} type="button">
          Stop
        </button>
        <button className="button" onClick={onClear} type="button">
          Clear
        </button>
      </div>

      <div
        className="console__body"
        onScroll={(event) => {
          const element = event.currentTarget
          const distance = element.scrollHeight - element.scrollTop - element.clientHeight

          stick.current = distance < 24
        }}
        ref={body}
      >
        {problem !== null ? <div className="console__problem">{problem}</div> : null}

        {shown.length === 0 && problem === null ? (
          <div className="console__empty">{filter === '' ? empty : `Nothing matches “${filter}”`}</div>
        ) : null}

        {shown.map((line, index) => (
          <div className={line.stream === 'err' ? 'console__line console__line--err' : 'console__line'} key={index}>
            {parseAnsi(line.text).map((span, position) => (
              <span
                key={position}
                style={{
                  color: span.color ?? undefined,
                  fontWeight: span.bold ? 600 : undefined,
                  opacity: span.dim ? 0.65 : undefined,
                }}
              >
                {span.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
