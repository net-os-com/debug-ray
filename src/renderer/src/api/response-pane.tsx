import { useMemo, useState } from 'react'
import type { ApiResult, ApiTiming } from '../../../shared/api'
import { JsonTree } from '../detail/payloads/json-tree'
import { queryPath, type JsonPathResult } from './jsonpath'
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
  /**
   * Kept across sends rather than cleared with the response: narrowing to
   * `$.data.*.id` and then changing one parameter is one question asked twice,
   * and retyping the path each time is the part that makes it not worth asking.
   */
  const [filter, setFilter] = useState('')
  /** HTML bodies are shown as the page they are, until you ask for the source. */
  const [source, setSource] = useState(false)
  const { result, sending } = api
  const body = result === null || result.error !== null ? '' : result.body
  const parsed = useMemo(() => parseJson(body), [body])
  const html = useMemo(() => (result === null ? false : isHtml(result)), [result])
  const found = useMemo(
    () => (filter.trim() === '' || !parsed.ok ? null : queryPath(parsed.value, filter)),
    [filter, parsed],
  )

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
        {tab === 'body' ? (
          <BodyTab
            found={found}
            html={html}
            onSource={setSource}
            parsed={parsed}
            problem={problem}
            result={result}
            source={source}
          />
        ) : null}
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

      {tab === 'body' && parsed.ok ? (
        <FilterBar found={found} onChange={setFilter} value={filter} />
      ) : null}
    </section>
  )
}

/**
 * Narrowing the body to the part of it being read.
 *
 * At the foot of the response rather than the top because it is about what is
 * above it, and because the body is where your eye already is once a call has
 * come back.
 */
function FilterBar({
  value,
  onChange,
  found,
}: {
  value: string
  onChange: (value: string) => void
  found: JsonPathResult | null
}) {
  return (
    <div className="api-filter">
      <input
        className="api-filter__input"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter with JSONPath, e.g. $.data.*.id"
        spellCheck={false}
        value={value}
      />

      {found === null ? null : found.error !== null ? (
        <span className="api-filter__note api-filter__note--bad">{found.error}</span>
      ) : (
        <span className="api-filter__note">
          {found.matches.length === 0
            ? 'no matches'
            : found.matches.length === 1
              ? '1 match'
              : `${found.matches.length} matches`}
        </span>
      )}

      {value === '' ? null : (
        <button className="api-filter__clear" onClick={() => onChange('')} type="button">
          Clear
        </button>
      )}
    </div>
  )
}

/**
 * The response, rendered as the page it claims to be.
 *
 * An API that answers HTML is usually answering with an error page — the one
 * Laravel renders when a call that wanted JSON did not say so — and reading
 * that as source is reading a stack trace through its own markup.
 *
 * It is a page from somewhere else, shown inside the debugger, so it is framed
 * under `sandbox` with nothing allowed back: no scripts, no forms, no
 * navigation, and an opaque origin, which is what keeps it away from the bridge
 * this window holds. The app's own content policy is inherited by the frame on
 * top of that, so remote scripts, styles and images do not load either — what
 * renders is the document's own markup and the styles it carries inline.
 */
function HtmlPreview({ body }: { body: string }) {
  return (
    <iframe className="api-response__html" sandbox="" srcDoc={body} title="Response preview" />
  )
}

/**
 * Whether the body is a page rather than data.
 *
 * The header is the claim and the first bytes are the evidence; either will do,
 * because a route that forgot to set a content type still returns a page, and a
 * page served as `text/plain` is still what somebody is trying to read.
 */
function isHtml(result: ApiResult): boolean {
  const declared = result.headers.some(
    (header) =>
      header.key.toLowerCase() === 'content-type' && header.value.toLowerCase().includes('text/html'),
  )

  if (declared) {
    return true
  }

  const start = result.body.trimStart().slice(0, 120).toLowerCase()

  return start.startsWith('<!doctype html') || start.startsWith('<html')
}

/** A body is JSON or it is not, and both tabs below need to know which. */
function parseJson(body: string): { ok: boolean; value: unknown } {
  if (body.trim() === '') {
    return { ok: false, value: null }
  }

  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return { ok: false, value: null }
  }
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
          Press <span className="api-key">⌘</span> <span className="api-key">R</span> to send
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

type BodyTabProps = {
  result: ApiResult
  problem: ReturnType<typeof problemOf>
  parsed: { ok: boolean; value: unknown }
  /** Null when nothing is being filtered; carries its own error when it is. */
  found: JsonPathResult | null
  html: boolean
  source: boolean
  onSource: (source: boolean) => void
}

function BodyTab({ result, problem, parsed, found, html, source, onSource }: BodyTabProps) {
  if (result.body.trim() === '') {
    return <div className="api-pairs__empty">No content. The server returned an empty body.</div>
  }

  if (html) {
    return (
      <>
        <div className="api-body__modes">
          <button
            className={source ? 'api-mode' : 'api-mode api-mode--on'}
            onClick={() => onSource(false)}
            type="button"
          >
            Rendered
          </button>
          <button
            className={source ? 'api-mode api-mode--on' : 'api-mode'}
            onClick={() => onSource(true)}
            type="button"
          >
            Source
          </button>
          <span className="api-body__state">
            {source ? 'As it came off the wire' : 'Scripts and remote files do not run here'}
          </span>
        </div>

        {source ? (
          <pre className="api-response__raw">{result.body}</pre>
        ) : (
          <HtmlPreview body={result.body} />
        )}
      </>
    )
  }

  // A path that does not parse yet is a path being typed. The body stays where
  // it was so you can see what you are aiming at; the box says what is wrong.
  const shown = found === null || found.error !== null ? parsed.value : found.matches

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

      {parsed.ok ? (
        <div className="api-response__tree">
          {found !== null && found.error === null && found.matches.length === 0 ? (
            <div className="api-pairs__empty">Nothing in this body matches that path.</div>
          ) : (
            <JsonTree value={shown} />
          )}
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
