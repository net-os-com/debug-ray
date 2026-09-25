import { formatSeconds } from '../duration'

type MeasureDetailProps = {
  content: Record<string, unknown>
}

type Bar = { label: string; value: string; pct: number }

export function MeasureDetail({ content }: MeasureDetailProps) {
  const total = seconds(content.total_time)
  const sinceLast = seconds(content.time_since_last_call)
  const peak = Math.max(total, sinceLast, 0.000001)

  const bars: Bar[] = [
    { label: 'Total time', value: ms(total), pct: (total / peak) * 100 },
    { label: 'Since last call', value: ms(sinceLast), pct: (sinceLast / peak) * 100 },
  ]

  const memory = [
    { label: 'Max memory (total)', value: megabytes(content.max_memory_usage_during_total_time) },
    {
      label: 'Max memory (since last call)',
      value: megabytes(content.max_memory_usage_since_last_call),
    },
  ]

  return (
    <div className="measures">
      {bars.map((bar) => (
        <div key={bar.label}>
          <div className="measures__head">
            <span className="measures__label">{bar.label}</span>
            <span className="measures__value">{bar.value}</span>
          </div>
          <div className="measures__track">
            <div className="measures__bar" style={{ width: `${Math.round(bar.pct)}%` }} />
          </div>
        </div>
      ))}
      {memory.map((row) => (
        <div className="measures__head" key={row.label}>
          <span className="measures__label">{row.label}</span>
          <span className="measures__value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function seconds(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function ms(value: number): string {
  return formatSeconds(value)
}

function megabytes(value: unknown): string {
  return typeof value === 'number' ? `${(value / 1024 / 1024).toFixed(2)} MB` : '—'
}
