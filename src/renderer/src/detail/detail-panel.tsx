import type { CSSProperties } from 'react'
import type { RayEvent } from '../../../shared/ray-event'
import { eventTitle } from '../event-title'
import { sourceOf } from '../filter-events'
import { kindFor } from '../kind'
import { CloseIcon } from '../ui/icons'
import { CopyButton } from './copy-button'
import { copyText } from './copy-text'
import { DetailBody } from './detail-body'
import { ResizeHandle } from './resize-handle'

type DetailPanelProps = {
  event: RayEvent
  hideVendorFrames: boolean
  width: number
  onResize: (width: number, containerWidth: number) => void
  onResetWidth: () => void
  onClose: () => void
}

export function DetailPanel({
  event,
  hideVendorFrames,
  width,
  onResize,
  onResetWidth,
  onClose,
}: DetailPanelProps) {
  const kind = kindFor(event)

  const style = {
    '--kind-dot': kind.dot,
    '--kind-fg-l': kind.fgLight,
    '--kind-fg-d': kind.fgDark,
    flexBasis: `${width}px`,
  } as CSSProperties

  const meta = [
    { key: 'Source', value: sourceOf(event) },
    { key: 'Origin', value: `${event.origin.file ?? '—'}:${event.origin.line_number ?? '?'}` },
    { key: 'Time', value: new Date(event.receivedAt).toLocaleTimeString(undefined, { hour12: false }) },
    { key: 'Type', value: event.type },
    duration(event),
    project(event),
  ].filter((row): row is { key: string; value: string } => row !== null)

  return (
    <aside className="detail" style={style}>
      <ResizeHandle onReset={onResetWidth} onResize={onResize} width={width} />

      <div className="detail__head">
        <div className="detail__head-top">
          <span className="badge">{kind.label}</span>
          <button className="detail__close" onClick={onClose} title="Close" type="button">
            <CloseIcon size={13} />
          </button>
        </div>
        <div className="detail__title">{eventTitle(event)}</div>
        <div className="detail__meta">
          {meta.map((row) => (
            <div className="detail__meta-row" key={row.key}>
              <span className="detail__meta-key">{row.key}</span>
              <span className="detail__meta-value">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detail__body">
        <DetailBody event={event} hideVendorFrames={hideVendorFrames} />

        <div className="detail__actions">
          <CopyButton text={copyText(event)} />
        </div>
      </div>
    </aside>
  )
}

function duration(event: RayEvent): { key: string; value: string } | null {
  const time = event.content.time

  return typeof time === 'number' ? { key: 'Duration', value: `${time} ms` } : null
}

function project(event: RayEvent): { key: string; value: string } | null {
  const name = event.meta.project_name

  return typeof name === 'string' && name ? { key: 'Project', value: name } : null
}
