import type { EditorToken } from '../ui/code-editor'

const KEYWORDS =
  /^(Table|Ref|Enum|Indexes|indexes|Note|note|TableGroup|Project|as|pk|unique|increment|not|null|default|delete|update|cascade|restrict|headercolor)$/

/** Comments, quoted strings, numbers, then bare words. */
const SPLIT = /(\/\/.*$|'[^']*'|"[^"]*"|`[^`]*`|\b\d+\b|\b[A-Za-z_][\w]*\b)/

/**
 * Highlights one line. Deliberately regex-shallow, like the PHP one: an editor
 * wants colour to read by, not a parser that has to survive every edit
 * mid-keystroke — and this source is unparseable for most of the time you are
 * typing in it.
 */
export function tokenizeDbml(line: string): EditorToken[] {
  return line
    .split(SPLIT)
    .filter((piece): piece is string => piece !== undefined && piece !== '')
    .map((text) => ({ text, color: colorOf(text), italic: text.startsWith('//') }))
}

function colorOf(text: string): string {
  if (text.startsWith('//')) {
    return 'var(--t3)'
  }

  if (text.startsWith("'") || text.startsWith('"') || text.startsWith('`')) {
    return 'var(--sql-str)'
  }

  if (/^\d+$/.test(text)) {
    return 'var(--sql-num)'
  }

  return KEYWORDS.test(text) ? 'var(--sql-kw)' : 'var(--t1)'
}
