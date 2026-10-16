import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
import type { ChannelAuth } from '../../shared/realtime'

const TIMEOUT_MS = 15_000

export type AuthRequest = {
  /** The environment's host, no trailing slash. */
  host: string
  /** A token for the user the subscription is made as. */
  token: string
  tenant: string
  socketId: string
  channel: string
  insecure: boolean
}

/**
 * Asks the application whether this user may listen to this channel.
 *
 * It runs here rather than in the renderer for the reason every other call in
 * this app does: the window's origin is `file://`, so a local stack behind a
 * self-signed certificate refuses the handshake and CORS refuses the rest.
 *
 * A refusal is an answer, not a failure. `routes/channels.php` returning 403 is
 * the application telling you this user cannot hear that channel, which is
 * usually the thing you opened the debugger to find out — so the status comes
 * back intact rather than collapsed into an error string.
 */
export function authorize(options: AuthRequest): Promise<ChannelAuth> {
  let url: URL

  try {
    url = new URL(`${options.host.replace(/\/+$/, '')}/broadcasting/auth`)
  } catch {
    return Promise.resolve(failed(`${options.host} is not a URL.`))
  }

  const body = new URLSearchParams({
    socket_id: options.socketId,
    channel_name: options.channel,
  }).toString()

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'Content-Length': String(Buffer.byteLength(body)),
  }

  if (options.token !== '') {
    headers.Authorization = `Bearer ${options.token}`
  }

  if (options.tenant !== '') {
    headers['X-Tenant'] = options.tenant
  }

  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest
    const call = client(url, {
      method: 'POST',
      headers,
      rejectUnauthorized: !options.insecure,
    })

    let settled = false

    const finish = (result: ChannelAuth): void => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      call.destroy()
      finish(failed('The application did not answer in time.'))
    }, TIMEOUT_MS)

    call.on('error', (error: Error) => finish(failed(error.message)))

    call.on('response', (response) => {
      const chunks: Buffer[] = []

      response.on('data', (chunk: Buffer) => chunks.push(chunk))

      response.on('end', () => {
        const status = response.statusCode ?? 0
        const text = Buffer.concat(chunks).toString('utf8')

        if (status < 200 || status >= 300) {
          finish({ auth: '', channelData: null, status, error: reason(status, text) })

          return
        }

        try {
          const parsed = JSON.parse(text) as { auth?: string; channel_data?: string }

          finish({
            auth: typeof parsed.auth === 'string' ? parsed.auth : '',
            channelData: typeof parsed.channel_data === 'string' ? parsed.channel_data : null,
            status,
            error: null,
          })
        } catch {
          finish({
            auth: '',
            channelData: null,
            status,
            error: 'The application answered with something that is not JSON.',
          })
        }
      })
    })

    call.end(body)
  })
}

/**
 * What a status means here, in the words of this application rather than the
 * HTTP ones — each of these has a different thing to go and fix.
 */
function reason(status: number, text: string): string {
  if (status === 401) {
    return 'Not signed in: the token was rejected. Pick a user to authenticate as.'
  }

  if (status === 403) {
    return 'Forbidden: routes/channels.php refused this user for this channel.'
  }

  if (status === 404) {
    return 'No /broadcasting/auth route. Check that broadcasting is registered in bootstrap/app.php.'
  }

  if (status === 419) {
    return 'Tenant could not be identified. Check the X-Tenant header on this environment.'
  }

  const first = text.trim().split('\n')[0] ?? ''

  return first === '' ? `The application answered ${status}.` : `${status}: ${first.slice(0, 160)}`
}

function failed(error: string): ChannelAuth {
  return { auth: '', channelData: null, status: 0, error }
}
