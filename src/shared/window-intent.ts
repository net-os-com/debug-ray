/**
 * Something the main process asks the main window to do when it brings it
 * forward: open on one event, or on a view. The menu bar sends both — a click
 * on a row in its panel, and "Settings…" in its menu.
 */
export type WindowIntent =
  | { kind: 'select-event'; id: string }
  | { kind: 'show-view'; view: 'settings' }
