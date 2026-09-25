import type { HttpRequest } from './types'

export type TabKey =
  | 'queries'
  | 'timeline'
  | 'route'
  | 'events'
  | 'request'
  | 'cache'
  | 'mail'
  | 'jobs'

export type Tab = {
  key: TabKey
  label: string
  /** null where there is nothing countable, so no badge is drawn. */
  count: number | null
}

/**
 * The collector key each tab counts. Debugbar names several of them differently
 * from the tab they feed — mail arrives as `symfonymailer_mails`, events as the
 * singular `event` — and Route and Request are single objects with nothing to
 * count. Those two carry no badge.
 */
const TABS: { key: TabKey; label: string; collector: string | null }[] = [
  { key: 'queries', label: 'Queries', collector: 'queries' },
  // No badge, per the canvas: a span count says nothing useful about a request.
  { key: 'timeline', label: 'Timeline', collector: null },
  { key: 'route', label: 'Route', collector: null },
  { key: 'events', label: 'Events', collector: 'event' },
  { key: 'request', label: 'Request', collector: null },
  { key: 'cache', label: 'Cache', collector: 'cache' },
  { key: 'mail', label: 'Mail', collector: 'symfonymailer_mails' },
  { key: 'jobs', label: 'Jobs', collector: 'jobs' },
]

export function tabsFor(request: HttpRequest): Tab[] {
  return TABS.map(({ key, label, collector }) => ({
    key,
    label,
    count:
      key === 'queries'
        ? request.queries.length
        : collector === null
          ? null
          : (request.collectorCounts[collector] ?? 0),
  }))
}
