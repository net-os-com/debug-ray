import type { ChannelAuth, RealtimeFrame, RealtimeStatus } from '../../shared/realtime'
import { channelKind } from '../../shared/realtime'

export type SocketStatus = RealtimeStatus
export type Frame = RealtimeFrame

export type SocketHandlers = {
  onFrame: (frame: Frame) => void
  onStatus: (status: SocketStatus, detail: string) => void
  /** Asks the application whether this user may hear this channel. */
  authorize: (channel: string, socketId: string) => Promise<ChannelAuth>
}

/** Pusher closes 4000-4099 for good: reconnecting would fail the same way. */
const FATAL_FROM = 4000
const FATAL_TO = 4099

const FIRST_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const DEFAULT_ACTIVITY_MS = 120_000
const PONG_GRACE_MS = 30_000

/**
 * A Pusher client written against the protocol rather than against a library.
 *
 * It lives in the main process, not the window. The renderer's
 * `connect-src 'self'` refuses a socket to Pusher, and widening it to `wss:`
 * would hand "connect anywhere" to the one part of this app that renders
 * payloads from whatever application it is debugging. Main has no such policy,
 * already makes the authorization call, and runs a Node with a global
 * WebSocket — so the socket moved here and nothing was added to get it.
 *
 * `pusher-js` would do this too, and hide it. For a debugger that is the wrong
 * trade: the frames are the thing being debugged, so every one is handed up
 * exactly as it arrived, including the `pusher:` and `pusher_internal:` ones a
 * library would swallow. It also keeps a 33MB renderer bundle from growing.
 *
 * What is lost by not using the library is reconnection, keepalive and
 * subscription bookkeeping, so those are written out below.
 */
export class PusherSocket {
  private socket: WebSocket | null = null
  private url = ''
  private socketId = ''
  private status: SocketStatus = 'idle'

  /** Channels we want to be on, which is not the same as the ones we are on. */
  private wanted = new Set<string>()
  private joined = new Set<string>()

  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setTimeout> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private activityMs = DEFAULT_ACTIVITY_MS
  private closing = false

  constructor(private readonly handlers: SocketHandlers) {}

  /** Opens, or reopens at a new address when the credentials changed. */
  open(url: string): void {
    if (url === this.url && this.socket !== null && this.status === 'connected') {
      return
    }

    this.url = url
    this.closing = false
    this.attempt = 0
    this.connect()
  }

  close(): void {
    this.closing = true
    this.clearTimers()
    this.wanted.clear()
    this.joined.clear()
    this.socketId = ''

    if (this.socket !== null) {
      this.socket.close()
      this.socket = null
    }

    this.setStatus('idle', '')
  }

  currentSocketId(): string {
    return this.socketId
  }

  subscribe(channel: string): void {
    this.wanted.add(channel)

    if (this.status === 'connected') {
      void this.join(channel)
    }
  }

  unsubscribe(channel: string): void {
    this.wanted.delete(channel)
    this.joined.delete(channel)
    this.send({ event: 'pusher:unsubscribe', data: { channel } })
  }

  /**
   * Sends a client event. Pusher refuses these on public channels and only
   * delivers them to other subscribers, never back to the sender — which is
   * why the composer says so rather than waiting for an echo that never comes.
   */
  whisper(channel: string, event: string, data: unknown): boolean {
    if (channelKind(channel) === 'public' || !this.joined.has(channel)) {
      return false
    }

    return this.send({ event: `client-${event}`, channel, data })
  }

  private connect(): void {
    this.clearTimers()

    try {
      this.socket = new WebSocket(this.url)
    } catch (error) {
      this.setStatus('failed', error instanceof Error ? error.message : 'The socket could not open.')

      return
    }

    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting', '')
    this.joined.clear()

    this.socket.onmessage = (message: { data: unknown }) =>
      this.receive(typeof message.data === 'string' ? message.data : String(message.data))

    this.socket.onerror = () => {
      // The browser gives no reason for a socket error on purpose; the close
      // that follows carries the code worth reporting, so this stays quiet.
    }

    this.socket.onclose = (event: { code: number; reason: string }) => {
      this.clearTimers()
      this.socketId = ''
      this.joined.clear()

      if (this.closing) {
        return
      }

      if (event.code >= FATAL_FROM && event.code <= FATAL_TO) {
        this.setStatus('failed', `${event.code}: ${event.reason || 'the server refused the connection'}`)

        return
      }

      this.retry()
    }
  }

  private retry(): void {
    const wait = Math.min(FIRST_BACKOFF_MS * 2 ** this.attempt, MAX_BACKOFF_MS)

    this.attempt += 1
    this.setStatus('reconnecting', `retrying in ${Math.round(wait / 1_000)}s`)
    this.reconnectTimer = setTimeout(() => this.connect(), wait)
  }

  private receive(raw: string): void {
    this.heartbeat()

    let frame: { event?: string; channel?: string; data?: unknown }

    try {
      frame = JSON.parse(raw) as { event?: string; channel?: string; data?: unknown }
    } catch {
      return
    }

    const event = typeof frame.event === 'string' ? frame.event : ''
    // Pusher double-encodes data: the envelope is JSON, and its data member is
    // a JSON string. Decoding it here means nothing downstream has to know.
    const data = decode(frame.data)

    if (event === 'pusher:connection_established') {
      const established = data as { socket_id?: string; activity_timeout?: number }

      this.socketId = typeof established.socket_id === 'string' ? established.socket_id : ''
      this.activityMs =
        typeof established.activity_timeout === 'number'
          ? established.activity_timeout * 1_000
          : DEFAULT_ACTIVITY_MS
      this.attempt = 0
      this.setStatus('connected', '')

      for (const channel of this.wanted) {
        void this.join(channel)
      }
    }

    if (event === 'pusher:ping') {
      this.send({ event: 'pusher:pong', data: {} })
    }

    if (event === 'pusher_internal:subscription_succeeded' && typeof frame.channel === 'string') {
      this.joined.add(frame.channel)
    }

    this.handlers.onFrame({
      event,
      channel: typeof frame.channel === 'string' ? frame.channel : null,
      data,
    })
  }

  /**
   * Joins one channel, asking the application first when the name says it is
   * not public. A refusal is reported as a frame rather than thrown, so it
   * lands in the message list beside everything else that happened.
   */
  private async join(channel: string): Promise<void> {
    if (this.joined.has(channel)) {
      return
    }

    if (channelKind(channel) === 'public') {
      this.send({ event: 'pusher:subscribe', data: { channel } })

      return
    }

    const socketId = this.socketId
    const auth = await this.handlers.authorize(channel, socketId)

    // The socket can go away while the application is deciding, and
    // subscribing on the new one with the old socket's signature would be
    // rejected for a reason that has nothing to do with the user's access.
    if (socketId !== this.socketId || !this.wanted.has(channel)) {
      return
    }

    if (auth.error !== null || auth.auth === '') {
      this.handlers.onFrame({
        event: 'netos:subscription_refused',
        channel,
        data: { status: auth.status, message: auth.error ?? 'The application refused this channel.' },
      })

      return
    }

    const payload: Record<string, unknown> = { channel, auth: auth.auth }

    if (auth.channelData !== null) {
      payload.channel_data = auth.channelData
    }

    this.send({ event: 'pusher:subscribe', data: payload })
  }

  private send(frame: Record<string, unknown>): boolean {
    if (this.socket === null || this.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    this.socket.send(JSON.stringify(frame))

    return true
  }

  /**
   * Pusher drops a socket it has not heard from. Anything arriving resets the
   * clock; silence for the activity timeout gets a ping, and silence after
   * that means the connection is gone whatever the socket still claims.
   */
  private heartbeat(): void {
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer)
    }

    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }

    this.pingTimer = setTimeout(() => {
      this.send({ event: 'pusher:ping', data: {} })
      this.pongTimer = setTimeout(() => this.socket?.close(), PONG_GRACE_MS)
    }, this.activityMs)
  }

  private clearTimers(): void {
    for (const timer of [this.reconnectTimer, this.pingTimer, this.pongTimer]) {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }

    this.reconnectTimer = null
    this.pingTimer = null
    this.pongTimer = null
  }

  private setStatus(status: SocketStatus, detail: string): void {
    this.status = status
    this.handlers.onStatus(status, detail)
  }
}

/** Pusher's `data` is a JSON string inside JSON, except when it is not. */
function decode(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}
