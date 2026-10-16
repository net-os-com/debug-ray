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

  // Cmd+R sends, anywhere in the view. The menu already gave up that
  // accelerator so Tinker could run a snippet with it, and sending a request is
  // the same gesture one tab over. Cmd+Enter keeps working: it is what this was
  // before, and it is still what the editor's own chip suggests elsewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }

      if (event.key === 'Enter' || event.key.toLowerCase() === 'r') {
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
