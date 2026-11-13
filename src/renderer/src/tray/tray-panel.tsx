import { useEffect, useMemo } from 'react'
import { groupEvents } from '../stream/group-events'
import { useNow } from '../use-now'
import { useRayEvents } from '../use-ray-events'
import { TrayRow } from './tray-row'
import { TrayStatus } from './tray-status'
import { usePanelPreferences } from './use-panel-preferences'

/**
 * The panel under the menu bar icon: whether the receiver listens, and what
 * arrived. For a glance, not for work — anything you want to do with an event
 * happens in the main window, which a click on a row opens on that event.
 *
 * It shows everything the receiver kept for the stream: the stream's filters
 * and its pause belong to the window and are not applied here.
 */
export function TrayPanel() {
  const { theme, relativeTime, eventBuffer } = usePanelPreferences()
  const now = useNow(relativeTime)

  // The same hook the stream uses, so it fills from the main process's log,
  // follows every clear and `clear_all`, and leaves requests and annotations
  // out exactly as the stream does. The panel never clears it itself.
  const { events, labels, colors } = useRayEvents({ paused: false, maxEvents: eventBuffer })

  const groups = useMemo(
    () => groupEvents([...events].reverse(), labels, colors, 'newest'),
    [events, labels, colors],
  )

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
      <div className="tray__list">
        {groups.length === 0 ? (
          <div className="tray__empty">No events yet</div>
        ) : (
          groups.map((group) => (
            <TrayRow
              key={group.event.id}
              group={group}
              label={labels[group.event.uuid]}
              color={colors[group.event.uuid]}
              relative={relativeTime}
              now={now}
              onOpen={(id) => window.ray.openEventInApp(id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
