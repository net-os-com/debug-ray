import { SettingRow } from './setting-row'

type SettingsToggleProps = {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}

export function SettingsToggle({ label, hint, on, onToggle }: SettingsToggleProps) {
  return (
    <SettingRow hint={hint} label={label}>
      <button
        aria-pressed={on}
        className={on ? 'switch switch--on' : 'switch'}
        onClick={onToggle}
        type="button"
      >
        <span className="switch__knob" />
      </button>
    </SettingRow>
  )
}
