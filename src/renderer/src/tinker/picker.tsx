import { useEffect, useRef } from 'react'

export type PickerItem = {
  key: string
  name: string
  meta?: string
  /** Green when true, grey when false, absent when the item has no state. */
  up?: boolean
  enabled: boolean
}

type PickerProps = {
  label: string
  value: string
  items: PickerItem[]
  open: boolean
  onToggle: () => void
  onSelect: (key: string) => void
}

/** The dropdown the canvas uses for the container, reused for the tenant. */
export function Picker({ label, value, items, open, onToggle, onSelect }: PickerProps) {
  const root = useRef<HTMLDivElement>(null)

  // Clicking anywhere else closes it, the way a menu is expected to behave.
  useEffect(() => {
    if (!open) {
      return
    }

    const close = (event: MouseEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        onToggle()
      }
    }

    document.addEventListener('mousedown', close)

    return () => document.removeEventListener('mousedown', close)
  }, [open, onToggle])

  const selected = items.find((item) => item.key === value)

  return (
    <div className="picker" ref={root}>
      <button className="picker__button" onClick={onToggle} type="button">
        {selected?.up === undefined ? null : (
          <span
            className="picker__dot"
            style={{ background: selected.up ? 'var(--ok-fg)' : 'var(--t3)' }}
          />
        )}
        <span className="picker__label">{label}</span>
        <span className="picker__value">{selected?.name ?? '—'}</span>
        <Chevron />
      </button>

      {open ? (
        <div className="picker__menu">
          {items.map((item) => (
            <button
              className={item.key === value ? 'picker__item picker__item--on' : 'picker__item'}
              disabled={!item.enabled}
              key={item.key}
              onClick={() => onSelect(item.key)}
              type="button"
            >
              {item.up === undefined ? null : (
                <span
                  className="picker__dot"
                  style={{ background: item.up ? 'var(--ok-fg)' : 'var(--t3)' }}
                />
              )}
              <span className="picker__item-text">
                <span className="picker__item-name">{item.name}</span>
                {item.meta === undefined ? null : (
                  <span className="picker__item-meta">{item.meta}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Chevron() {
  return (
    <svg
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
