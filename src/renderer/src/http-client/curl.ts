import type { OutgoingCall } from '../../../shared/http-client'

/**
 * The call as a cURL command, ready to paste into a terminal.
 *
 * Redacted headers are written out as they arrived — `‹redacted, 31
 * characters›` — rather than quietly dropped: a command that silently lost its
 * Authorization header would fail in a way that looks like the endpoint's
 * fault. The placeholder is obvious, and replacing it is one edit.
 */
export function asCurl(call: OutgoingCall): string {
  const lines = [`curl -X ${call.method} '${quote(call.url)}'`]

  for (const header of call.requestHeaders) {
    // curl sets these two itself, from the URL and the body.
    if (['host', 'content-length'].includes(header.key.toLowerCase())) {
      continue
    }

    lines.push(`  -H '${quote(`${header.key}: ${header.value}`)}'`)
  }

  if (call.requestBody !== '') {
    lines.push(`  --data-raw '${quote(call.requestBody)}'`)
  }

  return lines.join(' \\\n')
}

/** A single quote inside a single-quoted shell string, the only way there is. */
function quote(value: string): string {
  return value.replaceAll("'", `'\\''`)
}
