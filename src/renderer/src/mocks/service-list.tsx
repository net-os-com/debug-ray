import { useState } from 'react'
import type { MockProblem, MockService } from '../../../shared/mocks/types'
import { Caret } from '../api/caret'
import { methodColor } from '../api/method-color'
import { StrokeIcon } from '../chrome/module-icons'
import type { MockSelection } from './use-mock-editor'

const PLUS_PATH = 'M12 4.5v15m7.5-7.5h-15'

type ServiceListProps = {
  services: MockService[]
  problems: MockProblem[]
  error: string | null
  selection: MockSelection
  onSelect: (next: MockSelection) => void
  onAddEndpoint: () => void
  onAddWebhook: () => void
  onNewService: () => void
}

export function ServiceList({
  services,
  problems,
  error,
  selection,
  onSelect,
  onAddEndpoint,
  onAddWebhook,
  onNewService,
}: ServiceListProps) {
  const [shut, setShut] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const toggle = (name: string): void =>
    setShut((current) => {
      const next = new Set(current)

      if (!next.delete(name)) {
        next.add(name)
      }

      return next
    })

  return (
    <aside aria-label="Services" className="mk-side">
      <div className="mk-side__head">
        <input
          aria-label="Filter endpoints"
          className="mk-side__search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter endpoints"
          value={query}
        />
        <button
          aria-label="Add endpoint"
          className="mk-icon-button"
          disabled={selection === null}
          onClick={onAddEndpoint}
          title="Add endpoint"
          type="button"
        >
          <StrokeIcon path={PLUS_PATH} size={15} />
        </button>
      </div>

      <div className="mk-side__body">
        <div className="mk-side__label">
          <span>Services</span>
          <span className="mk-side__rule">First match wins</span>
        </div>

        {error !== null ? <p className="mk-side__problem">{error}</p> : null}

        {services.map((service) => {
          const open = !shut.has(service.name)
          const current = selection?.service === service.name
          const endpoints = service.endpoints.filter(
            (one) =>
              needle === '' || `${one.method} ${one.name} ${one.path}`.toLowerCase().includes(needle),
          )

          return (
            <div key={service.name}>
              <button
                aria-expanded={open}
                className={
                  current && selection?.kind === 'service'
                    ? 'mk-side__service mk-side__row--on'
                    : 'mk-side__service'
                }
                onClick={() => {
                  if (current) {
                    toggle(service.name)
                  } else {
                    onSelect({ service: service.name, kind: 'service' })
                    setShut((held) => {
                      const next = new Set(held)

                      next.delete(service.name)

                      return next
                    })
                  }
                }}
                type="button"
              >
                <Caret open={open} />
                <span className="mk-side__name">{service.title}</span>
                <span className="mk-side__count">{service.endpoints.length}</span>
              </button>

              {open
                ? endpoints.map((endpoint) => (
                    <button
                      className={
                        current && selection?.kind === 'endpoint' && selection.id === endpoint.id
                          ? 'mk-side__row mk-side__row--on'
                          : 'mk-side__row'
                      }
                      key={endpoint.id}
                      onClick={() =>
                        onSelect({ service: service.name, kind: 'endpoint', id: endpoint.id })
                      }
                      type="button"
                    >
                      <span className="mk-side__method" style={{ color: methodColor(endpoint.method) }}>
                        {endpoint.method}
                      </span>
                      <span className="mk-side__what">
                        <span className="mk-side__endpoint">{endpoint.name}</span>
                        <span className="mk-side__path">
                          {endpoint.path}
                          {Object.keys(endpoint.query).length > 0
                            ? ` · ${Object.keys(endpoint.query).join(', ')}`
                            : ''}
                        </span>
                      </span>
                    </button>
                  ))
                : null}

              {open && (service.webhooks.length > 0 || current) ? (
                <div className="mk-side__sub">Webhooks</div>
              ) : null}

              {open
                ? service.webhooks.map((webhook) => (
                    <button
                      className={
                        current && selection?.kind === 'webhook' && selection.id === webhook.id
                          ? 'mk-side__row mk-side__row--on'
                          : 'mk-side__row'
                      }
                      key={webhook.id}
                      onClick={() =>
                        onSelect({ service: service.name, kind: 'webhook', id: webhook.id })
                      }
                      type="button"
                    >
                      <span className="mk-side__method" style={{ color: methodColor(webhook.method) }}>
                        {webhook.method}
                      </span>
                      <span className="mk-side__what">
                        <span className="mk-side__endpoint">{webhook.name}</span>
                        <span className="mk-side__path">{webhook.path}</span>
                      </span>
                    </button>
                  ))
                : null}

              {open && current ? (
                <button className="mk-side__add" onClick={onAddWebhook} type="button">
                  <StrokeIcon path={PLUS_PATH} size={14} />
                  Add webhook
                </button>
              ) : null}
            </div>
          )
        })}

        {services.length === 0 && problems.length === 0 && error === null ? (
          <p className="mk-side__empty">No services yet. Add one below.</p>
        ) : null}

        {problems.map((problem) => (
          <p className="mk-side__problem" key={problem.file}>
            <span className="mk-side__problem-file">{problem.file}</span>
            {problem.error}
          </p>
        ))}
      </div>

      <div className="mk-side__foot">
        <button className="button mk-side__new" onClick={onNewService} type="button">
          <StrokeIcon path={PLUS_PATH} size={14} />
          New service
        </button>
      </div>
    </aside>
  )
}
