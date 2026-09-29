/**
 * A small XML/HTML scanner, for showing markup as code rather than as a wall of
 * one colour.
 *
 * It is deliberately forgiving: this runs on whatever someone passed to
 * `ray()->xml()`, which is not always well formed, and a fragment that will not
 * parse should still be readable.
 */
export type MarkupToken = {
  text: string
  type: 'text' | 'punct' | 'name' | 'attr' | 'value' | 'comment' | 'meta'
}

/** `<!-- … -->`, `<![CDATA[ … ]]>`, `<?xml … ?>`, `<!DOCTYPE …>`. */
const ASIDES: [string, string, MarkupToken['type']][] = [
  ['<!--', '-->', 'comment'],
  ['<![CDATA[', ']]>', 'meta'],
  ['<?', '?>', 'meta'],
  ['<!', '>', 'meta'],
]

export function tokenizeMarkup(source: string): MarkupToken[] {
  const tokens: MarkupToken[] = []
  let index = 0

  const push = (text: string, type: MarkupToken['type']): void => {
    if (text === '') {
      return
    }

    const last = tokens[tokens.length - 1]

    if (last !== undefined && last.type === type) {
      last.text += text

      return
    }

    tokens.push({ text, type })
  }

  while (index < source.length) {
    const open = source.indexOf('<', index)

    if (open === -1) {
      push(source.slice(index), 'text')
      break
    }

    push(source.slice(index, open), 'text')

    const aside = ASIDES.find((entry) => source.startsWith(entry[0], open))

    if (aside !== undefined) {
      const close = source.indexOf(aside[1], open + aside[0].length)
      const end = close === -1 ? source.length : close + aside[1].length

      push(source.slice(open, end), aside[2])
      index = end

      continue
    }

    const close = source.indexOf('>', open)
    const end = close === -1 ? source.length : close + 1

    index = end
    scanTag(source.slice(open, end), push)
  }

  return tokens
}

/** `<name attr="value" …>` — the only place attributes can appear. */
function scanTag(tag: string, push: (text: string, type: MarkupToken['type']) => void): void {
  const opening = /^<\/?\s*([^\s/>]*)/.exec(tag)
  const nameEnd = opening === null ? 1 : opening[0].length

  push(tag.slice(0, nameEnd - (opening?.[1].length ?? 0)), 'punct')
  push(opening?.[1] ?? '', 'name')

  const rest = tag.slice(nameEnd)
  // The value is optional: `<input disabled>` is an attribute too.
  const attribute = /([^\s=/>]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s/>]+)?/g
  let at = 0
  let match: RegExpExecArray | null

  while ((match = attribute.exec(rest)) !== null) {
    if (match[0] === '') {
      attribute.lastIndex += 1

      continue
    }

    push(rest.slice(at, match.index), 'punct')
    push(match[1], 'attr')
    push(match[2] ?? '', 'punct')
    push(match[2] === undefined ? '' : match[3] ?? '', 'value')
    at = match.index + match[1].length + (match[2] ?? '').length + (match[2] === undefined ? 0 : (match[3] ?? '').length)
  }

  push(rest.slice(at), 'punct')
}
