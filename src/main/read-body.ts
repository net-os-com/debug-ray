import type { IncomingMessage } from 'node:http'

const MAX_BODY_BYTES = 64 * 1024 * 1024

/** Buffers a request body; ray dumps of large objects run into the megabytes. */
export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length

      if (size > MAX_BODY_BYTES) {
        reject(new Error(`Request body exceeded ${MAX_BODY_BYTES} bytes`))
        req.destroy()

        return
      }

      chunks.push(chunk)
    })

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
