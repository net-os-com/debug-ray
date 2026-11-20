export function withContentType(headers: Record<string, string>, body: string): Record<string, string> {
  if (Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    return headers
  }

  return { ...headers, 'Content-Type': looksLikeJson(body) ? 'application/json' : 'text/plain; charset=utf-8' }
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim()

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false
  }

  try {
    JSON.parse(trimmed)

    return true
  } catch {
    return false
  }
}
