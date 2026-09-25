import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Snippet } from '../shared/tinker'

const SAVE_DEBOUNCE_MS = 200

/**
 * Snippets in their own file next to the preferences, for the same reason: the
 * renderer's file:// origin is opaque, so anything it puts in localStorage is
 * gone by the next launch.
 *
 * They are kept app-wide rather than per project — you reach for the same few
 * one-liners whichever container you point at.
 */
export class Snippets {
  private list: Snippet[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly file = join(app.getPath('userData'), 'snippets.json')) {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as unknown

      this.list = Array.isArray(parsed) ? (parsed as Snippet[]).filter(isSnippet) : []
    } catch {
      // No file yet, or it was corrupted: an empty list beats refusing to start.
      this.list = []
    }
  }

  all(): Snippet[] {
    return this.list
  }

  replace(list: Snippet[]): void {
    this.list = list.filter(isSnippet)

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)
  }

  /** Called on quit, so a snippet saved in the last moments still lands. */
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
      writeFileSync(this.file, JSON.stringify(this.list, null, 2))
    } catch (error) {
      console.error(`Could not write ${this.file}:`, error)
    }
  }
}

function isSnippet(value: unknown): value is Snippet {
  const candidate = value as Snippet

  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.code === 'string'
  )
}
