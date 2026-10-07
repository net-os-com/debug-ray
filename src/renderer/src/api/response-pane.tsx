import { useState } from 'react'
import type { ApiResult, ApiTiming } from '../../../shared/api'
import { JsonTree } from '../detail/payloads/json-tree'
import { size, statusBackground, statusColor } from './method-color'
import { RouteBrief } from './route-brief'
import { problemOf } from './validation'
import type { ApiState } from './use-api'

type Tab = 'body' | 'raw' | 'headers' | 'timing'

type ResponsePaneProps = {
  api: ApiState
  /** Null when nothing collected the other side of this call. */
  onOpenInRequests: ((debugId: string) => void) | null
}

export function ResponsePane({ api, onOpenInRequests }: ResponsePaneProps) {
  const [tab, setTab] = useState<Tab>('body')
  const { result, sending } = api

  if (sending) {
    return (
      <section className="api-response">
        <div className="api-response__head">
          <span className="console__pulse" />
          <span>Sending to {api.environment?.host ?? 'nowhere'}…</span>
        </div>
      </section>
    )
  }

  if (result === null) {
    return <EmptyResponse api={api} />
  }

  if (result.error !== null) {
    return (
      <section className="api-response">
        <div className="api-response__head">
          <span className="api-response__status" style={{ color: 'var(--err-fg)' }}>
            no answer
          </span>
        </div>
        <div className="api-response__problem">{result.error}</div>
      </section>
    )
  }

  const problem = problemOf(result.body, result.status)
  const counts: Record<Tab, number> = {
    body: 0,
    raw: 0,
    headers: result.headers.length,
    timing: 0,
  }

  return (
    <section className="api-response">
      <div className="api-response__head">
        <span
          className="api-response__status"
          style={{ background: statusBackground(result.status), color: statusColor(result.status) }}
        >
          {result.status} {result.statusText}
        </span>
        <span className="api-response__meta">{result.timing.total} ms</span>
        <span className="api-response__meta">{size(result.size)}</span>

        {/* Every call carries this out on X-Netos-Debug-Id, which is how the
            collector's record of the same call is found again. Shown even when
            there is no match, because then it is the thing to grep for. */}
        <span className="api-response__debug" title={`X-Netos-Debug-Id: ${result.debugId}`}>
          {result.debugId.slice(0, 8)}
        </span>

        {onOpenInRequests === null ? null : (
          <button
            className="api-response__link"
            onClick={() => onOpenInRequests(result.debugId)}
            title="This call was collected on the other side too"
            type="button"
          >
            Open in Requests →
          </button>
        )}
      </div>

      <div className="api-response__tabs">
        {(['body', 'raw', 'headers', 'timing'] as Tab[]).map((key) => (
          <button
            className={key === tab ? 'api-tab api-tab--on' : 'api-tab'}
            key={key}
            onClick={() => setTab(key)}
            type="button"
          >
            {LABELS[key]}
            {counts[key] > 0 ? <span className="api-tab__count">{counts[key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="api-response__body">
        {tab === 'body' ? <BodyTab problem={problem} result={result} /> : null}
        {tab === 'raw' ? <pre className="api-response__raw">{result.body}</pre> : null}

        {tab === 'headers' ? (
          <div className="api-kv">
            {result.headers.map((header) => (
              <div className="api-kv__row" key={header.key}>
                <span className="api-kv__key">{header.key}</span>
                <span className="api-kv__value">{header.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'timing' ? <TimingTab timing={result.timing} /> : null}
      </div>
    </section>
  )
}

const LABELS: Record<Tab, string> = {
  body: 'Body',
  raw: 'Raw',
  headers: 'Headers',
  timing: 'Timing',
}

function EmptyResponse({ api }: { api: ApiState }) {
  return (
    <section className="api-response">
      <div className="api-response__waiting">
        <div className="api-response__empty-title">No response yet</div>
        <div className="api-response__empty-text">
          Send the request to see the response, headers and timing here.
        </div>
        <div className="api-response__empty-hint">
          Press <span className="api-key">⌘</span> <span className="api-key">Enter</span> to send
        </div>
      </div>

      <div className="api-response__brief">
        <RouteBrief
          context={api.context}
          onFillBody={
            api.context !== null && api.context.fields.length > 0 ? api.fillBody : null
          }
          route={api.route}
        />
      </div>
    </section>
  )
}

function BodyTab({ result, problem }: { result: ApiResult; problem: ReturnType<typeof problemOf> }) {
  if (result.body.trim() === '') {
    return <div className="api-pairs__empty">No content. The server returned an empty body.</div>
  }

  let parsed: unknown
  let isJson = true

  try {
    parsed = JSON.parse(result.body)
  } catch {
    isJson = false
  }

  return (
    <>
      {problem === null ? null : (
        <div className="api-problem">
          <div className="api-problem__title">{problem.title}</div>

          {problem.fields.map((field) => (
            <div className="api-problem__field" key={field.field}>
              <span className="api-problem__name">{field.field}</span>
              <span className="api-problem__message">{field.message}</span>
            </div>
          ))}

          {problem.exception === null ? null : (
            <div className="api-problem__where">
              {problem.exception.split('\\').pop()}
              {problem.location === null ? '' : ` · ${problem.location}`}
            </div>
          )}
        </div>
      )}

      {isJson ? (
        <div className="api-response__tree">
          <JsonTree value={parsed} />
        </div>
      ) : (
        <pre className="api-response__raw">{result.body}</pre>
      )}
    </>
  )
}

/** Which part of the wait was which. Reused connections show as zero. */
const PHASES: { key: keyof ApiTiming; label: string; color: string }[] = [
  { key: 'dns', label: 'Name lookup', color: 'var(--sql-num)' },
  { key: 'connect', label: 'Connect', color: 'var(--sql-kw)' },
  { key: 'tls', label: 'TLS handshake', color: 'var(--var-fg)' },
  { key: 'firstByte', label: 'Waiting for the server', color: 'var(--app-accent-fg)' },
  { key: 'download', label: 'Download', color: 'var(--ok-fg)' },
]

function TimingTab({ timing }: { timing: ApiTiming }) {
  const total = timing.total > 0 ? timing.total : 1

  return (
    <div className="api-timing">
      {PHASES.map((phase) => {
        const ms = timing[phase.key]

        return (
          <div className="api-timing__row" key={phase.key}>
            <span className="api-timing__label">{phase.label}</span>
            <span className="api-timing__track">
              <span
                className="api-timing__bar"
                style={{
                  // A phase that took a tenth of a millisecond still happened,
                  // so it gets a sliver rather than nothing at all.
                  width: ms === 0 ? 0 : `max(2px, ${(ms / total) * 100}%)`,
                  background: phase.color,
                }}
              />
            </span>
            <span className="api-timing__ms">{ms === 0 ? '—' : `${ms} ms`}</span>
          </div>
        )
      })}

      <div className="api-timing__row api-timing__row--total">
        <span className="api-timing__label">Total</span>
        <span className="api-timing__track" />
        <span className="api-timing__ms">{timing.total} ms</span>
      </div>

      {timing.dns === 0 && timing.connect === 0 ? (
        <div className="api-timing__note">
          No lookup or handshake: this went over a connection that was already open.
        </div>
      ) : null}
    </div>
  )
}
