import type { ServerResponse } from 'node:http'

export function respondJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)

  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  })

  res.end(json)
}
