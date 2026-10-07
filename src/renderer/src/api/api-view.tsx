import { useEffect, useRef } from 'react'
import { RequestPane } from './request-pane'
import { ResponsePane } from './response-pane'
import { RouteList } from './route-list'
import type { ApiState } from './use-api'

type ApiViewProps = {
  api: ApiState
  /**
   * Hands a sent call back to the Requests view, which saw the other side.
   * Null when nothing collected it, so the link is not offered.
   */
  onOpenInRequests: ((debugId: string) => void) | null
}

export function ApiView({ api, onOpenInRequests }: ApiViewProps) {
  // Held in a ref so the shortcut registers once instead of on every keystroke,
  // and still sends whatever is in the boxes right now.
  const latest = useRef(() => {})
  latest.current = () => void api.send()

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        latest.current()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="api">
      <RouteList api={api} />
      <RequestPane api={api} />
      <ResponsePane api={api} onOpenInRequests={onOpenInRequests} />
    </div>
  )
}
