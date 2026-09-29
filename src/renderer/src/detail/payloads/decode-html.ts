/**
 * Undoes the encoding Ray's PHP side applies before it sends text.
 *
 * `xml()`, `file()` and `text()` all run their content through htmlentities and
 * then swap newlines for `<br>` and spaces for `&nbsp;`, because Ray's own app
 * drops the result straight into the DOM. Rendering that as HTML technically
 * works and gives you a paragraph where you asked for a file: no line numbers,
 * no columns, nothing selectable as the text it started out as.
 *
 * So it is decoded back to the characters that were sent, and displayed as
 * text.
 */

/** Everything htmlspecialchars produces, plus the two htmlentities adds here. */
const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeEntities(value: string): string {
  // The renderer has a parser that knows every named entity there is; the
  // table above is for the tests, which run without a DOM.
  const parser = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser

  if (parser !== undefined) {
    return new parser().parseFromString(value, 'text/html').documentElement.textContent ?? ''
  }

  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)

      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }

    return NAMED[body.toLowerCase()] ?? whole
  })
}

/**
 * The full round trip: line breaks first, so a `<br>` inside the text survives
 * as a line break rather than as the four characters that spell one.
 */
export function decodeSent(value: string): string {
  return decodeEntities(value.replace(/<br\s*\/?>/gi, '\n')).replace(/ /g, ' ')
}

/** Whether a string is markup rather than the text it was made from. */
export function looksLikeHtml(value: string): boolean {
  return /<[a-z!/][\s\S]*>/i.test(value)
}
