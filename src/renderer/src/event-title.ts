import type { RayEvent } from '../../shared/ray-event'
import { isVarDump } from './ui/sf-dump'
import { toPlainText, truncate } from './ui/plain-text'

const DUMP_ROOT = /<span class=sf-dump-note>([^<]+)<\/span>/

/** The bold headline on a stream row and in the detail panel. */
export function eventTitle(event: RayEvent): string {
  const content = event.content

  switch (event.type) {
    case 'log':
      return titleForValues(Array.isArray(content.values) ? content.values : [])
    case 'custom':
      // html(), text(), image() and markdown() name themselves; json() sends an
      // empty label, so fall back to describing the dump.
      return text(content.label) || titleForValues([content.content])
    case 'exception':
      return `${text(content.class) || 'Exception'}: ${firstLine(text(content.message))}`
    case 'executed_query':
      return queryTitle(text(content.sql))
    case 'measure':
      return `measure · ${text(content.name) || 'default'}`
    case 'eloquent_model':
      return text(content.class_name) || 'Model'
    case 'job_event':
      return text(content.event_name) || 'Job'
    case 'event':
      return text(content.name) || 'Event'
    case 'mailable':
      return text(content.subject) || text(content.mailable_class) || 'Mailable'
    case 'carbon':
      return text(content.formatted) || 'Carbon'
    case 'color':
      return `screen colour · ${text(content.color)}`
    case 'trace':
      return `trace · ${Array.isArray(content.frames) ? content.frames.length : 0} frames`
    case 'caller':
      return 'caller'
    case 'separator':
      return 'separator'
    default:
      return text(content.label) || text(content.value) || event.type
  }
}

function titleForValues(values: unknown[]): string {
  if (values.length === 0) {
    return 'log'
  }

  const first = values[0]

  if (isVarDump(first)) {
    return DUMP_ROOT.exec(first)?.[1] ?? 'dump'
  }

  if (first === null) {
    return 'null'
  }

  return truncate(firstLine(String(first)), 90)
}

/** "select * from `activities` …" reads better as "select · activities". */
function queryTitle(sql: string): string {
  const verb = /^\s*(select|insert|update|delete|replace)/i.exec(sql)?.[1]?.toLowerCase()
  const table = /(?:from|into|update|join)\s+[`"]?([a-z0-9_]+)[`"]?/i.exec(sql)?.[1]

  if (verb && table) {
    return `${verb} · ${table}`
  }

  return truncate(sql.replace(/\s+/g, ' ').trim(), 90) || 'query'
}

function text(value: unknown): string {
  if (typeof value === 'string') {
    return isVarDump(value) ? toPlainText(value) : value
  }

  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
}

function firstLine(value: string): string {
  return value.split('\n')[0]
}
