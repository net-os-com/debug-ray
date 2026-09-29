import type { RayEvent } from '../../shared/ray-event'
import { customKind } from './detail/payloads/custom-kind'
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
      return customTitle(content)
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
    case 'screen_color':
      return `screen colour · ${text(content.color)}`
    case 'response':
      return `response · ${text(content.status_code) || '?'}`
    case 'view':
      return text(content.view_path_relative_to_project_root) || text(content.view_path) || 'view'
    case 'notify':
      return truncate(firstLine(text(content.value)), 90) || 'notify'
    case 'new_screen':
      return `new screen · ${text(content.name) || 'unnamed'}`
    case 'create_lock':
      return `lock · ${text(content.name)}`
    case 'size':
      return `size · ${text(content.size)}`
    case 'json_string':
      return truncate(text(content.value), 90) || 'json'
    case 'hide':
      return 'hide'
    case 'remove':
      return 'remove'
    case 'clear_all':
      return 'clear all'
    case 'expand':
      return `expand · ${Array.isArray(content.keys) && content.keys.length > 0 ? content.keys.join(', ') : `level ${content.level ?? 'all'}`}`
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

/**
 * Nine helpers send a `custom` payload and say which one they were in the
 * label — except json(), which sends an empty one, and file(), whose label is
 * the file's own name.
 */
function customTitle(content: Record<string, unknown>): string {
  const label = text(content.label)

  switch (customKind(content.label, content.content)) {
    case 'json':
      return jsonTitle(content.content)
    case 'bool':
      return content.content === true ? 'true' : 'false'
    case 'null':
      return 'null'
    case 'file':
      return label || 'file'
    default:
      return label || titleForValues([content.content])
  }
}

/** An object stringifies to "[object Object]", which says nothing at all. */
function jsonTitle(value: unknown): string {
  if (Array.isArray(value)) {
    return `json · ${value.length} ${value.length === 1 ? 'item' : 'items'}`
  }

  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value as Record<string, unknown>)

    return truncate(`json · ${keys.join(', ')}`, 90)
  }

  return `json · ${String(value)}`
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
