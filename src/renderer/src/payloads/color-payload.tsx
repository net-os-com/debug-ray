import type { PayloadProps } from './payload-props'

/** ray()->green() and friends colour the whole entry; this just names it. */
export function ColorPayload({ event }: PayloadProps) {
  return <span className="value-str">{String(event.content.color ?? '')}</span>
}
