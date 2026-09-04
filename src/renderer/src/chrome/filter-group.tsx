export type FilterOption = {
  key: string
  label: string
  dot: string
  count: number
}

type FilterGroupProps = {
  title: string
  options: FilterOption[]
  active: string
  onSelect: (key: string) => void
}

export function FilterGroup({ title, options, active, onSelect }: FilterGroupProps) {
  return (
    <div>
      <div className="sidebar__heading">{title}</div>
      {options.map((option) => (
        <button
          className={option.key === active ? 'filter filter--active' : 'filter'}
          key={option.key}
          onClick={() => onSelect(option.key)}
          type="button"
        >
          <span className="filter__dot" style={{ background: option.dot }} />
          <span className="filter__label">{option.label}</span>
          <span className="filter__count">{option.count}</span>
        </button>
      ))}
    </div>
  )
}
