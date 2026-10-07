import { useCallback, useEffect, useState } from 'react'
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
