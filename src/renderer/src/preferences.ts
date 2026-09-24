/**
 * Read once at start-up; the main process owns the file. Writes are fire and
 * forget, debounced on the other side.
 */
const snapshot = window.ray.readPreferences()

export function readPreference<T>(key: string, fallback: T): T {
  const value = snapshot[key]

  return value === undefined ? fallback : (value as T)
}

export function writePreference(key: string, value: unknown): void {
  snapshot[key] = value
  window.ray.writePreferences({ [key]: value })
}
