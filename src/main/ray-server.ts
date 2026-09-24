import { createServer, type Server } from 'node:http'
import type { RayRequest } from '../shared/ray-event'
import { api } from './routes/api'
import type { EventLog } from './event-log'
import { availabilityCheck } from './routes/availability-check'
import { locks } from './routes/locks'
import { payloads } from './routes/payloads'
import { respondJson } from './respond-json'
import { theme } from './routes/theme'
import { windows } from './routes/windows'

export type RayServerOptions = {
  host: string
  port: number
  log: EventLog
  onRequest: (request: RayRequest, address: string) => void
}

/**
 * Speaks the handful of endpoints spatie/ray's PHP client expects. See
 * vendor/spatie/ray/src/Client.php for the calls it makes.
 */
export function createRayServer({ host, port, log, onRequest }: RayServerOptions): Server {
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]

    if (path === '/_availability_check') {
      availabilityCheck(res)

      return
    }

    if (path.startsWith('/locks/')) {
      locks(res)

      return
    }

    if (path.startsWith('/api/')) {
      api(req, res, log)

      return
    }

    if (path === '/windows') {
      windows(res)

      return
    }

    if (path === '/theme') {
      theme(res)

      return
    }

    if (path === '/') {
      // curl switches to POST as soon as POSTFIELDS is set, but the client asks
      // for 'get', so accept either rather than depend on that detail.
      void payloads(req, res, onRequest)

      return
    }

    respondJson(res, 404, { message: 'Not found' })
  })

  server.listen(port, host)

  return server
}
