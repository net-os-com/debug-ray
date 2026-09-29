/**
 * Which helper sent a `custom` payload.
 *
 * Ray flattens image(), html(), markdown(), xml(), file(), text(), json(),
 * bool() and null() into one payload type and tells them apart only by the
 * label it attaches. Without reading that label they all arrive as "a string of
 * HTML" and get the same generic treatment — an image and a stack trace
 * rendered by the same code path.
 */
export type CustomKind =
  | 'image'
  | 'html'
  | 'markdown'
  | 'xml'
  | 'file'
  | 'text'
  | 'json'
  | 'bool'
  | 'null'
  | 'plain'

const BY_LABEL: Record<string, CustomKind> = {
  image: 'image',
  html: 'html',
  markdown: 'markdown',
  xml: 'xml',
  text: 'text',
  boolean: 'bool',
  null: 'null',
}

/** file() labels the payload with the file's own name, so it is recognised by shape. */
const FILENAME = /^[^\s/\\]+\.[a-z0-9]{1,12}$/i

export function customKind(label: unknown, content: unknown): CustomKind {
  if (typeof content === 'boolean') {
    return 'bool'
  }

  if (content === null) {
    return 'null'
  }

  // json() decodes to an array or object and sends an empty label; there is
  // nothing else that arrives as a structure rather than a string.
  if (typeof content === 'object') {
    return 'json'
  }

  const name = typeof label === 'string' ? label.trim() : ''
  const known = BY_LABEL[name.toLowerCase()]

  if (known !== undefined) {
    return known
  }

  if (FILENAME.test(name) || (typeof content === 'string' && content.startsWith('File not found:'))) {
    return 'file'
  }

  return 'plain'
}

/** The `src` out of the single-tag document image() builds. */
export function imageSource(content: unknown): string | null {
  if (typeof content !== 'string') {
    return null
  }

  return /<img[^>]*\ssrc=["']?([^"'>\s]+)/i.exec(content)?.[1] ?? null
}

/**
 * Which helper sent a `table` payload — same trick, and the same reason: a
 * cache write and a phpinfo dump are not one thing.
 */
export type TableKind = 'phpinfo' | 'cache' | 'env' | 'table'

const TABLE_BY_LABEL: Record<string, TableKind> = {
  phpinfo: 'phpinfo',
  cache: 'cache',
  '.env': 'env',
}

export function tableKind(label: unknown): TableKind {
  const name = typeof label === 'string' ? label.trim().toLowerCase() : ''

  return TABLE_BY_LABEL[name] ?? 'table'
}
