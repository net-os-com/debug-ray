import { useCallback, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { ContainerProcesses, QueueReport } from '../../../shared/tools'
import { useExecStream } from './use-exec-stream'

export type QueuesState = ReturnType<typeof useQueues>

const EMPTY: QueueReport = {
  horizon: false,
  defaultConnection: '',
  queues: [],
  supervisors: [],
  failed: [],
  failedTotal: 0,
  recent: 0,
  completed: 0,
  throughput: 0,
  error: null,
}

export function useQueues(container: TinkerContainer | null) {
  const [report, setReport] = useState<QueueReport>(EMPTY)
  const [scans, setScans] = useState<ContainerProcesses[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  /** The failed job a destructive action has been asked for but not confirmed. */
  const [armed, setArmed] = useState<string | null>(null)
  const stream = useExecStream()

  const check = useCallback(async () => {
    if (container === null) {
      return
    }

    setLoading(true)

    try {
      const next = await window.ray.getQueueReport(container.id, container.workingDir)

      setReport(next)
      setChecked(true)

      // Which masters are alive decides which workers are orphans, so the scan
      // has to follow the report rather than run beside it.
      const masters = [...new Set(next.supervisors.map((supervisor) => supervisor.master))]

      setScans(await window.ray.getContainerProcesses(masters))
    } finally {
      setLoading(false)
    }
  }, [container])

  const run = useCallback(
    (args: string[]) => {
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
        ...args,
        '--no-interaction',
        '--ansi',
      ])
    },
    [container, stream],
  )

  /** Retrying is safe: the job goes back on its queue and keeps its record. */
  const retry = useCallback((id: string) => run(['queue:retry', id]), [run])

  const retryAll = useCallback(() => {
    if (armed !== 'all') {
      setArmed('all')

      return
    }

    setArmed(null)
    run(['queue:retry', 'all'])
  }, [armed, run])

  /** Forgetting throws the record away, so it asks first. */
  const forget = useCallback(
    (id: string) => {
      if (armed !== id) {
        setArmed(id)

        return
      }

      setArmed(null)
      run(['queue:forget', id])
    },
    [armed, run],
  )

  return {
    report,
    scans,
    loading,
    checked,
    armed,
    disarm: useCallback(() => setArmed(null), []),
    check,
    retry,
    retryAll,
    forget,
    stream,
  }
}

/**
 * Every zombie and every worker whose master is gone, across all containers.
 * One number, because the question is "is something leaking", not "where".
 */
export function leaks(scans: ContainerProcesses[]): { defunct: number; orphaned: number } {
  return {
    defunct: scans.reduce((total, scan) => total + scan.defunct, 0),
    orphaned: scans.reduce(
      (total, scan) => total + scan.processes.filter((process) => process.orphaned).length,
      0,
    ),
  }
}

/** ps reports kilobytes; a worker is measured in megabytes. */
export function megabytes(rss: number): number {
  return Math.round(rss / 1_024)
}

/** "waited 3m 20s" reads; "waited 200" does not. */
export function waitLabel(seconds: number): string {
  if (seconds <= 0) {
    return '—'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)

  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
