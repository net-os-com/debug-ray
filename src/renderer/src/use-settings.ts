import { useCallback, useEffect, useState } from 'react'

export type Settings = {
  autoscroll: boolean
  hideVendorFrames: boolean
  notifyOnError: boolean
}

const DEFAULTS: Settings = {
  autoscroll: true,
  hideVendorFrames: true,
  notifyOnError: false,
}

const KEY = 'netos-ray.settings'

function stored(): Settings {
  try {
    const raw = localStorage.getItem(KEY)

    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(stored)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // A blocked storage should never break the app.
    }
  }, [settings])

  const toggle = useCallback((key: keyof Settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  return { settings, toggle }
}
