import { useEffect, useRef } from 'react'
import type { ClassEntry } from './rank-classes'

type CompletionPopupProps = {
  entries: ClassEntry[]
  active: number
  left: number
  top: number
  onPick: (entry: ClassEntry) => void
}

export function CompletionPopup({ entries, active, left, top, onPick }: CompletionPopupProps) {
  const list = useRef<HTMLDivElement>(null)

  // Arrowing past the visible rows should scroll the list, not lose the caret.
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <div className="completion" ref={list} style={{ left: `${left}px`, top: `${top}px` }}>
      {entries.map((entry, index) => (
        <button
          className={index === active ? 'completion__item completion__item--on' : 'completion__item'}
          key={entry.fqcn}
          // Mouse down rather than click: clicking blurs the textarea first, and
          // a blurred editor has no caret to insert at.
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(entry)
          }}
          type="button"
        >
          <span className="completion__short">{entry.short}</span>
          <span className="completion__namespace">{namespaceOf(entry.fqcn)}</span>
        </button>
      ))}
    </div>
  )
}

function namespaceOf(fqcn: string): string {
  const cut = fqcn.lastIndexOf('\\')

  return cut === -1 ? '' : fqcn.slice(0, cut)
}
