import { useCallback, useEffect, useRef, useState } from 'react'
import { appendChunk, EMPTY_BUFFER, flush, type LineBuffer } from './stream-lines'

export type ExecStream = ReturnType<typeof useExecStream>

/**
 * One long-running command and the lines it has produced so far.
 *
 * The buffer is folded in a ref rather than in state so a chatty command does
 * not queue a render per chunk; React is handed the result on its own schedule.
 */
export function useExecStream() {
  const id = useRef<string | null>(null)
  const buffer = useRef<LineBuffer>(EMPTY_BUFFER)
  const [lines, setLines] = useState(EMPTY_BUFFER.lines)
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const offData = window.ray.onExecData((event) => {
      if (event.id !== id.current) {
        return
      }

      buffer.current = appendChunk(buffer.current, event.chunk, event.stream)
      setLines(buffer.current.lines)
    })

    const offEnd = window.ray.onExecEnd((event) => {
      if (event.id !== id.current) {
        return
      }

      buffer.current = flush(buffer.current, 'out')
      setLines(buffer.current.lines)
      setRunning(false)
      setExitCode(event.code)
    })

    return () => {
      offData()
      offEnd()
    }
  }, [])

  // A stream belongs to the view that started it; leaving the app running a
  // log tail nobody is watching helps no one.
  useEffect(
    () => () => {
      if (id.current !== null) {
        window.ray.stopExec(id.current)
      }
    },
    [],
  )

  const start = useCallback(async (args: string[], columns?: number) => {
    if (id.current !== null) {
      window.ray.stopExec(id.current)
    }

    const next = `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    id.current = next
    buffer.current = EMPTY_BUFFER
    setLines([])
    setExitCode(undefined)
    setProblem(null)
    setRunning(true)

    const result = await window.ray.startExec({ id: next, args, columns })

    if (!result.ok) {
      setRunning(false)
      setProblem(result.message ?? 'The command could not be started.')
    }
  }, [])

  const stop = useCallback(() => {
    if (id.current !== null) {
      window.ray.stopExec(id.current)
    }
  }, [])

  const clear = useCallback(() => {
    buffer.current = { lines: [], pending: buffer.current.pending }
    setLines([])
    setExitCode(undefined)
  }, [])

  return { lines, running, exitCode, problem, start, stop, clear }
}
