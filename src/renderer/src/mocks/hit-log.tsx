import { useState } from 'react'
import type { MockHit, MockService } from '../../../shared/mocks/types'
import { methodColor, statusBackground, statusColor } from '../api/method-color'
import { Headers } from '../http-client/headers'

type Scope = 'endpoint' | 'service'

function responseName(service: MockService, hit: MockHit): string | null {
  if (hit.endpointId === null) {
    return null
  }

  const endpoint = service.endpoints.find((one) => one.id === hit.endpointId)
  const response = endpoint?.responses.find((one) => one.id === hit.responseId)

  return response?.name ?? hit.responseId ?? 'Unknown response'
}

type HitLogProps = {
  service: MockService
  hits: MockHit[]
  endpointId: string | null
  onAddEndpoint: (hit: MockHit) => void
  onClear: () => void
}

export function HitLog({ service, hits, endpointId, onAddEndpoint, onClear }: HitLogProps) {
  const [scope, setScope] = useState<Scope>('endpoint')
  const [open, setOpen] = useState<string | null>(null)
  const [secrets, setSecrets] = useState(false)

  const effective: Scope = endpointId === null ? 'service' : scope

  const shown = hits.filter(
    (hit) => hit.service === service.name && (effective === 'service' || hit.endpointId === endpointId),
  )

  return (
    <div className="mk-calls">
      <div className="mk-calls__head">
        <span className="mk-section__title">Calls</span>

        {endpointId === null ? null : (
          <div className="mk-calls__toggle" role="group">
            <button
              className={effective === 'endpoint' ? 'mk-calls__scope mk-calls__scope--on' : 'mk-calls__scope'}
              onClick={() => setScope('endpoint')}
              type="button"
            >
              This endpoint
            </button>
            <button
              className={effective === 'service' ? 'mk-calls__scope mk-calls__scope--on' : 'mk-calls__scope'}
              onClick={() => setScope('service')}
              type="button"
            >
              All of {service.title}
            </button>
          </div>
        )}

        <button className="mk-ghost-button" disabled={hits.length === 0} onClick={onClear} type="button">
          Clear
        </button>
      </div>

      <div className="mk-calls__list">
        {shown.length === 0 ? <p className="mk__placeholder">No calls yet.</p> : null}

        {shown.map((hit) => {
          const name = responseName(service, hit)
          const query = hit.query === '' ? '' : `?${hit.query}`

          return (
            <div className={hit.endpointId === null ? 'mk-call mk-call--miss' : 'mk-call'} key={hit.id}>
              <button
                aria-expanded={open === hit.id}
                className="mk-call__row"
                onClick={() => setOpen(open === hit.id ? null : hit.id)}
                type="button"
              >
                <span className="mk-call__line">
                  <span className="mk-hint mk-mono">{new Date(hit.at).toLocaleTimeString()}</span>
                  <span className="mk-call__method" style={{ color: methodColor(hit.method) }}>
                    {hit.method}
                  </span>
                  <span className="mk-call__gap" />
                  <span
                    className="hc-status"
                    style={{ background: statusBackground(hit.status), color: statusColor(hit.status) }}
                  >
                    {hit.status}
                  </span>
                </span>
                <span className="mk-call__path">
                  {hit.path}
                  {query}
                </span>
                <span className="mk-hint">
                  {name === null ? (
                    <span className="mk-call__none">No mock</span>
                  ) : (
                    `${name} · ${hit.durationMs} ms`
                  )}
                </span>
                {hit.note === null ? null : <span className="mk-hint">{hit.note}</span>}
              </button>

              {hit.endpointId === null ? (
                <button className="button mk-call__add" onClick={() => onAddEndpoint(hit)} type="button">
                  Add endpoint
                </button>
              ) : null}

              {open === hit.id ? (
                <div className="mk-call__detail">
                  <Headers
                    headers={hit.requestHeaders}
                    onToggle={() => setSecrets((on) => !on)}
                    secrets={secrets}
                  />
                  {hit.requestBody.trim() === '' ? (
                    <div className="api-pairs__empty">No body.</div>
                  ) : (
                    <pre className="api-response__raw">{hit.requestBody}</pre>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
