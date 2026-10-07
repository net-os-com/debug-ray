import { SettingRow } from './setting-row'

type SettingsNumberProps = {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function SettingsNumber({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: SettingsNumberProps) {
  return (
    <SettingRow hint={hint} label={label}>
      <div className="setting__field">
        <input
          className="input input--number"
          max={max}
          min={min}
          onChange={(event) => {
            const next = Number(event.target.value)

            // An empty field reads as 0; clamping here keeps a half-typed value
            // from becoming a buffer of zero events.
            if (Number.isFinite(next)) {
              onChange(Math.min(max, Math.max(min, next)))
            }
          }}
          step={step}
          type="number"
          value={value}
        />
        {unit ? <span className="setting__unit">{unit}</span> : null}
      </div>
    </SettingRow>
  )
}
