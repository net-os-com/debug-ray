export type StreamLine = {
  text: string
  stream: 'out' | 'err'
}

/** A log tail runs for hours; the pane keeps the tail, not the history. */
export const MAX_LINES = 5_000

export type LineBuffer = {
  lines: StreamLine[]
  /** The half-line a chunk ended on, waiting for the rest to arrive. */
  pending: string
}

export const EMPTY_BUFFER: LineBuffer = { lines: [], pending: '' }

/**
 * Folds a chunk into the buffer.
 *
 * Chunks arrive on whatever boundary the pipe felt like, so a line routinely
 * spans two of them. Holding the remainder back until its newline turns up is
 * the difference between a readable console and one that splits words in half.
 */
export function appendChunk(
  buffer: LineBuffer,
  chunk: string,
  stream: 'out' | 'err',
): LineBuffer {
  const combined = buffer.pending + chunk
  const parts = combined.split('\n')
  const pending = parts.pop() ?? ''

  if (parts.length === 0) {
    return { lines: buffer.lines, pending }
  }

  const added = parts.map((text) => ({ text, stream }))
  const lines = [...buffer.lines, ...added]

  return {
    lines: lines.length > MAX_LINES ? lines.slice(lines.length - MAX_LINES) : lines,
    pending,
  }
}

/** Whatever is still held back becomes a line of its own when the process ends. */
export function flush(buffer: LineBuffer, stream: 'out' | 'err'): LineBuffer {
  if (buffer.pending === '') {
    return buffer
  }

  return appendChunk(buffer, '\n', stream)
}
