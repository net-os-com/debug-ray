import { FieldTable } from '../ui/field-table'
import { RawHtml } from '../ui/raw-html'
import type { PayloadProps } from './payload-props'

export function MailablePayload({ event }: PayloadProps) {
  const { html, subject, from, to, cc, bcc, mailable_class } = event.content

  return (
    <div className="stack">
      <FieldTable
        fields={{ Class: mailable_class, Subject: subject, From: from, To: to, Cc: cc, Bcc: bcc }}
      />
      {typeof html === 'string' ? <RawHtml html={html} /> : null}
    </div>
  )
}
