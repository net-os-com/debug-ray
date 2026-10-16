import { BOLT_PATH } from '../chrome/module-icons'
import { MODULES, type View } from '../chrome/view-nav'

/** One line in the palette. */
export type Command = {
  id: string
  label: string
  /** Where it lives, shown on the right of the row. */
  hint: string
  /** The shortcut chip, or '↵' when there is none. */
  key: string
  /** The icon path; a module's own, or the bolt an action carries. */
  icon: string
  /** The module whose tile colour the row borrows, when it is one. */
  module: Exclude<View, 'settings'> | null
  /**
   * Extra text the row can be found by without carrying it on screen — the verb
   * and path of a saved request, which is how half the team refers to it and
   * the other half does not.
   */
  search?: string
  run: () => void
}

export type CommandGroup = { label: string; items: Command[] }

/** What the palette is built from, so nothing in it reaches into the app. */
export type CommandSources = {
  onSelectView: (view: View) => void
  /** Saved Tinker snippets, by name. */
  snippets: { id: string; name: string; open: () => void }[]
  /** Saved API requests, as the collections hold them. */
  requests: {
    id: string
    name: string
    method: string
    path: string
    collection: string
    folder: string
    open: () => void
  }[]
  /** Tables on the ERD canvas. */
  tables: { name: string; open: () => void }[]
  /** What the current view's toolbar offers. */
  actions: { id: string; label: string; where: string; key?: string; run: () => void }[]
}

export function buildCommands(sources: CommandSources): CommandGroup[] {
  const modules = MODULES.map(
    (one, index): Command => ({
      id: `view:${one.key}`,
      label: one.label,
      hint: one.hint,
      key: `⌘${index + 1}`,
      icon: one.key,
      module: one.key,
      run: () => sources.onSelectView(one.key),
    }),
  )

  return [
    { label: 'Inspect', items: modules.filter((one) => one.module !== null && MODULES.find((m) => m.key === one.module)?.group === 'Inspect') },
    { label: 'Build', items: modules.filter((one) => one.module !== null && MODULES.find((m) => m.key === one.module)?.group === 'Build') },
    {
      label: 'Actions',
      items: sources.actions.map(
        (one): Command => ({
          id: `action:${one.id}`,
          label: one.label,
          hint: one.where,
          key: one.key ?? '↵',
          icon: BOLT_PATH,
          module: null,
          run: one.run,
        }),
      ),
    },
    {
      label: 'Snippets',
      items: sources.snippets.map(
        (one): Command => ({
          id: `snippet:${one.id}`,
          label: one.name,
          hint: 'Tinker',
          key: '↵',
          icon: 'tinker',
          module: 'tinker',
          run: one.open,
        }),
      ),
    },
    {
      label: 'Saved requests',
      items: sources.requests.map(
        (one): Command => ({
          id: `request:${one.id}`,
          // What you called it, rather than its verb and path: the name is
          // what the sidebar shows and what somebody asks you to open.
          label: one.name,
          // Where it is, which is the thing you know when you cannot remember
          // the name — "it is the one in Desks".
          hint: one.folder === ''
            ? `API · ${one.collection}`
            : `API · ${one.collection}/${one.folder}`,
          key: '↵',
          icon: 'api',
          module: 'api',
          search: `${one.method} ${one.path}`,
          run: one.open,
        }),
      ),
    },
    {
      label: 'Tables',
      items: sources.tables.map(
        (one): Command => ({
          id: `table:${one.name}`,
          label: one.name,
          hint: 'ERD',
          key: '↵',
          icon: 'erd',
          module: 'erd',
          run: one.open,
        }),
      ),
    },
  ]
}

/**
 * The groups that still have something in them, narrowed by what was typed.
 *
 * Matching on the label and the hint together, as the canvas does, so "tinker"
 * finds both the module and every snippet that runs in it.
 */
export function narrowCommands(groups: CommandGroup[], query: string): CommandGroup[] {
  const needle = query.trim().toLowerCase()

  return groups
    .map((group) => ({
      ...group,
      items:
        needle === ''
          ? group.items
          : group.items.filter((one) =>
              `${one.label} ${one.hint} ${one.search ?? ''}`.toLowerCase().includes(needle),
            ),
    }))
    .filter((group) => group.items.length > 0)
}

/** Every command the narrowed groups hold, in the order they are drawn. */
export function flatten(groups: CommandGroup[]): Command[] {
  return groups.flatMap((group) => group.items)
}
