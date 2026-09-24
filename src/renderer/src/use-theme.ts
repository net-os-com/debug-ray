import { useCallback, useEffect, useState } from 'react'
import { readPreference, writePreference } from './preferences'

export type Theme = 'light' | 'dark'

const KEY = 'theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    readPreference<Theme>(KEY, 'light') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    writePreference(KEY, theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
