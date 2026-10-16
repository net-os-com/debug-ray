/** What the renderer needs to open a socket, read out of the application. */
export type PusherCredentials = {
  /** The broadcaster the application is actually configured to use. */
  driver: string
  /** The app key. Public by design: it travels in the socket's own URL. */
  key: string
  cluster: string
  /**
   * The REST host the application talks to, which is not where a client
   * connects. Kept so `websocketUrl` can tell a self-hosted stack from Pusher's
   * own — the two derive their socket host differently.
   */
  host: string
  port: number
  scheme: string
  error: string | null
}

export const NO_CREDENTIALS: PusherCredentials = {
  driver: '',
  key: '',
  cluster: '',
  host: '',
  port: 443,
  scheme: 'https',
  error: null,
}

/**
 * Where the socket connects.
 *
 * Pusher's own cloud answers REST on `api-{cluster}.pusher.com` and websockets
 * on `ws-{cluster}.pusher.com`, so the configured host is the wrong one to
 * connect to and the cluster is what decides. A self-hosted broadcaster —
 * Reverb, Soketi — serves both from the one host it was given, so there the
 * configured host is exactly right. Telling them apart is the whole job.
 */
export function websocketUrl(credentials: PusherCredentials): string {
  const hosted = credentials.host === '' || /(^|\.)pusher\.com$/i.test(credentials.host)

  if (hosted) {
    const cluster = credentials.cluster || 'mt1'

    return `wss://ws-${cluster}.pusher.com/app/${credentials.key}?protocol=7&client=netos-debug&version=1.0`
  }

  const secure = credentials.scheme !== 'http'
  const scheme = secure ? 'wss' : 'ws'

  return `${scheme}://${credentials.host}:${credentials.port}/app/${credentials.key}?protocol=7&client=netos-debug&version=1.0`
}

/** What `/broadcasting/auth` said about one channel, for one user. */
export type ChannelAuth = {
  /** The signature Pusher wants, empty when the server refused. */
  auth: string
  /** Presence channels only: the member this subscription announces. */
  channelData: string | null
  status: number
  error: string | null
}

/** The outcome of dispatching a broadcast inside the application. */
export type BroadcastOutcome = {
  ok: boolean
  error: string | null
}

export type ChannelKind = 'public' | 'private' | 'presence'

export function channelKind(name: string): ChannelKind {
  if (name.startsWith('presence-')) {
    return 'presence'
  }

  return name.startsWith('private-') ? 'private' : 'public'
}

/** One frame as it crossed the wire, before anything interprets it. */
export type RealtimeFrame = {
  event: string
  channel: string | null
  data: unknown
}

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
