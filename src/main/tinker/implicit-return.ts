/**
 * Statements that are not expressions, so prefixing them with `return` would be
 * a syntax error rather than a convenience.
 */
const NOT_AN_EXPRESSION =
  /^(return|throw|if|elseif|else|for|foreach|while|do|switch|try|catch|finally|function|class|interface|trait|enum|abstract|final|namespace|declare|use|global|echo|print|unset|break|continue|goto)\b/

/**
 * Gives a snippet the same manners as Tinkerwell: the last expression is what
 * you get back, whether or not you wrote `return`.
 *
 * This works on top-level statements rather than on lines, because a fluent
 * chain spans several lines and only the first of them may be prefixed.
 */
export function withImplicitReturn(body: string): string {
  const last = lastStatement(body)

  if (last === null) {
    return body
  }

  const text = body.slice(last.start, last.end)
  // `return` has to land after any comment the statement opens with, or the
  // semicolon we add ends up inside that comment and the file stops parsing.
  const lead = codeStart(text)

  if (lead === -1) {
    return body
  }

  const statement = text.slice(lead).trimEnd()

  if (NOT_AN_EXPRESSION.test(statement)) {
    return body
  }

  const tail = statement.endsWith(';') ? '' : ';'

  return body.slice(0, last.start + lead) + 'return ' + statement + tail + body.slice(last.end)
}

/** Offset of the first character that is neither whitespace nor a comment. */
function codeStart(text: string): number {
  let index = 0

  while (index < text.length) {
    const char = text[index] as string
    const next = text[index + 1] ?? ''

    if (/\s/.test(char)) {
      index++

      continue
    }

    if ((char === '/' && next === '/') || (char === '#' && next !== '[')) {
      const line = text.indexOf('\n', index)

      if (line === -1) {
        return -1
      }

      index = line + 1

      continue
    }

    if (char === '/' && next === '*') {
      const close = text.indexOf('*/', index + 2)

      if (close === -1) {
        return -1
      }

      index = close + 2

      continue
    }

    return index
  }

  return -1
}

type Span = { start: number; end: number }

/**
 * Finds the last top-level statement, skipping over anything a `;` can hide
 * inside: strings, comments, heredocs, and every kind of bracket.
 */
function lastStatement(code: string): Span | null {
  const ends: number[] = []
  let depth = 0
  let index = 0

  while (index < code.length) {
    const char = code[index] as string
    const next = code[index + 1] ?? ''

    if (char === '/' && next === '/') {
      index = skipTo(code, index, '\n')

      continue
    }

    if (char === '#' && next !== '[') {
      index = skipTo(code, index, '\n')

      continue
    }

    if (char === '/' && next === '*') {
      const close = code.indexOf('*/', index + 2)
      index = close === -1 ? code.length : close + 2

      continue
    }

    if (char === "'" || char === '"') {
      index = skipString(code, index, char)

      continue
    }

    if (char === '<' && code.startsWith('<<<', index)) {
      index = skipHeredoc(code, index)

      continue
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++
    } else if (char === ')' || char === ']' || char === '}') {
      depth--
    } else if (char === ';' && depth <= 0) {
      ends.push(index + 1)
    }

    index++
  }

  const trailing = code.slice(ends[ends.length - 1] ?? 0)

  // Code after the last `;` is an unterminated final statement, which is worth
  // returning too — people leave the semicolon off the last line all the time.
  if (trailing.trim() !== '') {
    return { start: ends[ends.length - 1] ?? 0, end: code.length }
  }

  if (ends.length === 0) {
    return null
  }

  return { start: ends[ends.length - 2] ?? 0, end: ends[ends.length - 1] as number }
}

function skipTo(code: string, index: number, needle: string): number {
  const found = code.indexOf(needle, index)

  return found === -1 ? code.length : found + 1
}

function skipString(code: string, index: number, quote: string): number {
  let cursor = index + 1

  while (cursor < code.length) {
    if (code[cursor] === '\\') {
      cursor += 2

      continue
    }

    if (code[cursor] === quote) {
      return cursor + 1
    }

    cursor++
  }

  return code.length
}

function skipHeredoc(code: string, index: number): number {
  const opener = /^<<<[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/.exec(code.slice(index))

  if (opener === null) {
    return index + 3
  }

  const label = opener[2] as string
  const body = code.slice(index + opener[0].length)
  const closer = new RegExp(`^[ \\t]*${label}\\b`, 'm').exec(body)

  return closer === null ? code.length : index + opener[0].length + closer.index + closer[0].length
}
