import { useEffect, useState } from 'react'
import type { Theme } from '../use-theme'

export type PanelPreferences = {
  theme: Theme
  relativeTime: boolean
  eventBuffer: number
  /** Off, the panel shows no last request, as the window collects none. */
  collectRequests: boolean
  /** At or above this a request's duration shows red. */
  slowRequestMs: number
}

const THEMES: Theme[] = ['light', 'dark', 'phosphor']

/** The window's own default for "Slow request". */
const SLOW_REQUEST_MS = 200

function read(): PanelPreferences {
  const stored = window.ray.readPreferences()
  const settings =
    typeof stored.settings === 'object' && stored.settings !== null
      ? (stored.settings as Record<string, unknown>)
      : {}
  const theme = THEMES.find((one) => one === stored.theme) ?? 'light'
  const buffer = settings.eventBuffer
  const slow = settings.slowRequestMs

  return {
    theme,
    relativeTime: settings.relativeTime !== false,
    eventBuffer: typeof buffer === 'number' && Number.isInteger(buffer) && buffer >= 1 ? buffer : 500,
    collectRequests: settings.collectRequests !== false,
    slowRequestMs: typeof slow === 'number' && slow >= 0 ? slow : SLOW_REQUEST_MS,
  }
}

/**
 * The few settings the panel follows, read and never written.
 *
 * Not `useTheme` or `useSettings`: both write their state back as they mount,
 * and the panel lives for as long as the app does, so a write from here would
 * one day put back a theme or a setting the main window has since changed.
 * Read again whenever the panel comes up, which is when a change made in the
 * main window meanwhile needs to show.
 */
export function usePanelPreferences(): PanelPreferences {
  const [preferences, setPreferences] = useState(read)

  useEffect(() => {
    const refresh = (): void => setPreferences(read())

    window.addEventListener('focus', refresh)

    return () => window.removeEventListener('focus', refresh)
  }, [])

  return preferences
}
