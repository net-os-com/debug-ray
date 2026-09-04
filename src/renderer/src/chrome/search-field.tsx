import { CloseIcon, SearchIcon } from '../ui/icons'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
}

export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <div className={value ? 'search search--filled' : 'search'}>
      <SearchIcon />
      <input
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter events"
        value={value}
      />
      {value ? (
        <button className="search__clear" onClick={() => onChange('')} title="Clear filter" type="button">
          <CloseIcon />
        </button>
      ) : null}
    </div>
  )
}
