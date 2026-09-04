import type { RayEvent } from '../../shared/ray-event'
import type { FilterOption } from './chrome/filter-group'
import { ALL, sourceOf } from './filter-events'
import { KINDS, kindFor } from './kind'
import { rayColor } from './ray-color'

const NEUTRAL = 'var(--t3)'

export function buildSourceOptions(events: RayEvent[]): FilterOption[] {
  const counts = new Map<string, number>()

  for (const event of events) {
    const source = sourceOf(event)

    counts.set(source, (counts.get(source) ?? 0) + 1)
  }

  return [
    { key: ALL, label: 'All sources', dot: NEUTRAL, count: events.length },
    ...[...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, count]) => ({
        key: source,
        label: source,
        dot: 'rgb(var(--color-brand-primary-400))',
        count,
      })),
  ]
}

export function buildKindOptions(events: RayEvent[]): FilterOption[] {
  const counts = new Map<string, number>()

  for (const event of events) {
    const key = kindFor(event).key

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [
    { key: ALL, label: 'All types', dot: NEUTRAL, count: events.length },
    ...Object.values(KINDS).map((kind) => ({
      key: kind.key,
      label: kind.label,
      dot: `rgb(${kind.dot})`,
      count: counts.get(kind.key) ?? 0,
    })),
  ]
}

export function buildLabelOptions(
  events: RayEvent[],
  labels: Record<string, string>,
  colors: Record<string, string>,
): FilterOption[] {
  const counts = new Map<string, number>()
  const dots = new Map<string, string>()

  for (const event of events) {
    const label = labels[event.uuid]

    if (!label) {
      continue
    }

    counts.set(label, (counts.get(label) ?? 0) + 1)
    dots.set(label, rayColor(colors[event.uuid]) ?? 'rgb(var(--color-brand-primary-400))')
  }

  return [
    { key: ALL, label: 'all', dot: NEUTRAL, count: events.length },
    ...[...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({
        key: label,
        label,
        dot: dots.get(label) ?? NEUTRAL,
        count,
      })),
  ]
}
