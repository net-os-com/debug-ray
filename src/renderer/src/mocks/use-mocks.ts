import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiEnvironment } from '../../../shared/api'
import {
  EMPTY_STATE,
  choiceKey,
  type MockChoices,
  type MockHit,
  type MockService,
  type MockState,
  type MockWebhook,
  type WebhookOutcome,
} from '../../../shared/mocks/types'
import type { TinkerContainer } from '../../../shared/tinker'

export type MocksData = ReturnType<typeof useMocks>

const FOCUS_RELOAD_AFTER_MS = 2_000
const MAX_KEPT = 200

function refused(webhook: MockWebhook, error: string, edited: boolean): WebhookOutcome {
  return { webhookId: webhook.id, at: Date.now(), sent: false, result: null, error, edited }
}

/**
 * The mock fixtures and what happened to them, owned by App for the reason
 * useHttpClient is: a hit that arrives while another view is open still counts.
 */
export function useMocks(container: TinkerContainer | null) {
  const [state, setState] = useState<MockState>(EMPTY_STATE)
  const [hits, setHits] = useState<MockHit[]>([])
  const [sends, setSends] = useState<WebhookOutcome[]>([])
  const [choices, setChoices] = useState<MockChoices>(() => window.ray.mocksChoices())
  const [busy, setBusy] = useState(false)
  const loadedAt = useRef(0)

  const containerId = container?.id ?? null
  const workingDir = container?.workingDir ?? null
  const containerName = container?.name ?? null

  const load = useCallback(async (): Promise<void> => {
    if (containerId === null || workingDir === null || containerName === null) {
      return
    }

    loadedAt.current = Date.now()
    setBusy(true)

    try {
      setState(await window.ray.mocksLoad(containerId, workingDir, containerName))
    } finally {
      setBusy(false)
    }
  }, [containerId, workingDir, containerName])

  useEffect(() => {
    void window.ray.mocksState().then(setState)
    void window.ray.mocksHits().then(setHits)

    const offState = window.ray.onMocksState(setState)
    const offHit = window.ray.onMockHit((hit) =>
      setHits((current) => [hit, ...current.filter((one) => one.id !== hit.id)].slice(0, MAX_KEPT)),
    )

    return () => {
      offState()
      offHit()
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onFocus = (): void => {
      if (Date.now() - loadedAt.current > FOCUS_RELOAD_AFTER_MS) {
        void load()
      }
    }

    window.addEventListener('focus', onFocus)

    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const save = useCallback(
    async (service: MockService): Promise<string | null> => {
      if (containerId === null || workingDir === null) {
        return 'Pick a container in Settings.'
      }

      setBusy(true)

      try {
        return (await window.ray.mocksSave(containerId, workingDir, service)).error
      } finally {
        setBusy(false)
      }
    },
    [containerId, workingDir],
  )

  const forget = useCallback(
    async (service: MockService): Promise<string | null> => {
      if (service.hash === null) {
        return null
      }

      if (containerId === null || workingDir === null) {
        return 'Pick a container in Settings.'
      }

      setBusy(true)

      try {
        return (
          await window.ray.mocksForget(containerId, workingDir, service.name, service.hash)
        ).error
      } finally {
        setBusy(false)
      }
    },
    [containerId, workingDir],
  )

  const choose = useCallback((service: string, endpointId: string, responseId: string): void => {
    const key = choiceKey(service, endpointId)

    setChoices((current) => ({ ...current, [key]: responseId }))
    void window.ray.mocksChoose(key, responseId).then(setChoices)
  }, [])

  const fire = useCallback(
    async (
      webhook: MockWebhook,
      environment: ApiEnvironment | null,
      edited: boolean,
    ): Promise<WebhookOutcome> => {
      let outcome: WebhookOutcome

      if (containerId === null || workingDir === null) {
        outcome = refused(webhook, 'Pick a container in Settings.', edited)
      } else if (environment === null) {
        outcome = refused(webhook, 'Pick an environment in the API tab.', edited)
      } else {
        outcome = await window.ray.mocksFire({
          containerId,
          workingDir,
          host: environment.host,
          insecure: environment.insecure,
          webhook,
        })
      }

      setSends((current) => [outcome, ...current].slice(0, MAX_KEPT))

      return outcome
    },
    [containerId, workingDir],
  )

  const clearHits = useCallback((): void => {
    window.ray.mocksClearHits()
    setHits([])
  }, [])

  return { state, hits, sends, choices, busy, load, save, forget, choose, fire, clearHits }
}
