import type { MockSignature } from '../../../shared/mocks/types'

export const WEBHOOK_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE', 'GET']

export function signatureHint(signature: MockSignature): string | null {
  if (signature.kind === 'stripe') {
    return 'Stripe-Signature: t=<time>,v1=<HMAC-SHA256 of "time.body">'
  }

  if (signature.kind === 'hmac-sha256') {
    const header = signature.header.trim() === '' ? 'Header' : signature.header

    return `${header}: ${signature.prefix}<HMAC-SHA256 of the body>`
  }

  return null
}
