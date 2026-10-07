import { SettingRow } from './setting-row'

type SettingsTextProps = {
  label: string
  hint: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

export function SettingsText({ label, hint, value, placeholder, onChange }: SettingsTextProps) {
  return (
    <SettingRow hint={hint} label={label}>
      <input
        className="input input--text"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </SettingRow>
  )
}
