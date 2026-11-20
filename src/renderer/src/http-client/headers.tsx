/** The header names whose value is a credential rather than information. */
const SECRET = /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie|x-amz-security-token|x-auth-token)$/i

/** What the package writes in place of a credential it stripped. */
function redacted(value: string): boolean {
  return value.startsWith('‹redacted')
}

type HeadersProps = {
  headers: { key: string; value: string }[]
  secrets: boolean
  onToggle: () => void
}

/**
 * A credential is hidden until it is asked for.
 *
 * Two layers, deliberately. The package replaces the headers it knows about
 * before they leave PHP, so the token never reaches this window at all; this
 * hides whatever else looks like a credential but arrived in the clear — a
 * header somebody's `redact` list does not cover yet.
 *
 * A value the package already replaced is shown as it is: `‹redacted, 31
 * characters›` is not a secret, it is the explanation of one, and masking it
 * would promise a reveal that cannot happen.
 */
export function Headers({ headers, secrets, onToggle }: HeadersProps) {
  if (headers.length === 0) {
    return <div className="api-pairs__empty">No headers.</div>
  }

  return (
    <div className="hc-section">
      <div className="hc-section__head">
        <span className="hc-section__title">Headers</span>
        <button className="hc-switch" onClick={onToggle} type="button">
          <span className={secrets ? 'hc-switch__track hc-switch__track--on' : 'hc-switch__track'}>
            <span className="hc-switch__knob" />
          </span>
          Show secrets
        </button>
      </div>

      <div className="hc-headers">
        {headers.map((header, index) => {
          const hidden = !secrets && SECRET.test(header.key) && !redacted(header.value)

          return (
            <div className="hc-headers__row" key={`${header.key}-${index}`}>
              <span className="hc-dim">{header.key}</span>
              <span className={hidden ? 'hc-dim' : ''}>
                {hidden ? '•'.repeat(Math.min(24, Math.max(8, header.value.length))) : header.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
