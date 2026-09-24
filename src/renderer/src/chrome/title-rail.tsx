import { useFullScreen } from '../use-full-screen'
import type { Theme } from '../use-theme'
import { GearIcon, MoonIcon } from '../ui/icons'

type TitleRailProps = {
  subtitle: string
  theme: Theme
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function TitleRail({ subtitle, theme, onToggleTheme, onOpenSettings }: TitleRailProps) {
  const fullScreen = useFullScreen()

  return (
    <div className={fullScreen ? 'rail rail--full-screen' : 'rail'}>
      <div className="rail__brand">
        <div className="rail__mark">N</div>
        <span className="rail__name">NetOS Debug</span>
        <span className="rail__subtitle">{subtitle}</span>
      </div>
      <div className="rail__actions">
        <button className="rail__theme" onClick={onToggleTheme} type="button">
          <MoonIcon />
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button
          className="rail__icon-button"
          onClick={onOpenSettings}
          title="Settings"
          type="button"
        >
          <GearIcon />
        </button>
      </div>
    </div>
  )
}
