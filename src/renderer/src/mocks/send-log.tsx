import type { WebhookOutcome } from '../../../shared/mocks/types'
import { statusBackground, statusColor } from '../api/method-color'

type SendLogProps = {
  sends: WebhookOutcome[]
  webhookId: string
  openInRequests: (debugId: string) => (() => void) | null
}

export function SendLog({ sends, webhookId, openInRequests }: SendLogProps) {
  const shown = sends.filter((one) => one.webhookId === webhookId)

  return (
    <div className="mk-calls">
      <div className="mk-calls__head">
        <span className="mk-section__title">Sends</span>
        <span className="mk-hint">This webhook</span>
      </div>

      <div className="mk-calls__list">
        {shown.length === 0 ? <p className="mk__placeholder">Nothing sent yet.</p> : null}

        {shown.map((one, index) => {
          const open = one.result === null ? null : openInRequests(one.result.debugId)

          return (
            <div className="mk-call" key={`${one.at}/${index}`}>
              <span className="mk-call__line">
                <span className="mk-hint mk-mono">{new Date(one.at).toLocaleTimeString()}</span>
                <span className="mk-call__gap" />
                {one.result === null ? (
                  <span className="hc-status mk-notsent">Not sent</span>
                ) : (
                  <span
                    className="hc-status"
                    style={{
                      background: statusBackground(one.result.status),
                      color: statusColor(one.result.status),
                    }}
                  >
                    {one.result.status}
                  </span>
                )}
              </span>

              {one.result === null ? null : (
                <span className="mk-hint">{Math.round(one.result.timing.total)} ms</span>
              )}
              {one.edited ? <span className="mk-hint">Edited body</span> : null}
              {one.error === null ? null : <span className="mk-call__none">{one.error}</span>}

              {open === null ? null : (
                <button className="api-response__link mk-send-link" onClick={open} type="button">
                  Open in Requests →
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
