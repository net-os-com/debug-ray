import { useFullScreen } from '../use-full-screen'
import { ModuleIcon, NetosMark, SETTINGS_PATH, StrokeIcon } from './module-icons'
import { GROUPS, MODULES, type View } from './view-nav'

type NavRailProps = {
  view: View
  onSelect: (view: View) => void
  onOpenSettings: () => void
}

/**
 * The modules, down the left edge.
 *
 * It carries the window controls as well as the navigation, which is why the
 * whole rail is a drag region and every control inside it opts out. In full
 * screen macOS takes the controls away, so the gap reserved for them closes.
 */
export function NavRail({ view, onSelect, onOpenSettings }: NavRailProps) {
  const fullScreen = useFullScreen()

  return (
    <nav className={fullScreen ? 'nav-rail nav-rail--full-screen' : 'nav-rail'}>
      <div className="nav-rail__mark">
        <NetosMark />
      </div>

      {GROUPS.map((group) => (
        <div className="nav-rail__group" key={group}>
          <span className="nav-rail__group-label">{group}</span>
          {MODULES.filter((one) => one.group === group).map((one) => (
            <button
              className={
                view === one.key ? 'nav-rail__item nav-rail__item--on' : 'nav-rail__item'
              }
              key={one.key}
              onClick={() => onSelect(one.key)}
              title={`${one.label} · ⌘${MODULES.indexOf(one) + 1}`}
              type="button"
            >
              <ModuleIcon module={one.key} size={12} />
              <span className="nav-rail__item-label">{one.label}</span>
            </button>
          ))}
        </div>
      ))}

      <button
        className={view === 'settings' ? 'nav-rail__settings nav-rail__settings--on' : 'nav-rail__settings'}
        onClick={onOpenSettings}
        title="Settings"
        type="button"
      >
        <StrokeIcon path={SETTINGS_PATH} />
      </button>
    </nav>
  )
}
