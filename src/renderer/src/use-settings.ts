import { useCallback, useEffect, useState } from 'react'
import type { ApiAuthMode } from '../../shared/api'
import type { StreamOrder } from './filter-events'
import { readPreference, writePreference } from './preferences'
import { SLOW_QUERY_MS, SLOW_REQUEST_MS } from './requests/types'

export type EditorChoice = 'none' | 'phpstorm' | 'vscode' | 'cursor' | 'sublime'
export type StartView = 'stream' | 'requests'

export type Settings = {
  // Window
  alwaysOnTop: boolean
  launchAtLogin: boolean
  closeToBackground: boolean
  defaultView: StartView

  // Stream
  /** Which end of the stream the newest events sit at. */
  streamOrder: StreamOrder
  autoscroll: boolean
  hideVendorFrames: boolean
  relativeTime: boolean
  eventBuffer: number

  // Requests
  collectRequests: boolean
  hideVendorQueries: boolean
  requestBuffer: number
  slowRequestMs: number
  slowQueryMs: number

  // Notifications
  notifyOnError: boolean
  notifyOnEvent: boolean
  notificationSound: boolean
  notificationCoalesceMs: number

  /**
   * The Docker container every PHP feature runs in, by name.
   *
   * By name and not by id: an id changes every time the container is recreated,
   * which `docker compose up` does routinely, and a setting that silently stops
   * matching is worse than one that was never set. Empty means "pick one",
   * which prefers a container that actually holds this application.
   */
  container: string

  /**
   * What the Realtime view connects with, when it should not be what the
   * application is configured with.
   *
   * Empty means "read it from the container", which is the normal case. Set
   * them to point the debugger at another stack's Pusher application without
   * editing that stack's .env. Only the key and the cluster, both of which
   * travel in the socket's own URL: the secret is never needed here, because a
   * broadcast is dispatched by the application itself.
   */
  realtimeKey: string
  realtimeCluster: string

  /**
   * The database the ERD and the schema tools last read.
   *
   * Remembered because picking it again on every launch is a step that teaches
   * nothing. Empty means the central database. A tenant that no longer exists
   * falls back to the first one rather than leaving the view empty.
   *
   * Paired with its own flag rather than treating empty as "never picked":
   * central *is* the empty string, so without this, choosing central would be
   * indistinguishable from never having chosen and would be overwritten by the
   * first tenant on the next launch.
   */
  erdTenant: string
  erdTenantChosen: boolean

  /**
   * The newest release described in `changelog/` at the last time the modal
   * was opened. The badge is on whenever a newer one exists, and one look
   * clears it — the point is to say "there is something new", not to keep a
   * reading record per entry.
   */
  changelogSeen: string

  /** Writes schema.dbml a moment after you stop typing, when it parses. */
  erdAutoSave: boolean

  /**
   * Outgoing HTTP calls: how many are kept, and whether they are kept at all.
   *
   * Separate from the request buffer because the two fill at different rates —
   * one page load can make a dozen outgoing calls — and because somebody
   * debugging an upstream wants a long tail of them while somebody debugging
   * their own endpoints does not want them collected at all.
   */
  httpClientBuffer: number
  collectHttpClient: boolean

  /**
   * Who the API tab sends as, which outlives any one request and any one
   * launch: picking somebody to impersonate costs a search and a minted token,
   * and having it reset by clicking the next route made it a step you repeated
   * all afternoon.
   *
   * The choice is remembered. The token is not: it is minted at send time, held
   * in the main process for as long as the app runs, and good for fifteen
   * minutes wherever it is used.
   */
  apiAuthMode: ApiAuthMode
  apiAuthVariable: string
  apiActorId: string
  apiActorLabel: string

  // Sources
  ignoredSources: string[]

  // Editor
  editor: EditorChoice
  remotePath: string
  localPath: string
}

export const DEFAULTS: Settings = {
  alwaysOnTop: false,
  launchAtLogin: false,
  closeToBackground: false,
  defaultView: 'stream',

  streamOrder: 'newest',
  autoscroll: true,
  hideVendorFrames: true,
  relativeTime: true,
  eventBuffer: 500,

  collectRequests: true,
  hideVendorQueries: false,
  requestBuffer: 100,
  slowRequestMs: SLOW_REQUEST_MS,
  slowQueryMs: SLOW_QUERY_MS,

  notifyOnError: false,
  notifyOnEvent: false,
  notificationSound: true,
  notificationCoalesceMs: 3_000,

  container: '',
  realtimeKey: '',
  realtimeCluster: '',
  erdTenant: '',
  erdTenantChosen: false,
  changelogSeen: '',
  erdAutoSave: false,
  httpClientBuffer: 300,
  collectHttpClient: true,
  apiAuthMode: 'none',
  apiAuthVariable: 'token',
  apiActorId: '',
  apiActorLabel: '',

  ignoredSources: [],

  editor: 'none',
  remotePath: '',
  localPath: '',
}

const KEY = 'settings'

export function useSettings() {
  // Merged with the defaults so a setting added in a later version appears
  // rather than arriving undefined.
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...readPreference<Partial<Settings>>(KEY, {}),
  }))

  useEffect(() => {
    writePreference(KEY, settings)
  }, [settings])

  /**
   * Settings stopped being all-boolean once thresholds, paths and lists
   * arrived, so callers set a value rather than flipping one.
   */
  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }, [])

  const toggle = useCallback((key: keyof Settings) => {
    setSettings((current) => {
      const value = current[key]

      return typeof value === 'boolean' ? { ...current, [key]: !value } : current
    })
  }, [])

  return { settings, set, toggle }
}
