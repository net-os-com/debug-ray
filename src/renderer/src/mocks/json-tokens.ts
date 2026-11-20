import type { EditorToken } from '../ui/code-editor'

const SPLIT = /("(?:[^"\\]|\\.)*"(?=\s*:)|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/

const KEY = /^"(?:[^"\\]|\\.)*"$/

/** Highlights one line of JSON; what it does not recognise stays plain. */
export function tokenizeJson(line: string): EditorToken[] {
  const parts = line.split(SPLIT).filter(Boolean)

  return parts.map((text, index) => {
    if (text.startsWith('"')) {
      const isKey = KEY.test(text) && /^\s*:/.test(parts[index + 1] ?? '')

      return { text, color: isKey ? 'var(--dump-note)' : 'var(--dump-string)', italic: false }
    }

    if (/^-?\d/.test(text)) {
      return { text, color: 'var(--dump-number)', italic: false }
    }

    if (/^(true|false|null)$/.test(text)) {
      return { text, color: 'var(--dump-const)', italic: false }
    }

    return { text, color: 'var(--t2)', italic: false }
  })
}
