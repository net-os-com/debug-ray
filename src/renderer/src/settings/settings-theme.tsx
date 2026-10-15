import type { Theme } from '../use-theme'
import { MoonIcon, SunIcon } from '../ui/icons'
import { SettingRow } from './setting-row'

type SettingsThemeProps = {
  theme: Theme
  onToggle: (shift: boolean) => void
}

/**
 * The same control that used to sit in the header, moved here.
 *
 * A button rather than a select, so the shift-click that reaches the phosphor
 * theme comes along with it — a select's change event carries no modifier, and
 * listing phosphor as a third option would turn a joke you have to find into
 * one of three ordinary choices.
 */
export function SettingsTheme({ theme, onToggle }: SettingsThemeProps) {
  return (
    <SettingRow
      hint="Light or dark. Shift-click for something older."
      label="Appearance"
    >
      <button
        className="button"
        onClick={(event) => onToggle(event.shiftKey)}
        type="button"
      >
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        {theme === 'light' ? 'Dark' : theme === 'dark' ? 'Light' : 'Back to dark'}
      </button>
    </SettingRow>
  )
}
