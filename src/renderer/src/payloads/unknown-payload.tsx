import type { PayloadProps } from './payload-props'

/** Fallback for payload types we have not styled yet, so nothing gets lost. */
export function UnknownPayload({ event }: PayloadProps) {
  return <pre className="value-json">{JSON.stringify(event.content, null, 2)}</pre>
}
