const KEYWORDS =
  /^(select|from|where|and|or|limit|order|by|asc|desc|insert|into|values|update|set|delete|group|count|exists|as|in|is|null|not|join|left|inner|on)$/i

/** Backticked identifiers, quoted strings, numbers, whitespace, punctuation. */
const SPLIT = /(`[^`]*`|'[^']*'|\b\d+\b|\s+|[(),=<>*]|\?)/

export type SqlToken = {
  text: string
  color: string
  bold: boolean
}

/** Substitutes bindings in order, leaving a `?` where one is missing. */
export function fillBindings(sql: string, bindings: string[]): string {
  let index = 0

  return sql.replace(/\?/g, () => bindings[index++] ?? '?')
}

export function tokenize(sql: string, bindings: string[], withBindings: boolean): SqlToken[] {
  const source = withBindings ? fillBindings(sql, bindings) : sql

  return source
    .split(SPLIT)
    .filter(Boolean)
    .map((text) => ({ text, ...classify(text) }))
}

function classify(text: string): { color: string; bold: boolean } {
  if (KEYWORDS.test(text)) {
    return { color: 'var(--sql-kw)', bold: true }
  }

  if (text.startsWith("'")) {
    return { color: 'var(--sql-str)', bold: false }
  }

  if (/^\d+$/.test(text)) {
    return { color: 'var(--sql-num)', bold: false }
  }

  if (text === '?') {
    return { color: 'var(--sql-num)', bold: true }
  }

  if (text.startsWith('`')) {
    return { color: 'var(--t1)', bold: false }
  }

  return { color: 'var(--t2)', bold: false }
}

/** The first table named by the statement, for the N+1 message. */
export function tableOf(sql: string): string | null {
  return /(?:from|into|update|join)\s+`?([a-z0-9_]+)`?/i.exec(sql)?.[1] ?? null
}
