export type View = 'stream' | 'requests' | 'tinker' | 'settings'

type ViewNavProps = {
  view: View
  onSelect: (view: View) => void
}

const LABELS = { stream: 'Stream', requests: 'Requests', tinker: 'Tinker' } as const

/** The view switch in the rail. Settings is reached by the gear. */
export function ViewNav({ view, onSelect }: ViewNavProps) {
  return (
    <div className="view-nav">
      {(['stream', 'requests', 'tinker'] as const).map((key) => (
        <button
          className={view === key ? 'view-nav__item view-nav__item--active' : 'view-nav__item'}
          key={key}
          onClick={() => onSelect(key)}
          type="button"
        >
          {LABELS[key]}
        </button>
      ))}
    </div>
  )
}
