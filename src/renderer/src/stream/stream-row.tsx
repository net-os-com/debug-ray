import type { CSSProperties } from 'react'
import type { RayEvent } from '../../../shared/ray-event'
import { eventPreview } from '../event-preview'
import { eventTitle } from '../event-title'
import { kindFor } from '../kind'
import { originLabel } from '../origin-label'
import { rayColor } from '../ray-color'
import { sourceOf } from '../filter-events'

type StreamRowProps = {
  event: RayEvent
  label: string | undefined
  color: string | undefined
  selected: boolean
  onSelect: () => void
}

export function StreamRow({ event, label, color, selected, onSelect }: StreamRowProps) {
  const kind = kindFor(event)

  // ray()->green() wins over the kind colour for the stripe, the way Ray tints
  // the whole entry.
  const stripe = rayColor(color) ?? `rgb(${kind.dot})`

  const style = {
    '--kind-dot': kind.dot,
    '--kind-fg-l': kind.fgLight,
    '--kind-fg-d': kind.fgDark,
    borderLeftColor: stripe,
  } as CSSProperties

  return (
    <div
      className={selected ? 'row row--selected' : 'row'}
      onClick={onSelect}
      style={style}
    >
      <div className="row__head">
        <span className="badge">{kind.label}</span>
        <span className="row__title">{eventTitle(event)}</span>
        {label ? (
          <span className="row__label">
            <span className="row__label-dot" style={{ background: stripe }} />
            {label}
          </span>
        ) : null}
        <span className="row__time">{formatTime(event.receivedAt)}</span>
      </div>
      <div className="row__preview">{eventPreview(event)}</div>
      <div className="row__origin">
        <span>{sourceOf(event)}</span>
        <span>·</span>
        <span className="row__file" title={event.origin.file ?? ''}>
          {originLabel(event.origin)}
        </span>
      </div>
    </div>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false })
}
