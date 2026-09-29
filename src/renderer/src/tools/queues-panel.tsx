import { useEffect, useState } from 'react'
import { ConsolePane } from './console-pane'
import { leaks, megabytes, waitLabel, type QueuesState } from './use-queues'

type Tab = 'queues' | 'failed' | 'processes'

const TABS: { key: Tab; label: string }[] = [
  { key: 'queues', label: 'Queues' },
  { key: 'failed', label: 'Failed' },
  { key: 'processes', label: 'Processes' },
]

export function QueuesPanel({ queues }: { queues: QueuesState }) {
  const [tab, setTab] = useState<Tab>('queues')

  // Opening the panel is the question; making you press Check as well turns a
  // glance into two steps, and the first one is always the same.
  useEffect(() => {
    if (!queues.checked && !queues.loading) {
      void queues.check()
    }
  }, [queues])

  const { report, scans } = queues
  const leak = leaks(scans)

  return (
    <section className="artisan">
      <div className="artisan__head">
        <div className="artisan__title">
          <span className="artisan__name">Queues</span>
          <span className="artisan__description">
            {report.horizon
              ? `Horizon · ${report.supervisors.length} supervisors · ${report.throughput} jobs/min`
              : 'What the queue driver reports'}
          </span>
        </div>

        <div className="tools__tabs">
          {TABS.map((entry) => (
            <button
              className={entry.key === tab ? 'tools__tab tools__tab--on' : 'tools__tab'}
              key={entry.key}
              onClick={() => setTab(entry.key)}
              type="button"
            >
              {entry.label}
              {entry.key === 'failed' && report.failedTotal > 0 ? (
                <span className="tools__tab-count">{report.failedTotal}</span>
              ) : null}
              {entry.key === 'processes' && leak.defunct + leak.orphaned > 0 ? (
                <span className="tools__tab-count tools__tab-count--warn">
                  {leak.defunct + leak.orphaned}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <button
          className="button button--primary"
          disabled={queues.loading}
          onClick={() => void queues.check()}
          type="button"
        >
          {queues.loading ? 'Checking' : 'Refresh'}
        </button>
      </div>

      <div className="scout">
        {report.error !== null ? <div className="scout__note">{report.error}</div> : null}

        {tab === 'queues' ? <QueuesTab queues={queues} /> : null}
        {tab === 'failed' ? <FailedTab queues={queues} /> : null}
        {tab === 'processes' ? <ProcessesTab queues={queues} /> : null}
      </div>

      <ConsolePane
        empty="Retrying or forgetting a job reports here."
        exitCode={queues.stream.exitCode}
        lines={queues.stream.lines}
        onClear={queues.stream.clear}
        onStop={queues.stream.stop}
        problem={queues.stream.problem}
        running={queues.stream.running}
      />
    </section>
  )
}

function QueuesTab({ queues }: { queues: QueuesState }) {
  const { report } = queues

  if (report.queues.length === 0) {
    return <div className="scout__empty">No queues are configured on this connection.</div>
  }

  return (
    <>
      <table className="scout__table">
        <thead>
          <tr>
            <th>Queue</th>
            <th className="scout__number">Waiting</th>
            <th className="scout__number">Oldest wait</th>
            <th className="scout__number">Workers</th>
          </tr>
        </thead>
        <tbody>
          {report.queues.map((queue) => (
            <tr key={`${queue.connection}:${queue.name}`}>
              <td className="scout__model">{queue.name}</td>
              <td
                className="scout__number"
                style={{ color: queue.length > 0 ? 'var(--warn-fg)' : 'var(--t3)' }}
              >
                {queue.length}
              </td>
              <td className="scout__number">{waitLabel(queue.wait)}</td>
              <td className="scout__number">{queue.processes}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {report.supervisors.length === 0 ? null : (
        <>
          <div className="scout__note">
            {report.recent} jobs in the last hour, {report.completed} of them finished.
          </div>

          <table className="scout__table">
            <thead>
              <tr>
                <th>Supervisor</th>
                <th>Queues</th>
                <th className="scout__number">Workers</th>
                <th className="scout__number">Memory cap</th>
                <th className="scout__number">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.supervisors.map((supervisor) => (
                <tr key={supervisor.name}>
                  <td className="scout__model">{supervisor.name.split(':').pop()}</td>
                  <td className="scout__index">{supervisor.queues.join(', ')}</td>
                  <td className="scout__number">
                    {supervisor.processes} / {supervisor.maxProcesses}
                  </td>
                  <td className="scout__number">{supervisor.memoryLimit} MB</td>
                  <td
                    className="scout__number"
                    style={{
                      color: supervisor.status === 'running' ? 'var(--ok-fg)' : 'var(--err-fg)',
                    }}
                  >
                    {supervisor.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}

function FailedTab({ queues }: { queues: QueuesState }) {
  const { report } = queues

  if (report.failed.length === 0) {
    return <div className="scout__empty">Nothing has failed.</div>
  }

  return (
    <>
      <div className="scout__note">
        <span className="scout__note-text">
          {report.failedTotal} failed
          {report.failedTotal > report.failed.length
            ? `, showing the ${report.failed.length} most recent.`
            : '.'}
        </span>
        <button
          className={queues.armed === 'all' ? 'button button--danger' : 'button'}
          disabled={queues.stream.running}
          onClick={queues.retryAll}
          type="button"
        >
          {queues.armed === 'all' ? 'Yes, retry all' : 'Retry all'}
        </button>
        {queues.armed === 'all' ? (
          <button className="button" onClick={queues.disarm} type="button">
            Cancel
          </button>
        ) : null}
      </div>

      <table className="scout__table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Queue</th>
            <th>Tenant</th>
            <th>Failed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {report.failed.map((job) => (
            <tr key={job.id}>
              <td className="scout__model">
                <span title={job.name}>{job.name.split('\\').pop()}</span>
                <span className="queues__exception" title={job.exception}>
                  {job.exception}
                </span>
              </td>
              <td className="scout__index">{job.queue}</td>
              <td className="scout__index">{job.tenant || '—'}</td>
              <td className="scout__index">{when(job.failedAt)}</td>
              <td className="scout__action">
                <button
                  className="button"
                  disabled={queues.stream.running}
                  onClick={() => queues.retry(job.id)}
                  type="button"
                >
                  Retry
                </button>
                <button
                  className={queues.armed === job.id ? 'button button--danger' : 'button'}
                  disabled={queues.stream.running}
                  onClick={() => queues.forget(job.id)}
                  type="button"
                >
                  {queues.armed === job.id ? 'Yes, forget' : 'Forget'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/**
 * Horizon knows what it started. It does not know what it failed to reap, and
 * that is the half that takes the machine down.
 */
function ProcessesTab({ queues }: { queues: QueuesState }) {
  const { scans } = queues
  const leak = leaks(scans)

  if (scans.length === 0) {
    return (
      <div className="scout__empty">
        No container reported a queue process. Images without <code>ps</code> cannot be read.
      </div>
    )
  }

  return (
    <>
      {leak.defunct + leak.orphaned === 0 ? null : (
        <div className="scout__note scout__note--warn">
          {leak.defunct > 0 ? `${leak.defunct} exited processes nobody reaped` : ''}
          {leak.defunct > 0 && leak.orphaned > 0 ? ' and ' : ''}
          {leak.orphaned > 0 ? `${leak.orphaned} workers whose master is gone` : ''}. They hold a
          process slot and their memory until the container restarts, and the machine runs out
          somewhere else first — usually in whatever the database is doing at the time.
        </div>
      )}

      {scans.map((scan) => (
        <div key={scan.container}>
          <div className="scout__note">
            {scan.container} · {scan.total} processes
            {scan.defunct > 0 ? `, ${scan.defunct} defunct` : ''}
          </div>

          {/* A container can hold zombies and no live worker at all, and a
              header with nothing under it reads as a failure to load. */}
          {scan.processes.length === 0 ? null : (
          <table className="scout__table">
            <thead>
              <tr>
                <th className="scout__number">PID</th>
                <th>Command</th>
                <th className="scout__number">Memory</th>
                <th className="scout__number">Age</th>
              </tr>
            </thead>
            <tbody>
              {scan.processes.map((process) => (
                <tr key={process.pid}>
                  <td className="scout__number">{process.pid}</td>
                  <td className="scout__index">
                    <span title={process.command}>{shorten(process.command)}</span>
                    {process.orphaned ? <span className="scout__flag">orphan</span> : null}
                  </td>
                  <td className="scout__number">{megabytes(process.rss)} MB</td>
                  <td className="scout__number">{process.elapsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      ))}
    </>
  )
}

/**
 * A horizon:work line is three hundred characters of flags around four useful
 * words. The supervisor is usually named after its queue, and printing both
 * says the same thing twice.
 */
function shorten(command: string): string {
  const verb = /artisan\s+(\S+)/.exec(command)?.[1] ?? command.split(/\s+/)[0]
  const queue = /--queue=(\S+)/.exec(command)?.[1]
  const supervisor = /--supervisor=\S+:(\S+)/.exec(command)?.[1]
  const parts = supervisor === queue ? [verb, queue] : [verb, supervisor, queue]

  return parts.filter(Boolean).join(' · ')
}

function when(timestamp: number): string {
  const date = new Date(timestamp)

  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
