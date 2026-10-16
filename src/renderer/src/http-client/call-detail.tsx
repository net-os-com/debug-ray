import { useState } from 'react'
import type { OutgoingCall, TraceFrame } from '../../../shared/http-client'
import { JsonTree } from '../detail/payloads/json-tree'
import { methodColor, size, statusBackground, statusColor } from '../api/method-color'
import { CallTimeline } from './call-timeline'
import { asCurl } from './curl'
import { duration } from './call-list'
import { failed, type CallTab, type HttpClientState } from './use-http-client'

/** The header names whose value is a credential rather than information. */
const SECRET = /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie|x-amz-security-token|x-auth-token)$/i

const TABS: { key: CallTab; label: string }[] = [
  { key: 'request', label: 'Request' },
  { key: 'response', label: 'Response' },
  { key: 'timing', label: 'Timing' },
  { key: 'trace', label: 'Called from' },
]

/** What the package writes in place of a credential it stripped. */
function redacted(value: string): boolean {
  return value.startsWith('\u2039redacted')
}

const ORIGIN_LABELS: Record<OutgoingCall['context']['kind'], string> = {
  request: 'request',
  queue: 'job',
  console: 'command',
  unknown: 'elsewhere',
}

export function CallDetail({ http }: { http: HttpClientState }) {
  const call = http.selected

  if (call === null) {
    return (
      <aside className="hc-detail">
        <div className="hc-detail__none">Select a call to see the request, response and timing.</div>
      </aside>
    )
  }

  return (
    <aside className="hc-detail">
      <div className="hc-detail__head">
        <div className="hc-detail__status">
          <span className="hc-mono hc-method" style={{ color: methodColor(call.method) }}>
            {call.method}
          </span>
          <span
            className="hc-status"
            style={{
              background: call.status === 0 ? 'var(--err-bg)' : statusBackground(call.status),
              color: call.status === 0 ? 'var(--err-fg)' : statusColor(call.status),
            }}
          >
            {call.status === 0 ? 'no answer' : `${call.status} ${call.reason}`.trim()}
          </span>
          <span className="hc-mono hc-dim hc-detail__dur">{duration(call.durationMs)}</span>
        </div>

        <div className="hc-detail__url">
          <span className="hc-dim">{call.host}</span>
          <span>{call.path}</span>
          {call.query === '' ? null : <span className="hc-dim">?{call.query}</span>}
        </div>

        <div className="hc-facts">
          <span className="hc-dim">Client</span>
          <span>Http facade</span>
          <span className="hc-dim">Origin</span>
          <span className="hc-facts__origin">
            <span className="hc-chip">{ORIGIN_LABELS[call.context.kind]}</span>
            <span className="hc-mono">{call.context.name ?? '—'}</span>
          </span>
          <span className="hc-dim">Tenant</span>
          <span>{call.tenant ?? '—'}</span>
          <span className="hc-dim">Sent at</span>
          <span className="hc-mono hc-dim">{new Date(call.startedAt).toLocaleTimeString()}</span>
        </div>

        <Actions call={call} />
      </div>

      <div className="hc-detail__tabs">
        {TABS.map((tab) => (
          <button
            className={http.tab === tab.key ? 'api-tab api-tab--on' : 'api-tab'}
            key={tab.key}
            onClick={() => http.setTab(tab.key)}
            type="button"
          >
            {tab.label}
            {/* The app's own frames, counted — a call made entirely from vendor
                code has none, and a badge saying 0 is worse than no badge. */}
            {tab.key === 'trace' && call.trace.some((one) => !one.vendor) ? (
              <span className="api-tab__count">{call.trace.filter((one) => !one.vendor).length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="hc-detail__body">
        {http.tab === 'request' ? (
          <>
            <Headers
              headers={call.requestHeaders}
              onToggle={http.toggleSecrets}
              secrets={http.secrets}
            />
            <Body body={call.requestBody} label="Body" />
          </>
        ) : null}

        {http.tab === 'response' ? (
          <>
            {call.error === null ? null : <div className="hc-error">{call.error}</div>}
            {failed(call) && call.error === null && call.responseBody === '' ? (
              <div className="api-pairs__empty">
                {call.status} {call.reason} with an empty body.
              </div>
            ) : null}
            {call.error === null ? (
              <>
                <Headers headers={call.responseHeaders} onToggle={http.toggleSecrets} secrets={http.secrets} />
                <Body body={call.responseBody} label={`Body · ${size(call.responseBody.length)}`} />
              </>
            ) : null}
          </>
        ) : null}

        {http.tab === 'timing' ? <CallTimeline call={call} /> : null}

        {http.tab === 'trace' ? (
          <Trace
            frames={call.trace}
            onToggle={http.toggleVendorFrames}
            vendor={http.vendorFrames}
          />
        ) : null}
      </div>
    </aside>
  )
}

function Actions({ call }: { call: OutgoingCall }) {
  const [copied, setCopied] = useState(false)

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(asCurl(call))
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="hc-actions">
      <button className="button" onClick={() => void copy()} type="button">
        {copied ? 'Copied' : 'Copy as cURL'}
      </button>
    </div>
  )
}

type HeadersProps = {
  headers: { key: string; value: string }[]
  secrets: boolean
  onToggle: () => void
}

/**
 * A credential is hidden until it is asked for.
 *
 * Two layers, deliberately. The package replaces the headers it knows about
 * before they leave PHP, so the token never reaches this window at all; this
 * hides whatever else looks like a credential but arrived in the clear — a
 * header somebody's `redact` list does not cover yet.
 *
 * A value the package already replaced is shown as it is: `‹redacted, 31
 * characters›` is not a secret, it is the explanation of one, and masking it
 * would promise a reveal that cannot happen.
 */
function Headers({ headers, secrets, onToggle }: HeadersProps) {
  if (headers.length === 0) {
    return <div className="api-pairs__empty">No headers.</div>
  }

  return (
    <div className="hc-section">
      <div className="hc-section__head">
        <span className="hc-section__title">Headers</span>
        <button className="hc-switch" onClick={onToggle} type="button">
          <span className={secrets ? 'hc-switch__track hc-switch__track--on' : 'hc-switch__track'}>
            <span className="hc-switch__knob" />
          </span>
          Show secrets
        </button>
      </div>

      <div className="hc-headers">
        {headers.map((header, index) => {
          const hidden = !secrets && SECRET.test(header.key) && !redacted(header.value)

          return (
            <div className="hc-headers__row" key={`${header.key}-${index}`}>
              <span className="hc-dim">{header.key}</span>
              <span className={hidden ? 'hc-dim' : ''}>
                {hidden ? '•'.repeat(Math.min(24, Math.max(8, header.value.length))) : header.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Body({ body, label }: { body: string; label: string }) {
  if (body.trim() === '') {
    return <div className="api-pairs__empty">No body.</div>
  }

  let parsed: unknown
  let json = true

  try {
    parsed = JSON.parse(body)
  } catch {
    json = false
  }

  return (
    <div className="hc-section">
      <div className="hc-section__head">
        <span className="hc-section__title">{label}</span>
      </div>
      {json ? (
        <div className="hc-body">
          <JsonTree value={parsed} />
        </div>
      ) : (
        <pre className="api-response__raw">{body}</pre>
      )}
    </div>
  )
}

type TraceProps = {
  frames: TraceFrame[]
  vendor: boolean
  onToggle: () => void
}

function Trace({ frames, vendor, onToggle }: TraceProps) {
  const shown = vendor ? frames : frames.filter((one) => !one.vendor)

  return (
    <div className="hc-section">
      <div className="hc-section__head">
        <span className="hc-section__title">Called from</span>
        <button className="hc-switch" onClick={onToggle} type="button">
          <span className={vendor ? 'hc-switch__track hc-switch__track--on' : 'hc-switch__track'}>
            <span className="hc-switch__knob" />
          </span>
          Vendor frames
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="api-pairs__empty">
          {frames.length === 0
            ? 'No call site was recorded for this call.'
            : 'Every frame here is vendor code — the call was made from a package, not from this application. Turn vendor frames on to see it.'}
        </div>
      ) : (
        <div className="hc-trace">
          {shown.map((frame, index) => (
            <div
              className={frame.vendor ? 'hc-trace__frame hc-trace__frame--vendor' : 'hc-trace__frame'}
              key={`${frame.file}:${frame.line}-${index}`}
            >
              <span className="hc-trace__fn">{frame.function}</span>
              <span className="hc-trace__file">
                {frame.file}
                {frame.line > 0 ? `:${frame.line}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
