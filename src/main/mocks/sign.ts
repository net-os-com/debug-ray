import { createHmac } from 'node:crypto'
import type { MockSignature } from '../../shared/mocks/types'

export function signatureHeaders(
  signature: MockSignature,
  secret: string,
  body: string,
  nowSeconds: number,
): Record<string, string> {
  const hmac = (payload: string) => createHmac('sha256', secret).update(payload).digest('hex')

  if (signature.kind === 'hmac-sha256') {
    return { [signature.header]: `${signature.prefix}${hmac(body)}` }
  }

  if (signature.kind === 'stripe') {
    return { 'Stripe-Signature': `t=${nowSeconds},v1=${hmac(`${nowSeconds}.${body}`)}` }
  }

  return {}
}
