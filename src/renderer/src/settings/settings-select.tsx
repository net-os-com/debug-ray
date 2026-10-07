import { SettingRow } from './setting-row'

type SettingsSelectProps<T extends string> = {
  label: string
  hint: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

export function SettingsSelect<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: SettingsSelectProps<T>) {
  return (
    <SettingRow hint={hint} label={label}>
      <select
        className="input input--select"
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingRow>
  )
}
