import { RayValue } from '../ui/value'
import type { PayloadProps } from './payload-props'

/** Backs ray()->html(), ->text(), ->image(), ->markdown(), booleans and null. */
export function CustomPayload({ event }: PayloadProps) {
  return <RayValue value={event.content.content} allowHtml />
}
