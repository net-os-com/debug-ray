import { SettingRow } from './setting-row'

type SettingsListProps = {
  label: string
  hint: string
  value: string[]
  placeholder?: string
  onChange: (value: string[]) => void
}

/**
 * One entry per line. A chip editor would look tidier, but this list is edited
 * once in a while and read far more often, and a textarea shows the whole thing
 * at a glance instead of hiding it behind a row of pills.
 */
export function SettingsList({ label, hint, value, placeholder, onChange }: SettingsListProps) {
  return (
    <SettingRow hint={hint} label={label}>
      <textarea
        className="input input--list"
        onChange={(event) =>
          onChange(
            event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line !== ''),
          )
        }
        placeholder={placeholder}
        rows={3}
        value={value.join('\n')}
      />
    </SettingRow>
  )
}
