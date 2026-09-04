import type { RayEvent } from '../../shared/ray-event'
import { toPlainText, truncate } from './ui/plain-text'

const MAX = 160

/** The single monospace line under a row's title. */
export function eventPreview(event: RayEvent): string {
  const content = event.content

  switch (event.type) {
    case 'log':
    case 'application_log':
      return line(Array.isArray(content.values) ? content.values : [content.value])
    case 'custom':
      return line([content.content])
    case 'table':
      return tablePreview(content.values)
    case 'exception':
      return line([content.message])
    case 'executed_query':
      return line([content.sql])
    case 'measure':
      return `${seconds(content.total_time)} total · since last call ${seconds(content.time_since_last_call)}`
    case 'eloquent_model':
      return line([content.attributes])
    case 'event':
      return line([content.payload ?? content.event])
    case 'job_event':
      return line([content.job])
    case 'mailable':
      return line([content.to])
    case 'trace':
      return Array.isArray(content.frames) ? `${content.frames.length} frames` : ''
    case 'carbon':
      return `${content.timestamp} · ${content.timezone}`
    default:
      return line([content.value ?? content.label ?? content.color])
  }
}

function line(values: unknown[]): string {
  const parts = values.filter((value) => value !== undefined).map(one)

  return truncate(parts.join(' · ').replace(/\s+/g, ' ').trim(), MAX)
}

function one(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return toPlainText(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value) ?? ''
}

function tablePreview(values: unknown): string {
  if (values === null || typeof values !== 'object') {
    return ''
  }

  const keys = Object.keys(values as Record<string, unknown>)

  return truncate(`${keys.length} rows · ${keys.join(', ')}`, MAX)
}

function seconds(value: unknown): string {
  return typeof value === 'number' ? `${(value * 1000).toFixed(1)} ms` : '—'
}
