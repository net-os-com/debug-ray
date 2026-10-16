import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApiEnvironment, ApiUser } from '../../../shared/api'
import type { TinkerContainer } from '../../../shared/tinker'
import { resolve } from '../../../shared/resolve'
import {
  NO_CREDENTIALS,
  channelKind,
  websocketUrl,
  type PusherCredentials,
  type RealtimeFrame,
  type RealtimeStatus,
} from '../../../shared/realtime'
import {
  CHANNEL_COLORS,
  matches,
  membersOf,
  type Channel,
  type RealtimeMessage,
} from './channels'

export type RealtimeState = ReturnType<typeof useRealtime>

export type Transport = 'pusher' | 'mqtt'
export type ComposerMode = 'broadcast' | 'whisper'

/** Enough history to find the one you missed, little enough to stay quick. */
const MAX_MESSAGES = 300

/** Often enough to catch a page you just opened, rarely enough to be free. */
const FOLLOW_EVERY_MS = 5_000

export type RealtimeOverride = {
  key: string
  cluster: string
}

export function useRealtime(
  container: TinkerContainer | null,
  environment: ApiEnvironment | null,
  override: RealtimeOverride,
  /**
   * Whether the Realtime view is the one on screen.
   *
   * This hook is mounted for the whole application's lifetime, so without this
   * the discovery poll would keep running while you are reading the stream or
   * drawing an ERD. One poll is a `docker exec` and a Laravel bootstrap —
   * about 1.2 seconds of somebody's CPU — and five seconds later it would do
   * it again, forever. The socket stays connected either way, so nothing is
   * missed; only the asking pauses, and it resumes the moment you come back.
   */
  active: boolean,
) {
  /**
   * The same tenant the API view sends, read from the environment's own
   * variable. Taking it from anywhere else would let a token be minted in one
   * tenant and a channel authorized in another, which fails as a 403 that has
   * nothing to do with the user's access.
   */
  const tenant = useMemo(
    () => (environment === null ? '' : resolve('{{ tenant }}', environment.variables)),
    [environment],
  )
  const [transport, setTransport] = useState<Transport>('pusher')
  const [credentials, setCredentials] = useState<PusherCredentials>(NO_CREDENTIALS)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [detail, setDetail] = useState('')
  const [socketId, setSocketId] = useState('')
  const [connectedAt, setConnectedAt] = useState<number | null>(null)

  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<RealtimeMessage[]>([])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')

  /**
   * Whether to keep up with whatever the application is actually using.
   *
   * On by default: the reason to open this view is usually "show me what the
   * browser is doing", and that answer should not need a button.
   */
  const [follow, setFollow] = useState(true)
  const [followError, setFollowError] = useState<string | null>(null)

  const [actors, setActors] = useState<ApiUser[]>([])
  const [actorId, setActorId] = useState('')
  const [events, setEvents] = useState<string[]>([])

  const [mode, setMode] = useState<ComposerMode>('broadcast')
  const [event, setEvent] = useState('')
  const [whisperName, setWhisperName] = useState('typing')
  const [target, setTarget] = useState('')
  const [payload, setPayload] = useState('{\n  "hello": "world"\n}')
  const [sending, setSending] = useState(false)

  const counter = useRef(0)
  const pausedRef = useRef(paused)
  /**
   * The channel names, readable synchronously. A state updater is not a safe
   * place to decide "is this new?" when a poll can fire twice before React has
   * re-rendered — it would subscribe to the same channel twice.
   */
  const namesRef = useRef(new Set<string>())
  /** Channels dropped by hand, which following must not drag back in. */
  const dismissedRef = useRef(new Set<string>())

  pausedRef.current = paused

  const say = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast((current) => (current === text ? '' : current)), 2_600)
  }, [])

  const add = useCallback((message: RealtimeMessage) => {
    setMessages((current) => current.concat([message]).slice(-MAX_MESSAGES))
  }, [])

  /** Reading the application's configuration, which is where a session starts. */
  useEffect(() => {
    if (container === null) {
      setCredentials(NO_CREDENTIALS)

      return
    }

    let current = true

    setLoading(true)
    void window.ray
      .realtimeCredentials(container.id, container.workingDir)
      .then((answer) => {
        if (current) {
          setCredentials(answer)
        }
      })
      .finally(() => {
        if (current) {
          setLoading(false)
        }
      })

    void window.ray.realtimeEvents(container.id, container.workingDir).then((list) => {
      if (current) {
        setEvents(list)
        setEvent((chosen) => (chosen === '' ? (list[0] ?? '') : chosen))
      }
    })

    return () => {
      current = false
    }
  }, [container])

  /** Who a subscription can be made as. */
  useEffect(() => {
    if (container === null || tenant === '') {
      setActors([])

      return
    }

    let current = true

    void window.ray.searchApiUsers(container.id, container.workingDir, tenant, '').then((list) => {
      if (current) {
        setActors(list)
        setActorId((chosen) => (chosen === '' ? (list[0]?.id ?? '') : chosen))
      }
    })

    return () => {
      current = false
    }
  }, [container, tenant])

  const effective = useMemo<PusherCredentials>(
    () => ({
      ...credentials,
      key: override.key !== '' ? override.key : credentials.key,
      cluster: override.cluster !== '' ? override.cluster : credentials.cluster,
      // An overridden key is a different Pusher application, so the host read
      // from this one would send the socket to the wrong place.
      host: override.key !== '' || override.cluster !== '' ? '' : credentials.host,
    }),
    [credentials, override.key, override.cluster],
  )

  /** Frames and status come from the socket in main, which owns the token. */
  useEffect(() => {
    const offFrame = window.ray.onRealtimeFrame((frame: RealtimeFrame) => {
      if (frame.event === 'pusher:connection_established') {
        const id = (frame.data as { socket_id?: string })?.socket_id

        setSocketId(typeof id === 'string' ? id : '')
      }

      if (frame.event === 'pusher_internal:subscription_succeeded' && frame.channel !== null) {
        const mine = (frame.data as { presence?: { me?: { id?: unknown } } })?.presence?.me?.id

        setChannels((current) =>
          current.map((one) =>
            one.name === frame.channel
              ? {
                  ...one,
                  members: membersOf(frame.data, mine === undefined ? null : String(mine)),
                  refused: null,
                }
              : one,
          ),
        )
      }

      // Pusher reports a refusal as a frame and carries on. It is the answer to
      // something you just did — a client event on an app that has them turned
      // off, a message over the size limit — so it is said out loud rather than
      // left to be noticed in the list.
      if (frame.event === 'pusher:error') {
        const why = (frame.data as { message?: string })?.message

        if (typeof why === 'string' && why !== '') {
          say(why)
        }
      }

      if (frame.event === 'netos:subscription_refused' && frame.channel !== null) {
        const why = (frame.data as { message?: string })?.message ?? 'Refused.'

        setChannels((current) =>
          current.map((one) => (one.name === frame.channel ? { ...one, refused: why } : one)),
        )
      }

      if (pausedRef.current) {
        return
      }

      counter.current += 1
      add({
        id: `in-${counter.current}`,
        dir: 'in',
        at: Date.now(),
        channel: frame.channel ?? '',
        event: frame.event,
        payload: frame.data,
        via: null,
      })
    })

    const offStatus = window.ray.onRealtimeStatus((next, why) => {
      setStatus(next as RealtimeStatus)
      setDetail(why)
      setConnectedAt((current) => (next === 'connected' ? (current ?? Date.now()) : null))

      if (next !== 'connected') {
        setSocketId('')
      }
    })

    return () => {
      offFrame()
      offStatus()
      void window.ray.realtimeClose()
    }
  }, [add, say])

  /**
   * Points the session at this stack and this user. Main reconnects when the
   * user changes, so a channel the previous one could hear is checked again.
   */
  useEffect(() => {
    if (container === null || environment === null || transport !== 'pusher') {
      return
    }

    if (effective.key === '' || actorId === '') {
      return
    }

    void window.ray.realtimeOpen({
      url: websocketUrl(effective),
      containerId: container.id,
      workingDir: container.workingDir,
      host: environment.host,
      tenant,
      actorId,
      insecure: environment.insecure,
    })
  }, [actorId, container, effective, environment, tenant, transport])

  const subscribe = useCallback(
    (name: string, announce = true) => {
      const clean = name.trim()

      if (clean === '') {
        return
      }

      if (namesRef.current.has(clean)) {
        if (announce) {
          say('Already subscribed to that channel.')
        }

        return
      }

      namesRef.current.add(clean)
      dismissedRef.current.delete(clean)

      setChannels((current) =>
        current.concat([
          {
            id: `ch-${Date.now().toString(36)}-${current.length}`,
            name: clean,
            color: CHANNEL_COLORS[current.length % CHANNEL_COLORS.length] as string,
            muted: false,
            members: [],
            refused: null,
          },
        ]),
      )

      setTarget((chosen) => (chosen === '' ? clean : chosen))
      void window.ray.realtimeSubscribe(clean)
    },
    [say],
  )

  const unsubscribe = useCallback((name: string) => {
    namesRef.current.delete(name)
    // Remembered, so the next poll does not immediately put it back.
    dismissedRef.current.add(name)
    void window.ray.realtimeUnsubscribe(name)
    setChannels((current) => current.filter((one) => one.name !== name))
    setFilter((current) => (current === name ? 'all' : current))
    setTarget((current) => (current === name ? '' : current))
  }, [])

  /**
   * Follows the application: Pusher is asked which channels have somebody on
   * them, and each one is subscribed to.
   *
   * This is the closest thing the protocol has to "everything" — there is no
   * wildcard subscribe, so the list has to be fetched and each name sent. A
   * channel is occupied because something is listening, so what comes back is
   * what the browser is on.
   */
  useEffect(() => {
    if (!follow || !active || container === null || transport !== 'pusher') {
      return
    }

    let live = true

    const look = async (): Promise<void> => {
      const answer = await window.ray.realtimeOccupied(container.id, container.workingDir)

      if (!live) {
        return
      }

      setFollowError(answer.error)

      for (const name of answer.channels) {
        if (!dismissedRef.current.has(name)) {
          subscribe(name, false)
        }
      }
    }

    void look()

    const timer = setInterval(() => void look(), FOLLOW_EVERY_MS)

    return () => {
      live = false
      clearInterval(timer)
    }
  }, [active, container, follow, subscribe, transport])

  const send = useCallback(async () => {
    if (container === null) {
      say('Pick a container first.')

      return
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(payload)
    } catch {
      say('Payload must be valid JSON.')

      return
    }

    if (target === '') {
      say('Pick a channel to send on.')

      return
    }

    if (!channels.some((one) => one.name === target)) {
      say(`Subscribe to ${target} first.`)

      return
    }

    if (mode === 'whisper') {
      if (channelKind(target) === 'public') {
        say('Client events need a private or presence channel.')

        return
      }

      const name = whisperName.trim() || 'event'

      if (!(await window.ray.realtimeWhisper(target, name, parsed))) {
        say('Not subscribed on the socket yet — wait for the channel to connect.')

        return
      }

      counter.current += 1
      add({
        id: `out-${counter.current}`,
        dir: 'out',
        at: Date.now(),
        channel: target,
        event: `client-${name}`,
        payload: parsed,
        via: 'whisper',
      })

      return
    }

    const name = event.trim()

    if (name === '') {
      say('Name the event to broadcast.')

      return
    }

    setSending(true)

    // Stamped before the call, not after it. The event reaches Pusher and comes
    // back while this await is still running, so stamping on return makes the
    // row that sent it look younger than its own echo.
    const at = Date.now()

    const outcome = await window.ray.realtimeBroadcast(
      container.id,
      container.workingDir,
      tenant,
      target,
      name,
      payload,
    )

    setSending(false)

    if (!outcome.ok) {
      say(outcome.error ?? 'The event could not be broadcast.')

      return
    }

    counter.current += 1
    add({
      id: `out-${counter.current}`,
      dir: 'out',
      at,
      channel: target,
      event: name,
      payload: parsed,
      via: 'broadcast',
    })
  }, [add, channels, container, event, mode, payload, say, target, tenant, whisperName])

  const muted = useMemo(
    () => new Set(channels.filter((one) => one.muted).map((one) => one.name)),
    [channels],
  )

  const shown = useMemo(
    () =>
      messages
        .filter((message) => matches(message, filter, muted, query.trim()))
        .slice()
        .reverse(),
    [filter, messages, muted, query],
  )

  const valid = useMemo(() => {
    try {
      JSON.parse(payload)

      return true
    } catch {
      return false
    }
  }, [payload])

  return {
    transport,
    setTransport,
    credentials: effective,
    loading,
    status,
    detail,
    socketId,
    connectedAt,
    url: effective.key === '' ? '' : websocketUrl(effective),

    channels,
    subscribe,
    unsubscribe,
    follow,
    setFollow,
    followError,
    toggleMute: useCallback((name: string) => {
      setChannels((current) =>
        current.map((one) => (one.name === name ? { ...one, muted: !one.muted } : one)),
      )
    }, []),

    messages,
    shown,
    paused,
    setPaused,
    filter,
    setFilter,
    query,
    setQuery,
    openId,
    setOpenId,
    clear: useCallback(() => {
      setMessages([])
      setOpenId(null)
    }, []),

    draft,
    setDraft,
    actors,
    actorId,
    setActorId,
    events,

    mode,
    setMode,
    event,
    setEvent,
    whisperName,
    setWhisperName,
    target,
    setTarget,
    payload,
    setPayload,
    valid,
    sending,
    send,

    toast,
    say,

    /** Pulls a received message back into the composer, ready to send again. */
    reuse: useCallback((message: RealtimeMessage) => {
      setTarget(message.channel)
      setPayload(JSON.stringify(message.payload, null, 2))

      if (message.event.startsWith('client-')) {
        setMode('whisper')
        setWhisperName(message.event.slice('client-'.length))

        return
      }

      setMode('broadcast')
      setEvent(message.event)
    }, []),
  }
}
