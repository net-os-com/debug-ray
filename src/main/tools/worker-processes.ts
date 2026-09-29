import type { ContainerProcesses, WorkerProcess } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const PS_TIMEOUT_MS = 10_000

/** Anything that is, or was, doing queue work. */
const QUEUE_PROCESS = /horizon(:watch|:supervisor|:work)?\b|queue:work/

/** `--supervisor=<master>:<name>`, and the positional form the supervisor takes. */
const FROM_OPTION = /--supervisor=([^\s:]+):/
const FROM_ARGUMENT = /horizon:supervisor\s+([^\s:]+):/

/**
 * Which processes are actually running inside the containers, and which of them
 * nobody is waiting for any more.
 *
 * Horizon knows what it started; it does not know what it failed to reap. A
 * `horizon:watch` that restarts on every file change leaves the old master's
 * workers running and their exited children unreaped, and the first symptom is
 * the machine running out of memory somewhere else entirely — which is why this
 * counts zombies and orphans rather than trusting Horizon's own tally.
 */
export async function containerProcesses(
  containers: { id: string; name: string }[],
  liveMasters: string[],
): Promise<ContainerProcesses[]> {
  const live = new Set(liveMasters)

  const scans = await Promise.all(
    containers.map(async (container) => {
      const result = await runDocker(
        ['exec', container.id, 'ps', '-A', '-o', 'pid=,stat=,rss=,etime=,args='],
        null,
        PS_TIMEOUT_MS,
      ).catch(() => null)

      // Plenty of images ship without ps; that is not a finding worth reporting.
      if (result === null || result.code !== 0) {
        return null
      }

      const rows = parsePs(result.stdout)
      const processes: WorkerProcess[] = rows
        .filter((row) => !row.zombie && QUEUE_PROCESS.test(row.command))
        .map(({ zombie, ...row }) => {
          const master = masterOf(row.command)

          return { ...row, master, orphaned: master !== '' && !live.has(master) }
        })

      const defunct = rows.filter((row) => row.zombie).length

      if (processes.length === 0 && defunct === 0) {
        return null
      }

      return {
        container: container.name,
        total: rows.length,
        defunct,
        processes,
      }
    }),
  )

  return scans.filter((scan): scan is ContainerProcesses => scan !== null)
}

type Row = Omit<WorkerProcess, 'master' | 'orphaned'> & { zombie: boolean }

/** `pid stat rss etime args`, with args free to contain anything including spaces. */
export function parsePs(output: string): Row[] {
  const rows: Row[] = []

  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line)

    if (match === null) {
      continue
    }

    rows.push({
      pid: Number(match[1]),
      // A zombie is reported as Z, sometimes with a modifier after it.
      zombie: match[2].startsWith('Z'),
      rss: Number(match[3]),
      elapsed: match[4],
      command: match[5],
    })
  }

  return rows
}

/** Which master started this, as far as the command line says. */
export function masterOf(command: string): string {
  return FROM_OPTION.exec(command)?.[1] ?? FROM_ARGUMENT.exec(command)?.[1] ?? ''
}

/** `1-02:08:08`, `02:08:08` and `08:07` all mean a number of seconds. */
export function elapsedSeconds(elapsed: string): number {
  const [days, clock] = elapsed.includes('-') ? elapsed.split('-') : ['0', elapsed]
  const parts = clock.split(':').map(Number)

  if (parts.some((part) => !Number.isFinite(part))) {
    return 0
  }

  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0]

  return Number(days) * 86_400 + hours * 3_600 + minutes * 60 + seconds
}
