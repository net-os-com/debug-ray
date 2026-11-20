import type { MockSignature } from '../../../shared/mocks/types'

const KINDS: { kind: MockSignature['kind']; label: string }[] = [
  { kind: 'none', label: 'None' },
  { kind: 'hmac-sha256', label: 'HMAC-SHA256' },
  { kind: 'stripe', label: 'Stripe' },
]

type SignaturePanelProps = {
  signature: MockSignature
  onChange: (signature: MockSignature) => void
}

export function SignaturePanel({ signature, onChange }: SignaturePanelProps) {
  const patch = (next: Partial<MockSignature>): void => onChange({ ...signature, ...next })

  return (
    <div className="mk-signature">
      <div className="mk-signature__col">
        <span className="mk-section__title">Signature</span>
        <select
          aria-label="Signature kind"
          className="mk-field"
          onChange={(event) => patch({ kind: event.target.value as MockSignature['kind'] })}
          value={signature.kind}
        >
          {KINDS.map((one) => (
            <option key={one.kind} value={one.kind}>
              {one.label}
            </option>
          ))}
        </select>

        {signature.kind === 'hmac-sha256' ? (
          <div className="mk-signature__pair">
            <input
              aria-label="Signature header"
              className="mk-field mk-mono"
              onChange={(event) => patch({ header: event.target.value })}
              placeholder="X-Signature"
              value={signature.header}
            />
            <input
              aria-label="Signature prefix"
              className="mk-field mk-mono"
              onChange={(event) => patch({ prefix: event.target.value })}
              placeholder="sha256="
              value={signature.prefix}
            />
          </div>
        ) : null}

        <span className="mk-hint">Signed at send time, over the exact body that goes out.</span>
      </div>

      {signature.kind === 'none' ? null : (
        <div className="mk-signature__col">
          <label className="mk-section__title" htmlFor="mk-secret-config">
            Secret from config
          </label>
          <input
            className="mk-field mk-mono"
            id="mk-secret-config"
            onChange={(event) => patch({ secretConfig: event.target.value })}
            placeholder="services.mollie.webhook_secret"
            value={signature.secretConfig}
          />
          <span className="mk-hint">Read from the application when you send. Never stored here.</span>
        </div>
      )}
    </div>
  )
}
