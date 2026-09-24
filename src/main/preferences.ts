import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SAVE_DEBOUNCE_MS = 200

/**
 * The renderer loads over file://, which Chromium treats as an opaque origin —
 * localStorage there is wiped on every restart. Preferences therefore live in
 * the user data directory, where they belong for a desktop app.
 */
export class Preferences {
  private values: Record<string, unknown> = {}
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly file = join(app.getPath('userData'), 'preferences.json')) {
    try {
      this.values = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, unknown>
    } catch {
      // No file yet, or it was corrupted: start from defaults rather than fail.
      this.values = {}
    }
  }

  all(): Record<string, unknown> {
    return this.values
  }

  merge(patch: Record<string, unknown>): void {
    this.values = { ...this.values, ...patch }

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)
  }

  /** Called on quit so a change made in the last moments is not lost. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
      this.save()
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.values, null, 2))
    } catch (error) {
      console.error(`Could not write ${this.file}:`, error)
    }
  }
}
