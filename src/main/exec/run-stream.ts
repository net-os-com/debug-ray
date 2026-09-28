import { spawn, type ChildProcess } from 'node:child_process'
import type { BrowserWindow } from 'electron'
import { dockerPath } from './docker-path'

/**
 * Symfony's console and Pail size their output to the terminal, and with no
 * terminal at all they assume eighty columns and wrap boxes in the middle of a
 * sentence. Telling them the pane's width is the only way the output lines up.
 */
const DEFAULT_COLUMNS = 160

export type StreamStart = {
  id: string
  /** Arguments after `docker`, so the caller decides between exec, logs, anything. */
  args: string[]
  columns?: number
}

/**
 * Long-running commands, reported as they speak.
 *
 * `runDocker` waits for a process to finish, which is right for a snippet and
 * useless for a log tail or a migration: you want the first line before the
 * last one exists. Everything here is therefore push — the renderer is handed
 * chunks and an exit code, never a promise of the whole output.
 */
/**
 * `docker exec` starts a process in another machine's environment, so setting
 * COLUMNS on the docker client does nothing at all — it has to be handed over
 * explicitly. Done here rather than at each call site because every caller
 * wants it and forgetting it is invisible until the output looks wrong.
 */
function withColumns(args: string[], columns: number): string[] {
  if (args[0] !== 'exec') {
    return args
  }

  return ['exec', '-e', `COLUMNS=${columns}`, ...args.slice(1)]
}

export class Streams {
  private readonly running = new Map<string, ChildProcess>()

  constructor(private readonly window: () => BrowserWindow | null) {}

  start({ id, args, columns }: StreamStart): { ok: boolean; message?: string } {
    if (this.running.has(id)) {
      return { ok: false, message: 'That stream is already running.' }
    }

    const docker = dockerPath()

    if (docker === null) {
      return { ok: false, message: 'Docker was not found on this machine.' }
    }

    const child = spawn(docker, withColumns(args, columns ?? DEFAULT_COLUMNS), {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.running.set(id, child)

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => this.send(id, chunk, 'out'))
    child.stderr?.on('data', (chunk: string) => this.send(id, chunk, 'err'))

    child.on('error', (error: Error) => {
      this.send(id, `${error.message}\n`, 'err')
      this.finish(id, null)
    })

    child.on('close', (code) => this.finish(id, code))

    return { ok: true }
  }

  /**
   * Killing the local process does not stop what the container is doing —
   * docker exec has no remote cancel — so this frees the app, not the work.
   */
  stop(id: string): void {
    this.running.get(id)?.kill('SIGKILL')
  }

  /** Nothing should outlive the window that asked for it. */
  stopAll(): void {
    for (const id of [...this.running.keys()]) {
      this.stop(id)
    }
  }

  private send(id: string, chunk: string, stream: 'out' | 'err'): void {
    this.window()?.webContents.send('exec:data', { id, chunk, stream })
  }

  private finish(id: string, code: number | null): void {
    if (!this.running.delete(id)) {
      return
    }

    this.window()?.webContents.send('exec:end', { id, code })
  }
}
