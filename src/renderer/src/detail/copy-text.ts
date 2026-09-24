import type { RayEvent } from '../../../shared/ray-event'
import { toPlainText } from '../ui/plain-text'

type Frame = {
  file_name?: string | null
  line_number?: number | string | null
  class?: string | null
  method?: string | null
}

/**
 * What lands on the clipboard. spatie/ray ships a plain-text rendering of every
 * logged value in `meta[0].clipboard_data` precisely for this, so prefer it over
 * the raw payload envelope — pasting HtmlDumper markup helps nobody.
 */
export function copyText(event: RayEvent): string {
  const shipped = clipboardData(event.content)

  if (shipped) {
    return shipped
  }

  const content = event.content

  switch (event.type) {
    case 'executed_query':
      return String(content.sql ?? '')

    case 'exception':
      return exceptionText(content)

    case 'table':
      return fieldsText(content.values)

    case 'custom':
      return typeof content.content === 'string'
        ? toPlainText(content.content)
        : JSON.stringify(content.content, null, 2)

    case 'log':
    case 'application_log':
      return (Array.isArray(content.values) ? content.values : [content.value])
        .map(plain)
        .join('\n')

    default:
      return JSON.stringify(content, null, 2)
  }
}

function clipboardData(content: Record<string, unknown>): string | null {
  const meta = content.meta

  if (!Array.isArray(meta)) {
    return null
  }

  const value = (meta[0] as Record<string, unknown> | undefined)?.clipboard_data

  return typeof value === 'string' && value !== '' ? value : null
}

function exceptionText(content: Record<string, unknown>): string {
  const frames = Array.isArray(content.frames) ? (content.frames as Frame[]) : []

  const trace = frames.map(
    (frame, index) =>
      `#${index} ${frame.file_name}:${frame.line_number}` +
      (frame.class || frame.method ? ` — ${frame.class ?? ''}${frame.class && frame.method ? '::' : ''}${frame.method ?? ''}` : ''),
  )

  return [`${content.class ?? 'Exception'}: ${content.message ?? ''}`, ...trace].join('\n')
}

function fieldsText(values: unknown): string {
  if (values === null || typeof values !== 'object') {
    return ''
  }

  return Object.entries(values as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${plain(value)}`)
    .join('\n')
}

function plain(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'string') {
    return toPlainText(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value, null, 2)
}
