export type View = 'stream' | 'requests' | 'tinker' | 'api' | 'erd' | 'tools' | 'settings'

/** A module the rail and the palette both offer. */
export type Module = {
  key: Exclude<View, 'settings'>
  label: string
  /** The one line under the module's name in the header and the palette. */
  hint: string
  group: 'Inspect' | 'Build'
}

/**
 * The modules, in the order the navigation canvas puts them.
 *
 * Two groups: Inspect is watching what the application does, Build is running
 * or designing something yourself. Tools sits in Build — the canvas predates
 * it and shows five, but it is a view this application has, and reachable in
 * one click beats correct to a drawing.
 *
 * The order is also the ⌘1–6 order, so this list is the single place that
 * decides both.
 */
export const MODULES: Module[] = [
  { key: 'stream', label: 'Stream', hint: 'Live dumps and logs', group: 'Inspect' },
  { key: 'requests', label: 'Requests', hint: 'Laravel requests and queries', group: 'Inspect' },
  { key: 'tinker', label: 'Tinker', hint: 'Run PHP in the app', group: 'Build' },
  { key: 'api', label: 'API', hint: 'Send requests to the NetOS API', group: 'Build' },
  { key: 'erd', label: 'ERD', hint: 'Design the schema in DBML', group: 'Build' },
  { key: 'tools', label: 'Tools', hint: 'Artisan, logs, queues and tests', group: 'Build' },
]

export const GROUPS: Module['group'][] = ['Inspect', 'Build']

export function moduleFor(view: View): Module | null {
  return MODULES.find((one) => one.key === view) ?? null
}
