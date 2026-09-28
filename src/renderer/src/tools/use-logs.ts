import { useCallback, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import { useExecStream } from './use-exec-stream'

export type LogsState = ReturnType<typeof useLogs>

/** Pail's own levels, in the order a filter menu should offer them. */
export const LOG_LEVELS = [
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
] as const

/**
 * A log tail, started and stopped by hand.
 *
 * Deliberately not started on opening the panel: a tail is a process in
 * somebody's container, and one that starts because a tab was clicked is one
 * nobody remembers is running. It is held above the view, though, so going off
 * to read a request and coming back does not lose the tail or its history.
 */
export function useLogs(container: TinkerContainer | null) {
  const [level, setLevel] = useState('')
  const [filter, setFilter] = useState('')
  const stream = useExecStream()

  const start = useCallback(() => {
    if (container === null) {
      return
    }

    void stream.start([
      'exec',
      '-i',
      '-w',
      container.workingDir || '/var/www/html',
      container.id,
      'php',
      'artisan',
      'pail',
      '--no-interaction',
      '--ansi',
      // Pail stops on its own after an hour by default, which for a tail you
      // left open reads as the logs having gone quiet.
      '--timeout=0',
      ...(level === '' ? [] : [`--level=${level}`]),
      ...(filter.trim() === '' ? [] : [`--filter=${filter.trim()}`]),
    ])
  }, [container, level, filter, stream])

  return { level, setLevel, filter, setFilter, start, stream }
}
