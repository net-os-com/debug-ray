import { useEffect } from 'react'
import { TrayStatus } from './tray-status'
import { usePanelPreferences } from './use-panel-preferences'

/**
 * The panel under the menu bar icon: whether the receiver listens, and what
 * arrived. For a glance, not for work — anything you want to do with an event
 * happens in the main window.
 */
export function TrayPanel() {
  const { theme } = usePanelPreferences()

  // Escape puts it away, as it would a menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        window.ray.hideTrayPanel()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="tray" data-app={theme}>
      <TrayStatus />
      <div className="tray__list" />
    </div>
  )
}
