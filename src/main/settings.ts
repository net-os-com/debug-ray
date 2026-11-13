import type { Preferences } from './preferences'

/**
 * The slice of the renderer's settings that the main process acts on.
 *
 * Deliberately a subset: main does not need to know about autoscroll or theme,
 * and listing only what it uses keeps the two sides from quietly coupling.
 */
export type MainSettings = {
  ignoredSources: string[]
  editor: string
  remotePath: string
  localPath: string
  launchAtLogin: boolean
  closeToBackground: boolean
  notificationSound: boolean
  notificationCoalesceMs: number
  /** Whether the menu bar icon is up. On unless switched off. */
  showMenuBarIcon: boolean
  /** How many stream events the window keeps; the main log keeps as many. */
  eventBuffer: number
  /**
   * Whether collected requests are kept at all. Off, they are dropped as they
   * arrive — in main, so they never reach the log, a window or an MCP client.
   */
  collectRequests: boolean
  /** How many requests the Requests view keeps; the main log keeps as many. */
  requestBuffer: number
}

const FALLBACK: MainSettings = {
  ignoredSources: [],
  editor: 'none',
  remotePath: '',
  localPath: '',
  launchAtLogin: false,
  closeToBackground: false,
  notificationSound: true,
  notificationCoalesceMs: 3_000,
  showMenuBarIcon: true,
  eventBuffer: 500,
  collectRequests: true,
  requestBuffer: 100,
}

/**
 * The renderer owns the settings and writes them through to the preferences
 * file, so main reads the same store rather than keeping a copy in step over
 * IPC. Read on each use: a setting changed in the window takes effect without
 * a restart.
 */
export function readSettings(preferences: Preferences): MainSettings {
  const stored = preferences.all().settings

  if (typeof stored !== 'object' || stored === null) {
    return FALLBACK
  }

  const settings = stored as Partial<MainSettings>

  return {
    ignoredSources: Array.isArray(settings.ignoredSources)
      ? settings.ignoredSources.filter((entry): entry is string => typeof entry === 'string')
      : FALLBACK.ignoredSources,
    editor: typeof settings.editor === 'string' ? settings.editor : FALLBACK.editor,
    remotePath: typeof settings.remotePath === 'string' ? settings.remotePath : FALLBACK.remotePath,
    localPath: typeof settings.localPath === 'string' ? settings.localPath : FALLBACK.localPath,
    launchAtLogin: settings.launchAtLogin === true,
    closeToBackground: settings.closeToBackground === true,
    notificationSound: settings.notificationSound !== false,
    notificationCoalesceMs:
      typeof settings.notificationCoalesceMs === 'number' && settings.notificationCoalesceMs >= 0
        ? settings.notificationCoalesceMs
        : FALLBACK.notificationCoalesceMs,
    // On by default, so only an explicit false takes it down: a settings file
    // from before this setting existed has no key for it at all.
    showMenuBarIcon: settings.showMenuBarIcon !== false,
    eventBuffer: buffer(settings.eventBuffer, FALLBACK.eventBuffer),
    // On by default, like the window's own default.
    collectRequests: settings.collectRequests !== false,
    requestBuffer: buffer(settings.requestBuffer, FALLBACK.requestBuffer),
  }
}

/** A buffer size is a whole number of at least one; anything else falls back. */
function buffer(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback
}
