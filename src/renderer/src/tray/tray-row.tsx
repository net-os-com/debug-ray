import type { CSSProperties } from 'react'
import { clockTime } from '../clock-time'
import { eventTitle } from '../event-title'
import { kindFor } from '../kind'
import { rayColor } from '../ray-color'
import { relativeTime } from '../relative-time'
import type { StreamGroup } from '../stream/group-events'

type TrayRowProps = {
  group: StreamGroup
  label: string | undefined
  color: string | undefined
  relative: boolean
  now: number
  onOpen: (id: string) => void
}

/**
 * One event in the menu bar panel, on one line.
 *
 * The stream's row, cut down to what a glance needs: the stripe and badge say
 * what kind it is, the title says what it is, the time says when. The whole
 * row is the way into the app — there is no file link to aim around.
 */
export function TrayRow({ group, label, color, relative, now, onOpen }: TrayRowProps) {
  const { event, count, latestAt } = group
  const kind = kindFor(event)

  // ray()->green() wins over the kind colour, as it does in the stream.
  const style = {
    '--kind-dot': kind.dot,
    '--kind-fg-l': kind.fgLight,
    '--kind-fg-d': kind.fgDark,
    borderLeftColor: rayColor(color) ?? `rgb(${kind.dot})`,
  } as CSSProperties

  return (
    <button
      type="button"
      className="tray-row"
      style={style}
      title={label}
      onClick={() => onOpen(event.id)}
    >
      <span className="badge">{kind.label}</span>
      <span className="tray-row__title">{eventTitle(event)}</span>
      {count > 1 ? <span className="pill">×{count}</span> : null}
      <span className="tray-row__time" title={clockTime(latestAt)}>
        {relative ? relativeTime(latestAt, now) : clockTime(latestAt)}
      </span>
    </button>
  )
}
