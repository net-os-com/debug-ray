/** One value in a returned result, shaped the way the output tree renders it. */
export type ValueNode =
  | { t: 'null' }
  | { t: 'bool'; v: boolean }
  | { t: 'num'; v: number }
  | { t: 'str'; v: string; cut?: boolean }
  | { t: 'arr'; kids: [string, ValueNode][]; more?: number }
  | { t: 'obj'; cls: string; id: string; kids: [string, ValueNode][]; more?: number }
  /** A value already shown higher up; printed as a reference rather than repeated. */
  | { t: 'ref'; cls: string; id: string }

export type TinkerFrame = {
  file: string
  line: number
  call: string
}

export type TinkerError = {
  cls: string
  message: string
  file: string | null
  line: number | null
  frames: TinkerFrame[]
}

/** A container the code can run in. */
export type TinkerContainer = {
  id: string
  name: string
  image: string
  status: string
  workingDir: string
  running: boolean
}

/**
 * Three outcomes worth telling apart: the code returned something, the code
 * threw, or it never ran at all — a stopped container and a failing query are
 * not the same problem.
 */
export type TinkerOutcome =
  | {
      kind: 'value'
      value: ValueNode
      output: string
      durationMs: number
      memoryMb: number | null
      at: number
    }
  | {
      kind: 'throwable'
      error: TinkerError
      output: string
      durationMs: number
      at: number
    }
  | { kind: 'unavailable'; message: string; at: number }

export type TinkerRequest = {
  containerId: string
  workingDir: string
  /** Empty runs against the central connection. */
  tenant: string
  code: string
}

/** A saved snippet. The draft you are typing lives in the renderer until saved. */
export type Snippet = {
  id: string
  name: string
  code: string
  updatedAt: number
}
