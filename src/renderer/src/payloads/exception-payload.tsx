import { FrameList, type Frame } from '../ui/frame-list'
import type { PayloadProps } from './payload-props'

export function ExceptionPayload({ event }: PayloadProps) {
  const frames = Array.isArray(event.content.frames) ? (event.content.frames as Frame[]) : []

  return (
    <div className="stack">
      <div className="exception__class">{String(event.content.class ?? 'Exception')}</div>
      <div className="exception__message">{String(event.content.message ?? '')}</div>
      <FrameList frames={frames} />
    </div>
  )
}
