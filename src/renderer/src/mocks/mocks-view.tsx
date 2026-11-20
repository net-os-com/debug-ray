import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiEnvironment } from '../../../shared/api'
import { isLocalHost } from '../../../shared/mocks/local-host'
import type { MockHit, MockService } from '../../../shared/mocks/types'
import type { TinkerContainer } from '../../../shared/tinker'
import { addEndpoint, addWebhook, decodeQuery, moveEndpoint, newService, removeEndpoint, removeWebhook, updateEndpoint, updateWebhook } from './edit-service'
import { EndpointPane } from './endpoint-pane'
import { HitLog } from './hit-log'
import { SendLog } from './send-log'
import { ServiceBar } from './service-bar'
import { ServiceList } from './service-list'
import type { MockEditor } from './use-mock-editor'
import type { MocksData } from './use-mocks'
import { WebhookEditor } from './webhook-editor'

const DEFAULT_PORT = 23517

type MocksViewProps = {
  mocks: MocksData
  editor: MockEditor
  container: TinkerContainer | null
  port: number | null
  environment: ApiEnvironment | null
  openInRequests: (debugId: string) => (() => void) | null
}

export function MocksView({ mocks, editor, container, port, environment, openInRequests }: MocksViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
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

  const webhook =
    draft !== null && selection?.kind === 'webhook'
      ? (draft.webhooks.find((one) => one.id === selection.id) ?? null)
      : null

  const canSend = environment === null || isLocalHost(environment.host)

  const send = async (): Promise<void> => {
    if (webhook === null || !canSend || sending) {
      return
    }

    setSending(true)

    try {
      const body = editor.oneOffBody ?? webhook.body

      await mocks.fire({ ...webhook, body }, environment, editor.oneOffBody !== null)
    } finally {
      setSending(false)
    }
  }

  // Held in a ref so the shortcut registers once and sends what is on screen now.
  const latestSend = useRef(() => {})
  latestSend.current = () => void send()

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        latestSend.current()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const deleteWebhook = (): void => {
    if (draft === null || webhook === null || !window.confirm(`Delete ${webhook.name}?`)) {
      return
    }

    editor.edit((s) => removeWebhook(s, webhook.id))
    editor.select({ service: draft.name, kind: 'service' })
  }

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
          ) : draft !== null && webhook !== null ? (
            <WebhookEditor
              canSend={canSend}
              host={environment?.host ?? ''}
              key={`${draft.name}/${webhook.id}`}
              onChange={(patch) => editor.edit((s) => updateWebhook(s, webhook.id, patch))}
              onDelete={deleteWebhook}
              onOneOff={editor.setOneOffBody}
              onSaveOneOff={editor.saveOneOff}
              onSend={() => void send()}
              oneOffBody={editor.oneOffBody}
              sending={sending}
              serviceName={draft.name}
              webhook={webhook}
            />
          ) : (
            <p className="mk__placeholder">Pick an endpoint or a webhook to edit it.</p>
          )}
        </section>

        <section aria-label="Activity" className="mk__right">
          {draft !== null && webhook !== null ? (
            <SendLog openInRequests={openInRequests} sends={mocks.sends} webhookId={webhook.id} />
          ) : draft !== null ? (
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
