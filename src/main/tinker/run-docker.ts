import { spawn } from 'node:child_process'
import { dockerPath } from './docker-path'

export type DockerRun = {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export class DockerMissing extends Error {}

/**
 * Runs one docker command, optionally feeding it something on stdin.
 *
 * Killing this process does not kill what the container is already running —
 * docker exec has no remote cancel — so a timeout frees the app, not the
 * database.
 */
export function runDocker(args: string[], input: string | null, timeoutMs: number): Promise<DockerRun> {
  const docker = dockerPath()

  if (docker === null) {
    return Promise.reject(new DockerMissing('Docker was not found on this machine.'))
  }

  return new Promise((resolve, reject) => {
    const child = spawn(docker, args, { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => (stdout += chunk))
    child.stderr.on('data', (chunk: string) => (stderr += chunk))

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })

    if (input !== null) {
      child.stdin.end(input)
    } else {
      child.stdin.end()
    }
  })
}
