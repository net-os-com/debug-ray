import type { OutgoingCall } from '../../../shared/http-client'
import { methodColor, statusBackground, statusColor } from '../api/method-color'
import { failed, type HttpClientState } from './use-http-client'

const ORIGINS: Record<OutgoingCall['context']['kind'], string> = {
  request: 'request',
  queue: 'job',
  console: 'command',
  unknown: 'elsewhere',
}

/** The calls, newest first, in the order they were made. */
export function CallList({ http }: { http: HttpClientState }) {
  return (
    <section className="hc-list">
      <div className="hc-bar">
        <label className="hc-search">
          <SearchIcon />
          <input
            data-find="http"
            onChange={(event) => http.setQuery(event.target.value)}
            placeholder="Filter calls"
            value={http.query}
          />
        </label>

        <div className="hc-tabs">
          {(['all', 'errors'] as const).map((key) => (
            <button
              className={http.filter === key ? 'hc-tab hc-tab--on' : 'hc-tab'}
              key={key}
              onClick={() => http.setFilter(key)}
              type="button"
            >
              {key === 'all' ? 'All' : 'Errors'}
              <span className="hc-tab__count">{http.counts[key]}</span>
            </button>
          ))}
        </div>

        <span className="hc-shown">
          <span
            className={http.paused ? 'hc-pulse hc-pulse--paused' : 'hc-pulse'}
            title={http.paused ? 'Paused' : 'Listening'}
          />
          {http.shown.length === http.calls.length
            ? `${http.calls.length} calls`
            : `${http.shown.length} of ${http.calls.length}`}
        </span>

        <div className="hc-tabs">
          <button className="hc-tab" onClick={http.togglePause} type="button">
            {http.paused ? 'Resume' : 'Pause'}
          </button>
          <button className="hc-tab" onClick={http.clear} type="button">
            Clear
          </button>
        </div>
      </div>

      <div className="hc-grid hc-grid--head">
        <span className="hc-col-time">Time</span>
        <span>Method</span>
        <span>Status</span>
        <span>URL</span>
        <span className="hc-col-origin">Origin</span>
        <span className="hc-col-dur">Duration</span>
      </div>

      <div className="hc-rows">
        {http.shown.map((call) => (
          <Row
            call={call}
            key={call.id}
            on={call.id === http.selectedId}
            onSelect={() => http.select(call.id)}
            slowest={http.slowest}
          />
        ))}

        {http.shown.length === 0 ? <Empty http={http} /> : null}
      </div>
    </section>
  )
}

type RowProps = {
  call: OutgoingCall
  on: boolean
  slowest: number
  onSelect: () => void
}

function Row({ call, on, slowest, onSelect }: RowProps) {
  const wrong = failed(call)

  return (
    <button
      className={on ? 'hc-grid hc-row hc-row--on' : 'hc-grid hc-row'}
      onClick={onSelect}
      type="button"
    >
      <span className="hc-col-time hc-mono hc-dim">{clock(call.startedAt)}</span>
      <span className="hc-mono hc-method" style={{ color: methodColor(call.method) }}>
        {call.method}
      </span>
      <span
        className="hc-status"
        style={{
          background: wrong && call.status === 0 ? 'var(--err-bg)' : statusBackground(call.status),
          color: wrong && call.status === 0 ? 'var(--err-fg)' : statusColor(call.status),
        }}
      >
        {call.status === 0 ? 'failed' : call.status}
      </span>

      <span className="hc-url" title={call.url}>
        <span className="hc-url__line">
          <span className="hc-dim">{call.host}</span>
          <span>{call.path}</span>
        </span>
        <span className="hc-url__meta">
          <span className="hc-chip">Http facade</span>
          {call.tenant === null ? null : <span className="hc-dim">{call.tenant}</span>}
        </span>
      </span>

      <span className="hc-col-origin hc-origin">
        <span className="hc-origin__kind">{ORIGINS[call.context.kind]}</span>
        <span className="hc-origin__name" title={call.context.name ?? ''}>
          {call.context.name ?? '—'}
        </span>
      </span>

      <span className="hc-col-dur hc-dur">
        <span className="hc-mono" style={{ color: wrong ? 'var(--err-fg)' : 'var(--t2)' }}>
          {duration(call.durationMs)}
        </span>
        <span className="hc-dur__track">
          <span
            className="hc-dur__bar"
            style={{
              width: `${Math.max(4, (call.durationMs / slowest) * 100)}%`,
              background: wrong ? 'var(--err-fg)' : 'var(--tm-4)',
            }}
          />
        </span>
      </span>
    </button>
  )
}

function Empty({ http }: { http: HttpClientState }) {
  if (!http.collect) {
    return (
      <div className="hc-empty">
        <div className="hc-empty__title">Collecting is off</div>
        <div className="hc-empty__text">
          Outgoing calls are not being kept. Turn it back on in Settings.
        </div>
      </div>
    )
  }

  if (http.calls.length > 0) {
    return (
      <div className="hc-empty">
        <div className="hc-empty__title">Nothing matches</div>
        <div className="hc-empty__text">
          {http.counts.all} {http.counts.all === 1 ? 'call is' : 'calls are'} held, none of them
          fitting {http.filter === 'errors' ? 'this filter' : `“${http.query}”`}.
        </div>
      </div>
    )
  }

  return (
    <div className="hc-empty">
      <div className="hc-empty__title">No outgoing calls yet</div>
      <div className="hc-empty__text">
        Every call the application makes with Laravel's HTTP client lands here — from a request, a
        queued job, the scheduler or a command.
      </div>
      <pre className="hc-empty__code">
        {`Http::withToken($token)->get('https://…');`}
      </pre>
    </div>
  )
}

/** `14:21:07.412`, which is how one call is told apart from the next. */
function clock(at: number): string {
  const date = new Date(at)
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0')

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

export function duration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}

function SearchIcon() {
  return (
    <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" viewBox="0 0 24 24" width="15">
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  )
}
