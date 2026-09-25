const KEYWORDS =
  /^(use|return|new|fn|function|null|true|false|foreach|for|while|do|as|if|else|elseif|switch|case|break|continue|match|try|catch|finally|throw|echo|print|static|public|private|protected|const|class|instanceof|array|list|yield|global|and|or|xor|not)$/

/**
 * Comments, quoted strings, variables, member access, numbers, class-ish names
 * and bare words — in that order, because the first branch to match wins and a
 * comment may contain any of the rest.
 */
const SPLIT = /(\/\/.*$|#[^[].*$|'[^']*'|"[^"]*"|\$\w+|->\w+|::\w+|\b\d+\b|\b[A-Z][\w\\]*\b|\b[a-z_]+\b)/

export type PhpToken = {
  text: string
  color: string
  italic: boolean
}

/**
 * Highlights one line. Deliberately regex-shallow, like the canvas: a snippet
 * editor wants colour to read by, not a parser that has to survive every edit
 * mid-keystroke.
 */
export function tokenize(line: string): PhpToken[] {
  if (line === '') {
    return [{ text: ' ', color: 'var(--t2)', italic: false }]
  }

  return line
    .split(SPLIT)
    .filter(Boolean)
    .map((text) => ({ text, ...classify(text) }))
}

function classify(text: string): { color: string; italic: boolean } {
  if (text.startsWith('//') || text.startsWith('#')) {
    return { color: 'var(--t3)', italic: true }
  }

  if (text.startsWith("'") || text.startsWith('"')) {
    return { color: 'var(--sql-str)', italic: false }
  }

  if (text.startsWith('$')) {
    return { color: 'var(--sql-num)', italic: false }
  }

  if (text.startsWith('->') || text.startsWith('::')) {
    return { color: 'var(--t1)', italic: false }
  }

  if (/^\d+$/.test(text) || KEYWORDS.test(text) || /^[A-Z]/.test(text)) {
    return { color: /^\d+$/.test(text) ? 'var(--sql-num)' : 'var(--sql-kw)', italic: false }
  }

  return { color: 'var(--t2)', italic: false }
}
