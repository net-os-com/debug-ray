import { formatDuration } from '../duration'
import type { CacheOperation, HttpRequest } from './types'

/** debugbar's verbs, with the colour each one reads as in the design. */
const OPERATIONS: Record<string, { label: string; fg: string; bg: string }> = {
  hit: { label: 'hit', fg: 'var(--ok-fg)', bg: 'var(--app-surface-2)' },
  missed: { label: 'miss', fg: 'var(--warn-fg)', bg: 'var(--warn-bg)' },
  written: { label: 'write', fg: 'var(--sql-kw)', bg: 'var(--app-sel)' },
  forgotten: { label: 'forget', fg: 'var(--err-fg)', bg: 'var(--err-bg)' },
}

const STATS: { label: string; operation: string; fg: string }[] = [
  { label: 'Hits', operation: 'hit', fg: 'var(--ok-fg)' },
  { label: 'Misses', operation: 'missed', fg: 'var(--warn-fg)' },
  { label: 'Writes', operation: 'written', fg: 'var(--t1)' },
  { label: 'Forgets', operation: 'forgotten', fg: 'var(--t1)' },
]

export function CacheTab({ request }: { request: HttpRequest }) {
  if (request.cache.length === 0) {
    return (
      <div className="tab-pane">
        <div className="pane__none">No cache operations were recorded for this request.</div>
      </div>
    )
  }

  return (
    <div className="tab-pane tab-pane--stacked">
      <div className="stat-row">
        {STATS.map((stat) => (
          <div className="stat-card" key={stat.operation}>
            <div className="stat-card__label">{stat.label}</div>
            <div className="stat-card__value" style={{ color: stat.fg }}>
              {request.cache.filter((entry) => entry.operation === stat.operation).length}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        {request.cache.map((entry, index) => {
          const style = OPERATIONS[entry.operation] ?? {
            label: entry.operation,
            fg: 'var(--t2)',
            bg: 'var(--app-surface-2)',
          }

          return (
            <div className="cache-row" key={`${entry.key}-${index}`}>
              <span className="cache-row__at">{formatDuration(entry.offsetMs)}</span>
              <span className="cache-row__op" style={{ background: style.bg, color: style.fg }}>
                {style.label}
              </span>
              <div className="cache-row__body">
                <div className="cache-row__key" title={entry.key}>
                  {entry.key}
                </div>
                <div className="cache-row__meta">{meta(entry)}</div>
              </div>
              <span className="cache-row__ms">{formatDuration(entry.durationMs)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function meta(entry: CacheOperation): string {
  return [entry.store, ...entry.tags].filter(Boolean).join(' · ')
}
