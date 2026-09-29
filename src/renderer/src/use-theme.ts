import { useCallback, useEffect, useState } from 'react'
import { readPreference, writePreference } from './preferences'

export type Theme = 'light' | 'dark' | 'phosphor'

const KEY = 'theme'

const THEMES: Theme[] = ['light', 'dark', 'phosphor']

function stored(): Theme {
  const value = readPreference<Theme>(KEY, 'light')

  return THEMES.includes(value) ? value : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored)
  /** Where a plain click returns to, so phosphor is never a trap. */
  const [before, setBefore] = useState<Theme>(() => (stored() === 'phosphor' ? 'dark' : stored()))

  useEffect(() => {
    writePreference(KEY, theme)
  }, [theme])

  const toggle = useCallback(
    (shift = false) => {
      setTheme((current) => {
        if (current === 'phosphor') {
          return before
        }

        if (shift) {
          setBefore(current)

          return 'phosphor'
        }

        return current === 'dark' ? 'light' : 'dark'
      })
    },
    [before],
  )

  return { theme, toggle }
}
