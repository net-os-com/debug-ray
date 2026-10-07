import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ApiEnvironment } from '../../shared/api'

const SAVE_DEBOUNCE_MS = 200

/**
 * The stack this app is pointed at, out of the box.
 *
 * Tenancy here is identified by a header rather than by the domain, so the
 * tenant is a variable and the header that carries it is a default on the
 * environment — which means a request never has to remember to send it.
 */
const LOCAL: ApiEnvironment = {
  id: 'local',
  label: 'Local',
  host: 'https://api.net-os.test',
  meta: 'Docker',
  variables: [
    { key: 'tenant', value: 'net-os', secret: false },
    { key: 'token', value: '', secret: true },
  ],
  impersonate: true,
  insecure: true,
}

/**
 * Environments and their variables, beside the snippets and for the same
 * reason: the renderer's file:// origin is opaque, so localStorage does not
 * survive a launch.
 *
 * Secret variables live here and only here. Nothing in this file is ever
 * written to a collection, because a collection is meant to be committed.
 */
export class Environments {
  private list: ApiEnvironment[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly file = join(app.getPath('userData'), 'api-environments.json')) {
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as unknown

      this.list = Array.isArray(parsed) ? (parsed as ApiEnvironment[]).filter(isEnvironment) : []
    } catch {
      this.list = []
    }

    if (this.list.length === 0) {
      this.list = [LOCAL]
    }
  }

  all(): ApiEnvironment[] {
    return this.list
  }

  find(id: string): ApiEnvironment | null {
    return this.list.find((environment) => environment.id === id) ?? null
  }

  replace(list: ApiEnvironment[]): void {
    this.list = list.filter(isEnvironment)

    if (this.timer) {
      clearTimeout(this.timer)
    }

    this.timer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)
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
      writeFileSync(this.file, JSON.stringify(this.list, null, 2))
    } catch (error) {
      console.error(`Could not write ${this.file}:`, error)
    }
  }
}

function isEnvironment(value: unknown): value is ApiEnvironment {
  const candidate = value as ApiEnvironment

  return (
    typeof candidate?.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.host === 'string' &&
    Array.isArray(candidate.variables)
  )
}
