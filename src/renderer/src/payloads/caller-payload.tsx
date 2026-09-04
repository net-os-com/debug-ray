import { FrameList, type Frame } from '../ui/frame-list'
import type { PayloadProps } from './payload-props'

export function CallerPayload({ event }: PayloadProps) {
  const frame = event.content.frame as Frame | undefined

  return <FrameList frames={frame ? [frame] : []} />
}
