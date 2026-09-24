import type { HttpRequest } from './types'

export type TabKey = 'queries' | 'timeline' | 'route' | 'events' | 'request' | 'cache' | 'mail'

export type Tab = {
  key: TabKey
  label: string
  count: number
}

const LABELS: { key: TabKey; label: string }[] = [
  { key: 'queries', label: 'Queries' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'route', label: 'Route' },
  { key: 'events', label: 'Events' },
  { key: 'request', label: 'Request' },
  { key: 'cache', label: 'Cache' },
  { key: 'mail', label: 'Mail & jobs' },
]

export function tabsFor(request: HttpRequest): Tab[] {
  return LABELS.map(({ key, label }) => ({
    key,
    label,
    count: key === 'queries' ? request.queries.length : (request.collectorCounts[key] ?? 0),
  }))
}
