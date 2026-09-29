import type { RayEvent } from '../../../shared/ray-event'
import { ErrorDetail } from './error-detail'
import { FieldsDetail } from './fields-detail'
import { FramesDetail, type Frame } from './frames-detail'
import { MeasureDetail } from './measure-detail'
import { CodeBlock } from './payloads/code-block'
import { CustomDetail } from './payloads/custom-detail'
import { JsonTree } from './payloads/json-tree'
import { ResponseDetail } from './payloads/response-detail'
import { ColorSwatch, ScreenControl } from './payloads/screen-control'
import { TableDetail } from './payloads/table-detail'
import { ViewDetail } from './payloads/view-detail'
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
      return <CustomDetail content={content} />

    case 'table':
      return <TableDetail content={content} />

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

    // json() sends the decoded structure; toJson() sends the string it made.
    case 'json_string':
      return <JsonString value={content.value} />

    case 'response':
      return <ResponseDetail content={content} />

    case 'view':
      return <ViewDetail content={content} />

    case 'notify':
      return <div className="notify-detail">{String(content.value ?? '')}</div>

    case 'create_lock':
      return <ScreenControl call="createLock()" detail={String(content.name ?? '')} />

    case 'new_screen':
      return <ScreenControl call="newScreen()" detail={String(content.name ?? '')} />

    case 'clear_all':
      return <ScreenControl call="clearAll()" />

    case 'hide':
      return <ScreenControl call="hide()" />

    case 'remove':
      return <ScreenControl call="remove()" />

    case 'hide_app':
      return <ScreenControl call="hideApp()" />

    case 'show_app':
      return <ScreenControl call="showApp()" />

    case 'separator':
      return <ScreenControl call="separator()" />

    case 'size':
      return <ScreenControl call="size()" detail={String(content.size ?? '')} />

    case 'expand':
      return (
        <ScreenControl
          call="expand()"
          detail={
            Array.isArray(content.keys) && content.keys.length > 0
              ? content.keys.join(', ')
              : `level ${content.level ?? 'all'}`
          }
        />
      )

    case 'color':
      return <ColorSwatch call="color()" color={String(content.color ?? '')} />

    case 'screen_color':
      return <ColorSwatch call="screenColor()" color={String(content.color ?? '')} />

    case 'label':
      return <ScreenControl call="label()" detail={String(content.label ?? '')} />

    default:
      return <CodeBlock caption={event.type} code={JSON.stringify(content, null, 2)} />
  }
}

/**
 * `toJson()` sends JSON as a string, so it is parsed back before it is drawn —
 * and left as text when it will not parse, because a malformed payload is
 * exactly the thing you sent it to look at.
 */
function JsonString({ value }: { value: unknown }) {
  const source = typeof value === 'string' ? value : JSON.stringify(value)

  try {
    return <JsonTree value={JSON.parse(source)} />
  } catch {
    return <CodeBlock caption="Not valid JSON" code={source} />
  }
}

/** trace sends `frames`, caller sends a single `frame`. */
function framesOf(content: Record<string, unknown>): Frame[] {
  if (Array.isArray(content.frames)) {
    return content.frames as Frame[]
  }

  return content.frame ? [content.frame as Frame] : []
}
