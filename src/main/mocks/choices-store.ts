import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { MockChoices } from '../../shared/mocks/types'

const SAVE_DEBOUNCE_MS = 200

/**
 * Which response each endpoint answers with, per developer. It lives in
 * userData rather than in the fixtures because the fixtures are committed and
 * a choice is a preference of whoever is debugging right now.
 */
export class MockChoicesStore {
  private choices: MockChoices = {}
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly file = join(app.getPath('userData'), 'mock-choices.json')) {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as unknown

      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.choices = Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        )
      }
    } catch {
      this.choices = {}
    }
  }

  all(): MockChoices {
    return this.choices
  }

  set(key: string, responseId: string): MockChoices {
    this.choices = { ...this.choices, [key]: responseId }

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)

    return this.choices
  }

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
      writeFileSync(this.file, JSON.stringify(this.choices, null, 2))
    } catch (error) {
      console.error(`Could not write ${this.file}:`, error)
    }
  }
}
