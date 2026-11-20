export function isLocalHost(url: string): boolean {
  let hostname: string

  try {
    hostname = new URL(url).hostname
  } catch {
    return false
  }

  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.test')
}
