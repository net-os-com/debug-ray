import type { ComponentType } from 'react'
import { ApplicationLogPayload } from './payloads/application-log-payload'
import { CallerPayload } from './payloads/caller-payload'
import { CarbonPayload } from './payloads/carbon-payload'
import { ColorPayload } from './payloads/color-payload'
import { CustomPayload } from './payloads/custom-payload'
import { EloquentModelPayload } from './payloads/eloquent-model-payload'
import { EventPayload } from './payloads/event-payload'
import { ExceptionPayload } from './payloads/exception-payload'
import { ExecutedQueryPayload } from './payloads/executed-query-payload'
import { JobEventPayload } from './payloads/job-event-payload'
import { LogPayload } from './payloads/log-payload'
import { MailablePayload } from './payloads/mailable-payload'
import { MeasurePayload } from './payloads/measure-payload'
import type { PayloadProps } from './payloads/payload-props'
import { SeparatorPayload } from './payloads/separator-payload'
import { TablePayload } from './payloads/table-payload'
import { textContentPayload } from './payloads/text-content-payload'
import { TracePayload } from './payloads/trace-payload'
import { UnknownPayload } from './payloads/unknown-payload'

/**
 * Payload type as sent by spatie/ray and spatie/laravel-ray. Anything missing
 * here still shows up, as raw JSON, via UnknownPayload.
 */
const VIEWS: Record<string, ComponentType<PayloadProps>> = {
  application_log: ApplicationLogPayload,
  caller: CallerPayload,
  carbon: CarbonPayload,
  color: ColorPayload,
  custom: CustomPayload,
  eloquent_model: EloquentModelPayload,
  event: EventPayload,
  exception: ExceptionPayload,
  executed_query: ExecutedQueryPayload,
  job_event: JobEventPayload,
  json_string: textContentPayload('value'),
  label: textContentPayload('label'),
  log: LogPayload,
  mailable: MailablePayload,
  measure: MeasurePayload,
  notify: textContentPayload('value'),
  separator: SeparatorPayload,
  table: TablePayload,
  trace: TracePayload,
}

export function PayloadView({ event }: PayloadProps) {
  const View = VIEWS[event.type] ?? UnknownPayload

  return <View event={event} />
}
