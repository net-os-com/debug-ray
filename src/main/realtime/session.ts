import type { ChannelAuth } from '../../shared/realtime'
import { mintToken } from '../api/impersonate'
import { authorize } from './auth'
import { PusherSocket, type Frame, type SocketStatus } from './socket'

/** Everything the socket needs to authorize a channel, as one unit. */
export type RealtimeContext = {
  url: string
  containerId: string
  workingDir: string
  /** The API environment's host, where /broadcasting/auth lives. */
  host: string
  tenant: string
  /** Who subscriptions are made as. */
  actorId: string
  insecure: boolean
}

export type RealtimeEmit = {
  frame: (frame: Frame) => void
  status: (status: SocketStatus, detail: string) => void
}

/**
 * One window's realtime connection.
 *
 * The token lives here and is never sent to the renderer. A window that can
 * read a token for an arbitrary user is a window one scripting mistake away
 * from leaking it; a window that can only ask to subscribe is not.
 */
export class RealtimeSession {
  private socket: PusherSocket | null = null
  private context: RealtimeContext | null = null
  private token: { actorId: string; token: string } | null = null
  /** Survives a reconnect, so switching user does not lose the channel list. */
  private channels = new Set<string>()

  constructor(private readonly emit: RealtimeEmit) {}

  /**
   * Points the session at a stack and a user.
   *
   * Changing the user is a reconnect, not a re-subscribe: Pusher has already
   * accepted the channels this socket is on, and nothing about them would be
   * re-checked. Dropping the socket is the only way for "Auth as" to mean what
   * it says — the refusals you then see are this user's refusals.
   */
  open(context: RealtimeContext): void {
    const same =
      this.context !== null &&
      this.context.url === context.url &&
      this.context.actorId === context.actorId &&
      this.context.tenant === context.tenant &&
      this.context.host === context.host

    this.context = context

    if (same && this.socket !== null) {
      return
    }

    this.token = null
    this.socket?.close()

    const socket = new PusherSocket({
      onFrame: (frame) => this.emit.frame(frame),
      onStatus: (status, detail) => this.emit.status(status, detail),
      authorize: (channel, socketId) => this.authorize(channel, socketId),
    })

    this.socket = socket
    socket.open(context.url)

    for (const channel of this.channels) {
      socket.subscribe(channel)
    }
  }

  subscribe(channel: string): void {
    this.channels.add(channel)
    this.socket?.subscribe(channel)
  }

  unsubscribe(channel: string): void {
    this.channels.delete(channel)
    this.socket?.unsubscribe(channel)
  }

  whisper(channel: string, event: string, data: unknown): boolean {
    return this.socket?.whisper(channel, event, data) ?? false
  }

  close(): void {
    this.socket?.close()
    this.socket = null
    this.context = null
    this.token = null
    this.channels.clear()
  }

  private async authorize(channel: string, socketId: string): Promise<ChannelAuth> {
    const context = this.context

    if (context === null) {
      return { auth: '', channelData: null, status: 0, error: 'Nothing is connected.' }
    }

    if (this.token === null || this.token.actorId !== context.actorId) {
      const minted = await mintToken(
        context.containerId,
        context.workingDir,
        context.tenant,
        context.actorId,
      )

      if (minted.error !== null || minted.token === '') {
        return {
          auth: '',
          channelData: null,
          status: 0,
          error: minted.error ?? 'No token could be minted for this user.',
        }
      }

      this.token = { actorId: context.actorId, token: minted.token }
    }

    return authorize({
      host: context.host,
      token: this.token.token,
      tenant: context.tenant,
      socketId,
      channel,
      insecure: context.insecure,
    })
  }
}
