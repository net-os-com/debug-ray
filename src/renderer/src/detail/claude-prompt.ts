import type { RayEvent } from '../../../shared/ray-event'
import { copyText } from './copy-text'
import type { Frame } from './frames-detail'

const MAX_FRAMES = 12

/**
 * A paste-ready prompt for a Claude Code session. Everything Claude needs is
 * already in the payload: the throwable, the frames, and the code around the
 * failing line.
 */
export function claudePrompt(event: RayEvent): string {
  const where = origin(event)

  switch (event.type) {
    case 'exception':
      return exceptionPrompt(event, where)

    case 'executed_query':
      return [
        'This query ran in my app and I want to understand it.',
        '',
        String(event.content.sql ?? ''),
        '',
        bindings(event.content.bindings),
        `Sent from ${where}.`,
      ]
        .filter(Boolean)
        .join('\n')

    default:
      return [
        `Here is a \`ray()\` dump from my app, sent from ${where}.`,
        '',
        '```',
        copyText(event),
        '```',
      ].join('\n')
  }
}

function exceptionPrompt(event: RayEvent, where: string): string {
  const all = Array.isArray(event.content.frames) ? (event.content.frames as Frame[]) : []
  const application = all.filter((frame) => !frame.vendor_frame)
  const shown = (application.length > 0 ? application : all).slice(0, MAX_FRAMES)
  const hidden = all.length - shown.length

  const parts = [
    'Debug this exception from my app. Find the cause and propose a fix.',
    '',
    `${event.content.class ?? 'Exception'}: ${event.content.message ?? ''}`,
    `Thrown at ${where}.`,
    '',
    'Stack trace:',
    ...shown.map((frame, index) => `#${index} ${location(frame)}${callable(frame)}`),
  ]

  if (hidden > 0) {
    parts.push(`(${hidden} vendor frames omitted)`)
  }

  const snippet = shown.find((frame) => frame.snippet?.length)

  if (snippet?.snippet) {
    parts.push(
      '',
      `Code around ${location(snippet).trim()}:`,
      '```php',
      ...snippet.snippet.map((line) => `${String(line.line_number).padStart(4)} | ${line.text}`),
      '```',
    )
  }

  return parts.join('\n')
}

function location(frame: Frame): string {
  return `${frame.file_name}:${frame.line_number}`
}

function callable(frame: Frame): string {
  if (frame.class && frame.method) {
    return ` — ${frame.class}::${frame.method}`
  }

  return frame.method ? ` — ${frame.method}` : ''
}

function bindings(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? `Bindings: ${JSON.stringify(value)}\n` : ''
}

function origin(event: RayEvent): string {
  const file = event.origin.file ?? 'an unknown file'

  return event.origin.line_number ? `${file}:${event.origin.line_number}` : file
}
