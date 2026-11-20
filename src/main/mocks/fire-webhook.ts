import type { ApiResult, ApiSend } from '../../shared/api'
import { isLocalHost } from '../../shared/mocks/local-host'
import type { WebhookFire, WebhookOutcome } from '../../shared/mocks/types'
import { withContentType } from './content-type'
import type { readSecret } from './package-bridge'
import { signatureHeaders } from './sign'

type FireWebhookDeps = {
  readSecret: typeof readSecret
  send: (options: ApiSend) => Promise<ApiResult>
  now: () => number
}

export async function fireWebhook(fire: WebhookFire, deps: FireWebhookDeps): Promise<WebhookOutcome> {
  const { webhook } = fire
  const at = deps.now()
  const failed = (error: string): WebhookOutcome => ({
    webhookId: webhook.id,
    at,
    sent: false,
    result: null,
    error,
    edited: false,
  })

  if (!isLocalHost(fire.host)) {
    return failed('Webhooks only go to the local stack: localhost, 127.0.0.1 or a .test host.')
  }

  try {
    let signed: Record<string, string> = {}

    if (webhook.signature.kind !== 'none') {
      const { secret, error } = await deps.readSecret(fire.containerId, fire.workingDir, webhook.signature.secretConfig)

      if (secret === null) {
        return failed(error ?? `${webhook.signature.secretConfig} could not be read.`)
      }

      signed = signatureHeaders(webhook.signature, secret, webhook.body, Math.floor(at / 1000))
    }

    const headers = { ...withContentType(webhook.headers, webhook.body), ...signed }
    const result = await deps.send({
      environmentId: '',
      method: webhook.method,
      url: fire.host + webhook.path,
      headers: Object.entries(headers).map(([key, value]) => ({ key, value })),
      body: webhook.body,
      form: null,
      insecure: fire.insecure,
      timeoutMs: 30_000,
    })

    return { webhookId: webhook.id, at, sent: true, result, error: null, edited: false }
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error))
  }
}
