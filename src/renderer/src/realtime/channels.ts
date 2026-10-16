import { channelKind, type ChannelKind } from '../../../shared/realtime'

export { channelKind }
export type { ChannelKind }

/** The same ramp the ERD colours its tables with, so one palette runs the app. */
export const CHANNEL_COLORS = ['#246CB7', '#047857', '#B45309', '#B91C1C', '#595959', '#0A2D51']

export type Channel = {
  id: string
  name: string
  color: string
  muted: boolean
  /** Presence channels only: who else is on it. */
  members: Member[]
  /** Set when the application refused the subscription. */
  refused: string | null
}

export type Member = {
  id: string
  name: string
  me: boolean
}

export type Direction = 'in' | 'out'

export type RealtimeMessage = {
  id: string
  dir: Direction
  at: number
  channel: string
  event: string
  payload: unknown
  /** How it was sent, for the badge. Null for anything received. */
  via: 'broadcast' | 'whisper' | null
}

/** Pusher's own frames, which are worth seeing but are not application events. */
export function isSystemEvent(event: string): boolean {
  return event.startsWith('pusher:') || event.startsWith('pusher_internal:') || event.startsWith('netos:')
}

export function shortEvent(event: string): string {
  const parts = event.split('\\')

  return parts[parts.length - 1] || event
}

/**
 * Reads the members out of a presence subscription.
 *
 * The shape is Pusher's: an id/info map plus the id this socket belongs to.
 * Laravel puts whatever `routes/channels.php` returned into `info`, so the
 * readable name is wherever that function chose to put it.
 */
export function membersOf(data: unknown, mine: string | null): Member[] {
  const presence = (data as { presence?: { ids?: unknown; hash?: unknown } })?.presence

  if (presence === undefined) {
    return []
  }

  const ids = Array.isArray(presence.ids) ? presence.ids.map(String) : []
  const hash = (presence.hash ?? {}) as Record<string, unknown>

  return ids.map((id) => ({ id, name: nameOf(hash[id], id), me: id === mine }))
}

function nameOf(info: unknown, fallback: string): string {
  if (typeof info === 'string') {
    return info
  }

  const record = info as Record<string, unknown> | null

  for (const key of ['name', 'label', 'full_name', 'email']) {
    const value = record?.[key]

    if (typeof value === 'string' && value !== '') {
      return value
    }
  }

  return fallback
}

/** Does this message pass the channel filter, the mute list and the search? */
export function matches(
  message: RealtimeMessage,
  filter: string,
  muted: Set<string>,
  query: string,
): boolean {
  if (message.dir === 'in' && muted.has(message.channel)) {
    return false
  }

  if (filter !== 'all' && message.channel !== filter) {
    return false
  }

  if (query === '') {
    return true
  }

  const haystack = `${message.channel} ${message.event} ${JSON.stringify(message.payload)}`

  return haystack.toLowerCase().includes(query.toLowerCase())
}
