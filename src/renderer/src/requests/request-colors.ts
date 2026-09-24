/** Status and method colouring, taken from the canvas' own rules. */
export function statusColor(status: number): string {
  if (status >= 500) {
    return 'var(--err-fg)'
  }

  if (status >= 400) {
    return 'var(--warn-fg)'
  }

  if (status >= 300) {
    return 'var(--t3)'
  }

  return 'var(--ok-fg)'
}

export function statusBackground(status: number): string {
  if (status >= 500) {
    return 'var(--err-bg)'
  }

  if (status >= 400) {
    return 'var(--warn-bg)'
  }

  return 'var(--app-surface-2)'
}

export function methodColor(method: string): string {
  if (method === 'GET') {
    return 'var(--sql-kw)'
  }

  if (method === 'DELETE') {
    return 'var(--err-fg)'
  }

  return 'var(--sql-num)'
}
