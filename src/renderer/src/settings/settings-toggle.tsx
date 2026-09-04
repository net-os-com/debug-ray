type SettingsToggleProps = {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}

export function SettingsToggle({ label, hint, on, onToggle }: SettingsToggleProps) {
  return (
    <div className="setting">
      <div className="setting__text">
        <div className="setting__label">{label}</div>
        <div className="setting__hint">{hint}</div>
      </div>
      <button
        aria-pressed={on}
        className={on ? 'switch switch--on' : 'switch'}
        onClick={onToggle}
        type="button"
      >
        <span className="switch__knob" />
      </button>
    </div>
  )
}
