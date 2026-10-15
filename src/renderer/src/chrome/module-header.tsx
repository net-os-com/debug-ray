import { useFullScreen } from '../use-full-screen'
import type { Theme } from '../use-theme'
import { MoonIcon, SearchIcon } from '../ui/icons'
import { moduleFor, type View } from './view-nav'

type ModuleHeaderProps = {
  view: View
  /** The project and target the receiver is listening on. */
  subtitle: string
  listening: boolean
  theme: Theme
  onOpenPalette: () => void
  onToggleTheme: (shift: boolean) => void
}

/**
 * The strip above the content: which module you are in, the way into the
 * command palette, and whether the receiver is up.
 *
 * The palette trigger is a button rather than an input. It opens the real
 * search, which has its own field and its own keyboard handling, and two text
 * boxes that have to agree about which one has the caret is a bug waiting to
 * be written.
 */
export function ModuleHeader({
  view,
  subtitle,
  listening,
  theme,
  onOpenPalette,
  onToggleTheme,
}: ModuleHeaderProps) {
  const module = moduleFor(view)
  const fullScreen = useFullScreen()

  return (
    <header className={fullScreen ? 'module-head module-head--full-screen' : 'module-head'}>
      <div className="module-head__what">
        <span className="module-head__label">{module?.label ?? 'Settings'}</span>
        <span className="module-head__hint">{module?.hint ?? 'Applies to this machine only'}</span>
      </div>

      <button className="module-head__search" onClick={onOpenPalette} type="button">
        <SearchIcon />
        <span className="module-head__search-text">Search modules and actions</span>
        <span className="module-head__key">⌘K</span>
      </button>

      <div className="module-head__right">
        <button
          className="module-head__theme"
          onClick={(event) => onToggleTheme(event.shiftKey)}
          title="Shift-click for something older"
          type="button"
        >
          <MoonIcon />
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
        <span className="module-head__status" title={subtitle}>
          <span
            className={listening ? 'module-head__dot module-head__dot--up' : 'module-head__dot'}
          />
          {subtitle}
        </span>
      </div>
    </header>
  )
}
