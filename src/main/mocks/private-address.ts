export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) {
    return false
  }

  const lower = address.toLowerCase()
  const mapped = lower.startsWith('::ffff:') ? lower.slice(7) : lower

  if (mapped === '::1') {
    return true
  }

  const parts = mapped.split('.').map(Number)

  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts

    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }

  return /^f[cd][0-9a-f]{2}:/.test(mapped)
}
