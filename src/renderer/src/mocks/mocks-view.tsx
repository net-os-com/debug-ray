import { useEffect, useMemo, useState } from 'react'
import type { MockHit, MockService } from '../../../shared/mocks/types'
import type { TinkerContainer } from '../../../shared/tinker'
import { addEndpoint, addWebhook, decodeQuery, moveEndpoint, newService, removeEndpoint, updateEndpoint } from './edit-service'
import { EndpointPane } from './endpoint-pane'
import { HitLog } from './hit-log'
import { ServiceBar } from './service-bar'
import { ServiceList } from './service-list'
import type { MockEditor } from './use-mock-editor'
import type { MocksData } from './use-mocks'

const DEFAULT_PORT = 23517

type MocksViewProps = {
  mocks: MocksData
  editor: MockEditor
  container: TinkerContainer | null
  port: number | null
}

export function MocksView({ mocks, editor, container, port }: MocksViewProps) {
  const [error, setError] = useState<string | null>(null)
  const { services, problems } = mocks.state
  const { selection, draft } = editor

  const selectionKey = JSON.stringify(selection)

  useEffect(() => setError(null), [selectionKey])

  useEffect(() => {
    if (selection === null && services.length > 0) {
      editor.select({ service: services[0].name, kind: 'service' })
    }
  }, [selection, services, editor])

  const shown = useMemo((): MockService[] => {
    if (draft === null) {
      return services
    }

    return services.some((one) => one.name === draft.name)
      ? services.map((one) => (one.name === draft.name ? draft : one))
      : [...services, draft]
  }, [services, draft])

  const add = (change: (service: MockService) => { service: MockService; select: string; kind: 'endpoint' | 'webhook' }): void => {
    if (draft === null) {
      return
    }

    const made = change(draft)

    editor.edit(() => made.service)
    editor.select({ service: draft.name, kind: made.kind, id: made.select })
  }

  const endpoint =
    draft !== null && selection?.kind === 'endpoint'
      ? (draft.endpoints.find((one) => one.id === selection.id) ?? null)
      : null

  const deleteEndpoint = (): void => {
    if (draft === null || endpoint === null || !window.confirm(`Delete ${endpoint.name}?`)) {
      return
    }

    editor.edit((s) => removeEndpoint(s, endpoint.id))
    editor.select({ service: draft.name, kind: 'service' })
  }

  const addFromHit = (hit: MockHit): void => {
    if (draft === null) {
      return
    }

    const made = addEndpoint(draft, hit.method, hit.path, `${hit.method} ${hit.path}`)
    const next = updateEndpoint(made.service, made.endpointId, { query: decodeQuery(hit.query) })

    editor.edit(() => next)
    editor.select({ service: draft.name, kind: 'endpoint', id: made.endpointId })
  }

  const remove = async (): Promise<void> => {
    if (draft === null) {
      return
    }

    if (draft.hash === null) {
      const empty = draft.endpoints.length === 0 && draft.webhooks.length === 0

      if (empty || window.confirm(`Discard ${draft.title}? It was never saved.`)) {
        editor.discard()
      }

      return
    }

    if (!window.confirm(`Delete ${draft.title}? This removes ${draft.file}.`)) {
      return
    }

    setError(await mocks.forget(draft))
  }

  return (
    <div className="mk">
      {draft !== null ? (
        <ServiceBar
          busy={mocks.busy}
          container={mocks.state.container || container?.name || ''}
          loadedAt={mocks.state.loadedAt}
          port={port ?? DEFAULT_PORT}
          onDelete={() => void remove()}
          dirty={editor.dirty}
          onDiscard={editor.discard}
          onReload={() => void mocks.load()}
          onSave={() => void editor.save().then(setError)}
          onTitle={(title) => editor.edit((s) => ({ ...s, title }))}
          service={draft}
        />
      ) : null}

      <div className="mk__body">
        <ServiceList
          error={container === null ? 'Pick a container in Settings.' : mocks.state.error}
          onAddEndpoint={() =>
            add((s) => {
              const made = addEndpoint(s, 'GET', '/', 'New endpoint')

              return { service: made.service, select: made.endpointId, kind: 'endpoint' }
            })
          }
          onAddWebhook={() =>
            add((s) => {
              const made = addWebhook(s, 'New webhook')

              return { service: made.service, select: made.webhookId, kind: 'webhook' }
            })
          }
          onMoveEndpoint={(from, to) => editor.edit((s) => moveEndpoint(s, from, to))}
          onNewService={() => editor.create(newService('New service', services))}
          onSelect={editor.select}
          problems={problems}
          selection={selection}
          services={shown}
        />

        <section aria-label="Endpoint" className="mk__middle">
          {error !== null ? <p className="mk__error">{error}</p> : null}
          {draft !== null && endpoint !== null ? (
            <EndpointPane
              choices={mocks.choices}
              endpoint={endpoint}
              key={`${draft.name}/${endpoint.id}`}
              onChoose={(responseId) => mocks.choose(draft.name, endpoint.id, responseId)}
              onDelete={deleteEndpoint}
              onEdit={editor.edit}
              service={draft}
            />
          ) : (
            <p className="mk__placeholder">Pick an endpoint or a webhook to edit it.</p>
          )}
        </section>

        <section aria-label="Activity" className="mk__right">
          {draft !== null ? (
            <HitLog
              endpointId={endpoint?.id ?? null}
              hits={mocks.hits}
              onAddEndpoint={addFromHit}
              onClear={mocks.clearHits}
              service={draft}
            />
          ) : (
            <p className="mk__placeholder">Calls to this service will show here.</p>
          )}
        </section>
      </div>
    </div>
  )
}
