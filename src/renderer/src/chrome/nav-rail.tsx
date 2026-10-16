import { useFullScreen } from '../use-full-screen'
import { CHANGELOG_PATH, ModuleIcon, NetosMark, SETTINGS_PATH, StrokeIcon } from './module-icons'
import { GROUPS, MODULES, type View } from './view-nav'

type NavRailProps = {
  view: View
  onSelect: (view: View) => void
  onOpenSettings: () => void
  onOpenChangelog: () => void
  /** Whether there is a release you have not looked at yet. */
  unread: boolean
}

/**
 * The modules, down the left edge.
 *
 * It carries the window controls as well as the navigation, which is why the
 * whole rail is a drag region and every control inside it opts out. In full
 * screen macOS takes the controls away, so the gap reserved for them closes.
 */
export function NavRail({
  view,
  onSelect,
  onOpenSettings,
  onOpenChangelog,
  unread,
}: NavRailProps) {
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
              <ModuleIcon module={one.key} size={14} />
              <span className="nav-rail__item-label">{one.label}</span>
            </button>
          ))}
        </div>
      ))}

      {/*
        * Both sit in one foot, which is what carries the margin that pushes
        * them down. Giving each button its own `margin-top: auto` splits the
        * free space between them instead, which left the first one stranded
        * halfway up the rail.
        */}
      <div className="nav-rail__foot">
        <button
          className="nav-rail__settings nav-rail__changelog"
          onClick={onOpenChangelog}
          title={unread ? "What's new — there is an update to read" : "What's new"}
          type="button"
        >
          <StrokeIcon path={CHANGELOG_PATH} />
          {unread ? <span className="nav-rail__badge" /> : null}
        </button>

        <button
          className={
            view === 'settings' ? 'nav-rail__settings nav-rail__settings--on' : 'nav-rail__settings'
          }
          onClick={onOpenSettings}
          title="Settings"
          type="button"
        >
          <StrokeIcon path={SETTINGS_PATH} />
        </button>
      </div>
    </nav>
  )
}
