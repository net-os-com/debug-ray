import type { RayEvent } from '../../../shared/ray-event'
import { ErrorDetail } from './error-detail'
import { FieldsDetail } from './fields-detail'
import { FramesDetail, type Frame } from './frames-detail'
import { MeasureDetail } from './measure-detail'
import { TextDetail } from './text-detail'
import { ValueDetail } from './value-detail'

type DetailBodyProps = {
  event: RayEvent
  hideVendorFrames: boolean
}

export function DetailBody({ event, hideVendorFrames }: DetailBodyProps) {
  const content = event.content

  switch (event.type) {
    case 'log':
      return (
        <div className="detail-stack">
          {(Array.isArray(content.values) ? content.values : []).map((value, index) => (
            <ValueDetail key={index} value={value} />
          ))}
        </div>
      )

    case 'custom':
      return <ValueDetail allowHtml value={content.content} />

    case 'table':
      return content.values && typeof content.values === 'object' ? (
        <FieldsDetail fields={content.values as Record<string, unknown>} />
      ) : null

    case 'exception':
      return <ErrorDetail content={content} hideVendorFrames={hideVendorFrames} />

    case 'executed_query':
      return (
        <div className="detail-stack">
          <TextDetail text={String(content.sql ?? '')} />
          <FieldsDetail fields={{ Bindings: content.bindings, Connection: content.connection_name }} />
        </div>
      )

    case 'measure':
      return <MeasureDetail content={content} />

    case 'trace':
    case 'caller':
      return <FramesDetail frames={framesOf(content)} hideVendorFrames={hideVendorFrames} />

    case 'eloquent_model':
      return (
        <FieldsDetail
          fields={{
            Class: content.class_name,
            Attributes: content.attributes,
            Relations: content.relations,
          }}
        />
      )

    case 'event':
      return <FieldsDetail fields={{ Name: content.name, Event: content.event, Payload: content.payload }} />

    case 'job_event':
      return <FieldsDetail fields={{ Event: content.event_name, Job: content.job, Exception: content.exception }} />

    case 'mailable':
      return (
        <div className="detail-stack">
          <FieldsDetail
            fields={{
              Class: content.mailable_class,
              Subject: content.subject,
              From: content.from,
              To: content.to,
              Cc: content.cc,
              Bcc: content.bcc,
            }}
          />
          <ValueDetail allowHtml value={content.html} />
        </div>
      )

    case 'carbon':
      return (
        <FieldsDetail
          fields={{
            Formatted: content.formatted,
            Timestamp: content.timestamp,
            Timezone: content.timezone,
          }}
        />
      )

    case 'application_log':
      return (
        <div className="detail-stack">
          <ValueDetail value={content.value} />
          <ValueDetail value={content.context} />
        </div>
      )

    default:
      return <TextDetail text={JSON.stringify(content, null, 2)} />
  }
}

/** trace sends `frames`, caller sends a single `frame`. */
function framesOf(content: Record<string, unknown>): Frame[] {
  if (Array.isArray(content.frames)) {
    return content.frames as Frame[]
  }

  return content.frame ? [content.frame as Frame] : []
}
