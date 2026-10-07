import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest, type RequestOptions } from 'node:https'
import { URL } from 'node:url'
import type { ApiResult, ApiSend, ApiTiming } from '../../shared/api'

const NO_TIMING: ApiTiming = { dns: 0, connect: 0, tls: 0, firstByte: 0, download: 0, total: 0 }

/**
 * Sends one request and reports what came back, and how long each part took.
 *
 * This runs in the main process rather than the renderer for three reasons: no
 * origin means no CORS to argue with, every header is ours to set including the
 * ones a browser reserves, and the socket's own events are the only place the
 * real phases of a request — name lookup, connection, handshake, first byte —
 * can be read. A renderer's fetch can tell you it took 210 milliseconds and
 * nothing about where they went.
 */
export function send(options: ApiSend): Promise<ApiResult> {
  let url: URL

  try {
    url = new URL(options.url)
  } catch {
    return Promise.resolve(failure(`${options.url} is not a URL.`))
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return Promise.resolve(failure(`${url.protocol} is not a protocol this can send over.`))
  }

  const debugId = randomUUID()
  const { body, headers } = payload(options, debugId)

  const settings: RequestOptions = {
    method: options.method,
    headers,
    // A local stack behind a self-signed certificate is the normal case, and
    // refusing to connect teaches you nothing you did not already know.
    rejectUnauthorized: !options.insecure,
  }

  return new Promise((resolve) => {
    const start = process.hrtime.bigint()
    const marks = { dns: 0, connect: 0, tls: 0, sent: 0, firstByte: 0 }
    const since = (): number => Number(process.hrtime.bigint() - start) / 1_000_000

    const client = url.protocol === 'https:' ? httpsRequest : httpRequest
    const call = client(url, settings)
    let settled = false

    const finish = (result: ApiResult): void => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      call.destroy()
      finish(failure(`No answer within ${Math.round(options.timeoutMs / 1_000)} seconds.`, debugId))
    }, options.timeoutMs)

    call.on('socket', (socket) => {
      socket.on('lookup', () => (marks.dns = since()))
      socket.on('connect', () => (marks.connect = since()))
      socket.on('secureConnect', () => (marks.tls = since()))
    })

    call.on('response', (response) => {
      marks.firstByte = since()

      const chunks: Buffer[] = []

      response.on('data', (chunk: Buffer) => chunks.push(chunk))

      response.on('end', () => {
        const received = Buffer.concat(chunks)
        const total = since()

        finish({
          status: response.statusCode ?? 0,
          statusText: response.statusMessage ?? '',
          headers: Object.entries(response.headers).map(([key, value]) => ({
            key,
            value: Array.isArray(value) ? value.join(', ') : String(value ?? ''),
          })),
          body: received.toString('utf8'),
          size: received.byteLength,
          timing: phases(marks, total),
          debugId,
          error: null,
        })
      })

      response.on('error', (error: Error) => finish(failure(error.message, debugId)))
    })

    call.on('error', (error: Error) => finish(failure(error.message, debugId)))

    if (body !== null) {
      call.write(body)
    }

    marks.sent = since()
    call.end()
  })
}

type Marks = { dns: number; connect: number; tls: number; sent: number; firstByte: number }

/**
 * The socket reports moments; a timing bar wants durations. Each phase is the
 * gap since the previous mark that actually happened — a connection reused from
 * the pool reports no lookup and no handshake, and those should read as zero
 * rather than as the whole request.
 */
function phases(marks: Marks, total: number): ApiTiming {
  const dns = marks.dns
  const connect = marks.connect === 0 ? 0 : marks.connect - dns
  const tls = marks.tls === 0 ? 0 : marks.tls - marks.connect
  const before = Math.max(dns + connect + tls, 0)
  const firstByte = marks.firstByte === 0 ? 0 : Math.max(marks.firstByte - before, 0)

  return {
    dns: round(dns),
    connect: round(connect),
    tls: round(tls),
    firstByte: round(firstByte),
    download: round(Math.max(total - before - firstByte, 0)),
    total: round(total),
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * The body and the headers are decided together: a JSON body needs a content
 * type and a length, and a form needs a boundary that the parts are then built
 * around.
 */
function payload(
  options: ApiSend,
  debugId: string,
): { body: Buffer | null; headers: Record<string, string> } {
  const headers: Record<string, string> = {}

  for (const header of options.headers) {
    if (header.key.trim() !== '') {
      headers[header.key] = header.value
    }
  }

  // So a request sent from here can be found again in the Requests view, which
  // sees the other side of the same call.
  headers['X-Netos-Debug-Id'] = debugId

  if (options.form !== null) {
    const boundary = `----NetOSDebug${debugId.replace(/-/g, '')}`
    const body = multipart(options.form, boundary)

    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`
    headers['Content-Length'] = String(body.byteLength)

    return { body, headers }
  }

  if (options.body === null || options.body === '') {
    return { body: null, headers }
  }

  const body = Buffer.from(options.body, 'utf8')

  if (headers['Content-Type'] === undefined && headers['content-type'] === undefined) {
    headers['Content-Type'] = 'application/json'
  }

  headers['Content-Length'] = String(body.byteLength)

  return { body, headers }
}

/** Only text parts for now; a file part carries its path and is read at send. */
function multipart(
  fields: { key: string; value: string; file: boolean }[],
  boundary: string,
): Buffer {
  const parts: Buffer[] = []

  for (const field of fields) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${field.key}"\r\n\r\n${field.value}\r\n`,
        'utf8',
      ),
    )
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))

  return Buffer.concat(parts)
}

function failure(message: string, debugId = ''): ApiResult {
  return {
    status: 0,
    statusText: '',
    headers: [],
    body: '',
    size: 0,
    timing: NO_TIMING,
    debugId,
    error: message,
  }
}
