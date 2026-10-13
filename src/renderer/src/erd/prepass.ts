/**
 * The pieces of real DBML that `@dbml/core` at this version cannot read: a
 * colour on a `TableGroup`, a standalone `Note name { '…' }` block, and a
 * `note:` written anywhere in a table's body other than last.
 *
 * Both are lifted out here and handed back separately, and what is left behind
 * is blanked rather than removed — every character becomes a space, and every
 * newline stays a newline. The parser then reports exactly the byte offsets and
 * line numbers the original source has, which is what the editor's patcher
 * writes against. Deleting the text instead would shift every offset after it,
 * and a column rename would land in the wrong place.
 */
export type GroupColors = Record<string, string>

/** A standalone note: a name and the text it carries. */
export type SourceNote = { name: string; text: string }

/** A table's own note, keyed by the name as the source spells it. */
export type TableNotes = Record<string, string>

export type Prepass = {
  code: string
  colors: GroupColors
  notes: SourceNote[]
  tableNotes: TableNotes
}

const GROUP_COLOR = /(TableGroup\s+[^\s[{]+\s*)(\[[^\]]*\])/g
const COLOR_VALUE = /color\s*:\s*(#[0-9A-Fa-f]{3,8}|[A-Za-z]+)/
const GROUP_NAME = /TableGroup\s+("[^"]*"|[^\s[{]+)/
const NOTE_BLOCK = /^[ \t]*Note[ \t]+("[^"]*"|[A-Za-z_][\w]*)[ \t]*\{([\s\S]*?)^[ \t]*\}[ \t]*$/gm

export function prepass(source: string): Prepass {
  const colors: GroupColors = {}
  const notes: SourceNote[] = []

  let code = source.replace(GROUP_COLOR, (whole, head: string, settings: string) => {
    const name = GROUP_NAME.exec(head)?.[1]
    const color = COLOR_VALUE.exec(settings)?.[1]

    if (name !== undefined && color !== undefined) {
      colors[unquote(name)] = color
    }

    return head + blank(settings)
  })

  code = code.replace(NOTE_BLOCK, (whole, name: string, body: string) => {
    notes.push({ name: unquote(name), text: unquoteText(body.trim()) })

    return blank(whole)
  })

  const lifted = liftTableNotes(code)

  return { code: lifted.code, colors, notes, tableNotes: lifted.tableNotes }
}

/** `Note:` or `note:` followed by a quoted string, on a line of its own. */
const TABLE_NOTE =
  /^[ \t]*[Nn]ote[ \t]*:[ \t]*('''[\s\S]*?'''|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")[ \t]*$/m

/** The head of a table block: the keyword, the name, and the opening brace. */
const TABLE_HEAD = /(^|\n)[ \t]*Table[ \t]+("[^"]*"|[^\s.[{]+)(?:[ \t]*\.[ \t]*("[^"]*"|[^\s.[{]+))?[^\n{]*\{/g

/**
 * Takes each table's own note out of its body.
 *
 * This parser accepts a `note:` only as the last thing in a table, after the
 * columns and any `indexes` block. dbdiagram.io accepts it anywhere, and
 * putting it first — right under the opening brace, where it reads as a
 * description of what follows — is the common way to write one. A document
 * doing that was rejected outright: "Expected \" \" but \":\" found", on line two,
 * with every table in the file unreadable because of it.
 *
 * So the statement is lifted out and the note carried separately. The source
 * itself is untouched — the editor saves the text you typed, not a
 * regenerated copy — so this only decides what the diagram can read, never
 * what the file says.
 */
function liftTableNotes(source: string): { code: string; tableNotes: TableNotes } {
  const tableNotes: TableNotes = {}
  let code = source
  let match: RegExpExecArray | null

  TABLE_HEAD.lastIndex = 0

  while ((match = TABLE_HEAD.exec(source)) !== null) {
    const open = match.index + match[0].length - 1
    const close = bodyEnd(source, open)

    if (close < 0) {
      continue
    }

    const body = source.slice(open + 1, close)
    const note = TABLE_NOTE.exec(body)

    if (note === null) {
      continue
    }

    const name = [match[2], match[3]]
      .filter((part): part is string => part !== undefined)
      .map(unquote)
      .join('.')

    tableNotes[name] = unquoteText((note[1] ?? '').trim())

    const start = open + 1 + note.index
    code = code.slice(0, start) + blank(note[0]) + code.slice(start + note[0].length)
  }

  return { code, tableNotes }
}

/**
 * The closing brace of a table body, counting depth: an `indexes { … }` block
 * sits inside one, so the first `}` is not the end.
 */
function bodyEnd(source: string, open: number): number {
  let depth = 0

  for (let at = open; at < source.length; at += 1) {
    const char = source[at]

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return at
      }
    }
  }

  return -1
}

/** Same length, same line breaks, no content. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ')
}

function unquote(name: string): string {
  return name.startsWith('"') ? name.slice(1, -1) : name
}

/** A note's body is a quoted string, single or triple. */
function unquoteText(body: string): string {
  const triple = /^'''([\s\S]*)'''$/.exec(body)

  if (triple !== null) {
    return triple[1]?.trim() ?? ''
  }

  const single = /^'([\s\S]*)'$/.exec(body)

  if (single !== null) {
    return (single[1] ?? '').replace(/\\'/g, "'").replace(/\\\\/g, '\\')
  }

  return body
}
