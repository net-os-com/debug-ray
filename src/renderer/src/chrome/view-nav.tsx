export type View = 'stream' | 'requests' | 'settings'

type ViewNavProps = {
  view: View
  onSelect: (view: View) => void
}

/** The Stream / Requests switch in the rail. Settings is reached by the gear. */
export function ViewNav({ view, onSelect }: ViewNavProps) {
  return (
    <div className="view-nav">
      {(['stream', 'requests'] as const).map((key) => (
        <button
          className={view === key ? 'view-nav__item view-nav__item--active' : 'view-nav__item'}
          key={key}
          onClick={() => onSelect(key)}
          type="button"
        >
          {key === 'stream' ? 'Stream' : 'Requests'}
        </button>
      ))}
    </div>
  )
}
