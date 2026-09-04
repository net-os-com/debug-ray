import { FrameList, type Frame } from '../ui/frame-list'
import type { PayloadProps } from './payload-props'

export function TracePayload({ event }: PayloadProps) {
  const frames = Array.isArray(event.content.frames) ? (event.content.frames as Frame[]) : []

  return <FrameList frames={frames} />
}
