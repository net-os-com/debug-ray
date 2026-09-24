import { useCallback, useEffect, useState } from 'react'
import { readPreference, writePreference } from './preferences'

export type Settings = {
  autoscroll: boolean
  hideVendorFrames: boolean
  notifyOnError: boolean
  alwaysOnTop: boolean
}

const DEFAULTS: Settings = {
  autoscroll: true,
  hideVendorFrames: true,
  notifyOnError: false,
  alwaysOnTop: false,
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

  const toggle = useCallback((key: keyof Settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  return { settings, toggle }
}
