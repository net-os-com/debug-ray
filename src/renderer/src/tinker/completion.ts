export type Token = {
  start: number
  /** End of the whole identifier, which may run past the caret. */
  end: number
  /** What was typed up to the caret; the part the search matches on. */
  text: string
}

/** A `use X;` already at the top of the snippet. */
type Import = {
  fqcn: string
  short: string
}

const IDENTIFIER = /[A-Za-z0-9_\\]/

/**
 * The class-ish identifier under the caret, or null when this is not a place a
 * class name belongs.
 *
 * Kept deliberately shallow: an editor suggests while you are mid-keystroke, so
 * the code it looks at is usually not valid PHP yet and a parser would spend
 * most of its life failing.
 */
export function classToken(code: string, caret: number): Token | null {
  let start = caret

  while (start > 0 && IDENTIFIER.test(code[start - 1] as string)) {
    start--
  }

  let end = caret

  // Accepting replaces the whole identifier, not just the half before the
  // caret, so fixing a typo mid-word does not leave its tail behind.
  while (end < code.length && IDENTIFIER.test(code[end] as string)) {
    end++
  }

  const text = code.slice(start, caret)

  // A class name starts with a capital. Anything else is a variable, a method
  // or a keyword, and guessing there produces noise.
  if (text === '' || !/^[A-Z]/.test(text)) {
    return null
  }

  const before = code.slice(Math.max(0, start - 2), start)

  if (before.endsWith('$') || before === '->' || before === '::') {
    return null
  }

  if (inLiteral(code, start)) {
    return null
  }

  return { start, end, text }
}

/**
 * Accepts a suggestion: the short name replaces what you typed and the import
 * is written into the snippet, so it stays PHP you could paste anywhere.
 */
export function applyCompletion(
  code: string,
  token: Token,
  fqcn: string,
): { code: string; caret: number } {
  const short = fqcn.slice(fqcn.lastIndexOf('\\') + 1)
  const replaced = code.slice(0, token.start) + short + code.slice(token.end)
  const caret = token.start + short.length

  const imports = existingImports(code)

  if (imports.some((entry) => entry.fqcn === fqcn)) {
    return { code: replaced, caret }
  }

  // Another class already owns this short name here. Importing a second one
  // would not compile, and quietly leaving theirs in place would hand you a
  // class you did not pick — so the fully qualified name goes in instead.
  if (imports.some((entry) => entry.short === short)) {
    const qualified = `\\${fqcn}`

    return {
      code: code.slice(0, token.start) + qualified + code.slice(token.end),
      caret: token.start + qualified.length,
    }
  }

  const line = `use ${fqcn};`
  const lines = replaced.split('\n')
  const lastImport = lastImportLine(lines)

  if (lastImport === -1) {
    const opening = [line, '']

    return {
      code: [...opening, ...lines].join('\n'),
      caret: caret + opening.join('\n').length + 1,
    }
  }

  lines.splice(lastImport + 1, 0, line)

  const inserted = line.length + 1
  const before = lines.slice(0, lastImport + 1).join('\n').length

  return { code: lines.join('\n'), caret: caret >= before ? caret + inserted : caret }
}

const USE_LINE = /^\s*use\s+([^();]+);\s*$/

function existingImports(code: string): Import[] {
  const imports: Import[] = []

  for (const line of code.split('\n')) {
    const match = USE_LINE.exec(line)

    if (match === null) {
      continue
    }

    const fqcn = (match[1] as string).trim()

    imports.push({ fqcn, short: fqcn.slice(fqcn.lastIndexOf('\\') + 1) })
  }

  return imports
}

function lastImportLine(lines: string[]): number {
  let last = -1

  for (let index = 0; index < lines.length; index++) {
    if (USE_LINE.test(lines[index] as string)) {
      last = index
    }
  }

  return last
}

/** Counts unescaped quotes on the line; enough to keep suggestions out of strings. */
function inLiteral(code: string, position: number): boolean {
  const lineStart = code.lastIndexOf('\n', position - 1) + 1
  const line = code.slice(lineStart, position)

  const comment = line.indexOf('//')

  if (comment !== -1) {
    return true
  }

  let single = 0
  let double = 0

  for (let index = 0; index < line.length; index++) {
    if (line[index] === '\\') {
      index++

      continue
    }

    if (line[index] === "'") {
      single++
    }

    if (line[index] === '"') {
      double++
    }
  }

  return single % 2 === 1 || double % 2 === 1
}
