import { useEffect, useState } from 'react'
import type { RayClient } from '../../../shared/ray-event'

/** Refreshed while the settings view is open; senders go stale, not offline. */
export function ClientsCard() {
  const [clients, setClients] = useState<RayClient[]>([])

  useEffect(() => {
    let cancelled = false

    const load = (): void => {
      void window.ray.getClients().then((next) => {
        if (!cancelled) {
          setClients(next)
        }
      })
    }

    load()

    const timer = setInterval(load, 2000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="card">
      <div className="card__title">Connected clients</div>
      {clients.length === 0 ? (
        <div className="card__empty">Nothing has posted yet.</div>
      ) : (
        <div className="clients">
          {clients.map((client) => (
            <div className="client" key={client.id}>
              <span className={dotClass(client.lastSeenAt)} />
              <span className="client__label">{client.label}</span>
              <span className="client__meta">
                {client.address} · {ago(client.lastSeenAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function dotClass(lastSeenAt: number): string {
  return Date.now() - lastSeenAt < 60_000 ? 'client__dot' : 'client__dot client__dot--stale'
}

function ago(lastSeenAt: number): string {
  const seconds = Math.round((Date.now() - lastSeenAt) / 1000)

  if (seconds < 5) {
    return 'now'
  }

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  return `${Math.round(seconds / 60)}m ago`
}
