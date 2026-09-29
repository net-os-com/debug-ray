import type { AppRoute } from '../../shared/tools'
import { runDocker } from '../exec/run-docker'

const ROUTES_TIMEOUT_MS = 60_000

/** Every route, every middleware: worth asking for once per container. */
const cache = new Map<string, AppRoute[]>()

type RawRoute = {
  domain?: string | null
  method?: string
  uri?: string
  name?: string | null
  action?: string
  middleware?: string[]
}

/**
 * The routing table as the framework has it.
 *
 * `route:list --json` is the same source the command prints from, so there is
 * nothing to gain by reading the route files: this reflects whatever is
 * actually registered, packages included.
 */
export async function appRoutes(containerId: string, workingDir: string): Promise<AppRoute[]> {
  const cached = cache.get(containerId)

  if (cached !== undefined) {
    return cached
  }

  const result = await runDocker(
    [
      'exec',
      '-i',
      '-w',
      workingDir || '/var/www/html',
      containerId,
      'php',
      'artisan',
      'route:list',
      '--json',
      '--no-ansi',
    ],
    null,
    ROUTES_TIMEOUT_MS,
  )

  const start = result.stdout.indexOf('[')

  if (start === -1) {
    return []
  }

  try {
    const routes = (JSON.parse(result.stdout.slice(start)) as RawRoute[]).map(shape)

    cache.set(containerId, routes)

    return routes
  } catch {
    return []
  }
}

export function forgetRoutes(): void {
  cache.clear()
}

function shape(route: RawRoute): AppRoute {
  const action = route.action ?? ''

  return {
    methods: (route.method ?? '').split('|').filter((method) => method !== 'HEAD'),
    uri: route.uri ?? '',
    name: route.name ?? '',
    action,
    // `App\Http\Controllers\Thing\ThingController@index` is one useful word
    // wrapped in a namespace that is the same for every row.
    controller: action.includes('@') ? (action.split('\\').pop() ?? action) : action,
    middleware: route.middleware ?? [],
    domain: route.domain ?? '',
  }
}
