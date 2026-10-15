import { useEffect, useMemo, useRef, useState } from 'react'
import { ModuleIcon, StrokeIcon } from '../chrome/module-icons'
import { SearchIcon } from '../ui/icons'
import { flatten, narrowCommands, type CommandGroup } from './commands'

type CommandPaletteProps = {
  groups: CommandGroup[]
  onClose: () => void
}

/**
 * Go to a module, or run something, without knowing where it lives.
 *
 * The highlighted row is tracked by index into the flattened list rather than
 * by command id: the list is rebuilt on every keystroke, and an id that no
 * longer matches would leave the selection pointing at nothing while the arrow
 * keys still moved it.
 */
export function CommandPalette({ groups, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const narrowed = useMemo(() => narrowCommands(groups, query), [groups, query])
  const items = useMemo(() => flatten(narrowed), [narrowed])
  const list = useRef<HTMLDivElement>(null)

  // Typing changes what is on screen, so the highlight goes back to the top
  // rather than staying on whatever row happens to be in that position now.
  useEffect(() => setActive(0), [query])

  // Keeps the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (index: number): void => {
    const picked = items[index]

    if (picked !== undefined) {
      picked.run()
      onClose()
    }
  }

  return (
    <div className="palette" onPointerDown={onClose}>
      <div className="palette__panel" onPointerDown={(event) => event.stopPropagation()}>
        <div className="palette__head">
          <SearchIcon size={20} />
          <input
            autoFocus
            className="palette__input"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
                event.preventDefault()
                setActive((current) => (items.length === 0 ? 0 : (current + 1) % items.length))
              }

              if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
                event.preventDefault()
                setActive((current) =>
                  items.length === 0 ? 0 : (current - 1 + items.length) % items.length,
                )
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                run(active)
              }
            }}
            placeholder="Go to a module or run an action"
            spellCheck={false}
            value={query}
          />
          <span className="palette__esc">esc</span>
        </div>

        <div className="palette__body" ref={list}>
          {items.length === 0 ? (
            <div className="palette__none">Nothing matches “{query}”.</div>
          ) : (
            narrowed.map((group) => (
              <div key={group.label}>
                <div className="palette__group">{group.label}</div>
                {group.items.map((command) => {
                  const index = items.indexOf(command)
                  const on = index === active

                  return (
                    <button
                      className={on ? 'palette__row palette__row--on' : 'palette__row'}
                      data-active={on}
                      key={command.id}
                      onClick={() => run(index)}
                      onPointerEnter={() => setActive(index)}
                      type="button"
                    >
                      <span
                        className={on ? 'palette__tile palette__tile--on' : 'palette__tile'}
                      >
                        {command.module === null ? (
                          <StrokeIcon path={command.icon} size={16} />
                        ) : (
                          <ModuleIcon module={command.module} size={16} />
                        )}
                      </span>
                      <span className="palette__label">{command.label}</span>
                      <span className="palette__hint">{command.hint}</span>
                      <span className="palette__key">{command.key}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
