import type { PayloadProps } from './payload-props'

/** Payloads whose whole content is a single string under a known key. */
export function textContentPayload(key: string) {
  return function TextContentPayload({ event }: PayloadProps) {
    return <span className="value-str">{String(event.content[key] ?? '')}</span>
  }
}
