/**
 * The two pieces of the design's DBML that `@dbml/core` at this version cannot
 * read: a colour on a `TableGroup`, and a standalone `Note name { '…' }` block.
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

export type Prepass = { code: string; colors: GroupColors; notes: SourceNote[] }

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

  return { code, colors, notes }
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
