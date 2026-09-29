import type { RayEvent } from '../../shared/ray-event'
import { customKind } from './detail/payloads/custom-kind'
import { isVarDump } from './ui/sf-dump'

/**
 * The design groups payloads into kinds with their own colour. The first eight
 * are the exact `dot` / light-fg / dark-fg triples from the canvas' KINDS map;
 * media and screen were added when the payloads that need them stopped being
 * lumped in with plain logs.
 */
export type Kind = {
  key: string
  label: string
  dot: string
  fgLight: string
  fgDark: string
}

export const KINDS: Record<string, Kind> = {
  log: { key: 'log', label: 'log', dot: '102 102 102', fgLight: '64 64 64', fgDark: '191 191 191' },
  dump: { key: 'dump', label: 'dump', dot: '36 108 183', fgLight: '23 77 132', fgDark: '139 181 248' },
  api: { key: 'api', label: 'api', dot: '5 150 105', fgLight: '4 120 87', fgDark: '110 231 183' },
  query: { key: 'query', label: 'query', dot: '50 144 241', fgLight: '23 77 132', fgDark: '139 181 248' },
  error: { key: 'error', label: 'error', dot: '220 38 38', fgLight: '185 28 28', fgDark: '252 165 165' },
  measure: { key: 'measure', label: 'measure', dot: '217 119 6', fgLight: '180 83 9', fgDark: '252 211 77' },
  table: { key: 'table', label: 'table', dot: '89 89 89', fgLight: '64 64 64', fgDark: '191 191 191' },
  event: { key: 'event', label: 'event', dot: '115 115 115', fgLight: '64 64 64', fgDark: '191 191 191' },
  media: { key: 'media', label: 'media', dot: '147 51 234', fgLight: '126 34 206', fgDark: '216 180 254' },
  screen: { key: 'screen', label: 'screen', dot: '140 140 140', fgLight: '115 115 115', fgDark: '166 166 166' },
}

const BY_TYPE: Record<string, string> = {
  application_log: 'log',
  caller: 'log',
  carbon: 'log',
  clear_all: 'screen',
  color: 'screen',
  create_lock: 'screen',
  eloquent_model: 'dump',
  event: 'event',
  exception: 'error',
  executed_query: 'query',
  expand: 'screen',
  hide: 'screen',
  hide_app: 'screen',
  job_event: 'event',
  json_string: 'dump',
  label: 'screen',
  mailable: 'api',
  measure: 'measure',
  new_screen: 'screen',
  notify: 'log',
  remove: 'screen',
  response: 'api',
  screen_color: 'screen',
  separator: 'screen',
  show_app: 'screen',
  size: 'screen',
  table: 'table',
  trace: 'log',
  view: 'event',
}

/** The custom helpers that send something to look at rather than to read. */
const MEDIA = new Set(['image', 'html', 'markdown', 'xml', 'file'])

export function kindFor(event: RayEvent): Kind {
  if (event.type === 'log') {
    // ray()->send() carries either a scalar or a var-dump; the design tells
    // those apart as "log" and "dump".
    const values = Array.isArray(event.content.values) ? event.content.values : []

    return values.some(isVarDump) ? KINDS.dump : KINDS.log
  }

  // Nine helpers share the `custom` type and differ only in their label, so the
  // colour has to come from the same place the renderer does.
  if (event.type === 'custom') {
    const variety = customKind(event.content.label, event.content.content)

    return MEDIA.has(variety) ? KINDS.media : KINDS.dump
  }

  return KINDS[BY_TYPE[event.type] ?? 'log'] ?? KINDS.log
}
