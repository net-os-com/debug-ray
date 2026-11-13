/**
 * Something the main process asks the main window to do when it brings it
 * forward: open on one event, on one request, or on a view. The menu bar sends
 * all three — a click on a row or on the last request in its panel, and
 * "Settings…" in its menu.
 */
export type WindowIntent =
  | { kind: 'select-event'; id: string }
  | { kind: 'select-request'; id: string }
  | { kind: 'show-view'; view: 'settings' }
