/**
 * The colours from the canvas. A list of two hundred routes is unreadable if
 * every verb looks the same, and the one that deletes things should not be the
 * one you have to read twice.
 */
export function methodColor(method: string): string {
  if (method === 'GET') {
    return 'var(--sql-kw)'
  }

  if (method === 'DELETE') {
    return 'var(--err-fg)'
  }

  return method === 'PUT' ? 'var(--ok-fg)' : 'var(--sql-num)'
}

export function statusColor(status: number): string {
  return status >= 400 || status === 0 ? 'var(--err-fg)' : 'var(--ok-fg)'
}

export function statusBackground(status: number): string {
  return status >= 400 || status === 0 ? 'var(--err-bg)' : 'var(--ok-bg)'
}

/** "Rick Bongers" reads as RB in a 22-pixel circle; "rick" reads as R. */
export function initials(name: string): string {
  const capitals = name
    .split(/\s+/)
    .filter((word) => /^[A-Z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')

  return capitals !== '' ? capitals : (name.trim()[0] ?? '?').toUpperCase()
}

/** Bytes, as a size rather than as a number of bytes. */
export function size(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`
  }

  const kb = bytes / 1_024

  return kb < 1_024 ? `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB` : `${(kb / 1_024).toFixed(1)} MB`
}
