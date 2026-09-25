import type {
  TinkerContainer,
  TinkerError,
  TinkerOutcome,
  TinkerRequest,
  ValueNode,
} from '../../shared/tinker'
import { listContainers } from './containers'
import { buildProgram, RESULT_MARKER } from './php-program'
import { DockerMissing, runDocker } from './run-docker'

/** Long enough for a slow query, short enough that a runaway loop frees the app. */
const RUN_TIMEOUT_MS = 30_000

/** `Parse error: … in Standard input code on line 42` */
const PARSE_ERROR = /(?:Parse|Fatal) error:\s*(.+?) in .*? on line (\d+)/

/**
 * Runs a snippet inside a container and reports what came back.
 *
 * Every path returns an outcome rather than throwing: a stopped container, a
 * missing docker and a syntax error are all things the output pane should
 * explain, not crashes.
 */
export class Tinker {
  /** Listing tenants costs a full framework boot, so it is kept per container. */
  private readonly tenantCache = new Map<string, string[]>()

  containers(): Promise<TinkerContainer[]> {
    return listContainers()
  }

  async tenants(containerId: string, workingDir: string): Promise<string[]> {
    const cached = this.tenantCache.get(containerId)

    if (cached !== undefined) {
      return cached
    }

    const outcome = await this.run({
      containerId,
      workingDir,
      tenant: '',
      code: TENANT_SNIPPET,
    })

    const tenants =
      outcome.kind === 'value' && outcome.value.t === 'arr'
        ? outcome.value.kids
            .map(([, node]) => (node.t === 'str' ? node.v : null))
            .filter((key): key is string => key !== null)
        : []

    this.tenantCache.set(containerId, tenants)

    return tenants
  }

  forgetTenants(): void {
    this.tenantCache.clear()
  }

  async run(request: TinkerRequest): Promise<TinkerOutcome> {
    const at = Date.now()
    const program = buildProgram(request.workingDir || '/var/www/html', request.tenant, request.code)

    let result

    try {
      result = await runDocker(
        ['exec', '-i', '-w', request.workingDir || '/var/www/html', request.containerId, 'php'],
        program.source,
        RUN_TIMEOUT_MS,
      )
    } catch (error) {
      return {
        kind: 'unavailable',
        at,
        message:
          error instanceof DockerMissing
            ? 'Docker was not found on this machine. Tinker runs your code with docker exec.'
            : `Could not reach Docker: ${(error as Error).message}`,
      }
    }

    if (result.timedOut) {
      return {
        kind: 'unavailable',
        at,
        message: `The snippet ran longer than ${RUN_TIMEOUT_MS / 1000} seconds and was stopped. Whatever it started inside the container keeps going.`,
      }
    }

    const lines = result.stdout.split('\n')
    const marked = [...lines].reverse().find((line) => line.startsWith(RESULT_MARKER))

    if (marked !== undefined) {
      const stray = lines.filter((line) => !line.startsWith(RESULT_MARKER)).join('\n').trim()

      return this.fromPayload(
        marked.slice(RESULT_MARKER.length),
        at,
        program.bodyOffset,
        cap(inSnippetLines(stray, program.bodyOffset)),
      )
    }

    // No payload: the program never reached its own last line. A syntax error
    // is the common cause, and it is reported against the generated file.
    const combined = `${result.stdout}\n${result.stderr}`
    const parse = PARSE_ERROR.exec(combined)

    if (parse !== null) {
      return {
        kind: 'throwable',
        at,
        durationMs: 0,
        output: '',
        error: {
          cls: 'ParseError',
          message: parse[1] ?? 'Syntax error',
          file: null,
          line: Math.max(1, Number(parse[2]) - program.bodyOffset),
          frames: [],
        },
      }
    }

    return {
      kind: 'unavailable',
      at,
      message: firstUseful(combined) || 'The container produced no output.',
    }
  }

  /** Rewrites lines in the generated program back to lines in the snippet. */
  private inSnippet(error: TinkerError, bodyOffset: number): TinkerError {
    const own = (file: string | null): boolean => file === null || STDIN_FILE.test(file)

    return {
      ...error,
      file: own(error.file) ? null : error.file,
      line: own(error.file) && error.line !== null ? Math.max(1, error.line - bodyOffset) : error.line,
      frames: error.frames.map((frame) =>
        own(frame.file) ? { ...frame, file: '', line: Math.max(1, frame.line - bodyOffset) } : frame,
      ),
    }
  }

  private fromPayload(
    json: string,
    at: number,
    bodyOffset: number,
    stray: string,
  ): TinkerOutcome {
    try {
      const payload = JSON.parse(json) as Record<string, unknown>

      if (payload.kind === 'throwable') {
        return {
          kind: 'throwable',
          at,
          error: this.inSnippet(payload.error as TinkerError, bodyOffset),
          output: joined(payload.output as string, stray),
          durationMs: (payload.durationMs as number) ?? 0,
        }
      }

      return {
        kind: 'value',
        at,
        value: payload.value as ValueNode,
        output: joined(payload.output as string, stray),
        durationMs: (payload.durationMs as number) ?? 0,
        memoryMb: (payload.memoryMb as number) ?? null,
      }
    } catch {
      return { kind: 'unavailable', at, message: 'The result could not be read.' }
    }
  }
}

/**
 * PHP names a program fed over stdin "Standard input code", which is how a
 * throwable raised by the snippet itself is told apart from one raised deep in
 * the framework. Only the former carries a line worth showing.
 */
const STDIN_FILE = /standard input code/i

/** Generic on purpose: it asks the application which model holds its tenants. */
const TENANT_SNIPPET = `$model = config('tenancy.tenant_model');

if (!is_string($model) || !class_exists($model)) {
    return [];
}

return $model::query()->get()->map(fn ($tenant) => (string) $tenant->getTenantKey())->values()->all();`

/**
 * Laravel's dump() signs each dump with where it came from, which for a program
 * fed over stdin reads "Standard input code:140" — a line in the file we built,
 * not in the snippet. Same arithmetic as a throwable's line.
 */
function inSnippetLines(text: string, bodyOffset: number): string {
  return text.replace(
    /Standard input code:(\d+)/g,
    (_match, line: string) => `snippet:${Math.max(1, Number(line) - bodyOffset)}`,
  )
}

/** Anything written past the buffer, such as a direct fwrite to STDOUT, is kept too. */
function joined(buffered: string | undefined, stray: string): string {
  return [(buffered ?? '').trimEnd(), stray].filter((part) => part !== '').join('\n')
}

/** The renderer has to hold this string; a runaway loop should not fill it. */
const MAX_OUTPUT_BYTES = 64 * 1024

function cap(text: string): string {
  return text.length <= MAX_OUTPUT_BYTES
    ? text
    : `${text.slice(0, MAX_OUTPUT_BYTES)}\n… output truncated`
}

function firstUseful(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '' && !line.startsWith('PHP Warning') && !line.startsWith('PHP Deprecated')) ?? ''
  )
}
