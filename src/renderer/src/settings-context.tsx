import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULTS, type Settings } from './use-settings'

const SettingsContext = createContext<Settings>(DEFAULTS)

/**
 * Thresholds and display preferences are read by leaf components several levels
 * down — a query row needs to know what counts as slow. Threading that through
 * every intermediate component as props would bury the props that actually
 * describe the component, so it is read from context instead.
 */
export function SettingsProvider({
  settings,
  children,
}: {
  settings: Settings
  children: ReactNode
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSettingsValue(): Settings {
  return useContext(SettingsContext)
}
