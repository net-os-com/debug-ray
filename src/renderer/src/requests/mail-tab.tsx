import { useState } from 'react'
import type { HttpRequest, MailMessage } from './types'

export function MailTab({ request }: { request: HttpRequest }) {
  if (request.mail.length === 0) {
    return (
      <div className="tab-pane">
        <div className="pane__none">No mail was sent during this request.</div>
      </div>
    )
  }

  return (
    <div className="tab-pane">
      {request.mail.map((message, index) => (
        <Message key={index} message={message} />
      ))}
    </div>
  )
}

function Message({ message }: { message: MailMessage }) {
  const [showing, setShowing] = useState<'text' | 'html'>(message.text === null ? 'html' : 'text')
  const body = showing === 'text' ? message.text : message.html

  return (
    <div className="card mail">
      <div className="card__title">{message.subject === '' ? '(no subject)' : message.subject}</div>

      <div className="mail__addresses">
        <Addresses label="From" values={message.from} />
        <Addresses label="To" values={message.to} />
        <Addresses label="Cc" values={message.cc} />
        <Addresses label="Bcc" values={message.bcc} />
        <Addresses label="Reply-To" values={message.replyTo} />
      </div>

      {message.text === null && message.html === null ? (
        <div className="card__note">The body was not collected.</div>
      ) : (
        <>
          <div className="mail__tabs">
            {(['text', 'html'] as const).map((kind) => (
              <button
                className={kind === showing ? 'button button--primary' : 'button'}
                disabled={message[kind] === null}
                key={kind}
                onClick={() => setShowing(kind)}
                type="button"
              >
                {kind === 'text' ? 'Plain text' : 'HTML'}
              </button>
            ))}
          </div>

          {/*
            The HTML is shown as source rather than rendered. Rendering a mail
            template would run whatever it contains inside the app, and a debug
            tool has no business doing that with a page it did not write.
          */}
          <pre className="mail__body">{body?.value ?? ''}</pre>

          {body?.truncated === true ? (
            <div className="card__note">Trimmed by the collector at 8 KB.</div>
          ) : null}
        </>
      )}
    </div>
  )
}

function Addresses({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) {
    return null
  }

  return (
    <div className="mail__row">
      <span className="mail__label">{label}</span>
      <span className="mail__value">{values.join(', ')}</span>
    </div>
  )
}
