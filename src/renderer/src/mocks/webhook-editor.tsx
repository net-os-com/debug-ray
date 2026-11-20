import { useState } from 'react'
import type { MockWebhook } from '../../../shared/mocks/types'
import { PairRows } from '../api/pair-rows'
import { methodColor } from '../api/method-color'
import { StrokeIcon } from '../chrome/module-icons'
import { CodeEditor } from '../ui/code-editor'
import { LOCK_PATH, PENCIL_PATH, SEND_PATH, TRASH_PATH } from './icon-paths'
import { tokenizeJson } from './json-tokens'
import { SignaturePanel } from './signature-panel'
import { WEBHOOK_METHODS, signatureHint } from './signature-hint'
import { usePairRows } from './use-pair-rows'

export const LOCAL_ONLY_TITLE = 'Webhooks only go to the local stack. Pick Local in the API tab.'

type WebhookEditorProps = {
  webhook: MockWebhook
  serviceName: string
  host: string
  canSend: boolean
  sending: boolean
  oneOffBody: string | null
  onChange: (patch: Partial<Omit<MockWebhook, 'id'>>) => void
  onDelete: () => void
  onSend: () => void
  onOneOff: (body: string | null) => void
  onSaveOneOff: () => void
}

export function WebhookEditor({
  webhook,
  serviceName,
  host,
  canSend,
  sending,
  oneOffBody,
  onChange,
  onDelete,
  onSend,
  onOneOff,
  onSaveOneOff,
}: WebhookEditorProps) {
  const [tab, setTab] = useState<'body' | 'headers'>('body')
  const [rows, setRows] = usePairRows(webhook.headers, `${serviceName}/${webhook.id}`, (headers) =>
    onChange({ headers }),
  )

  const count = Object.keys(webhook.headers).length
  const hint = signatureHint(webhook.signature)

  return (
    <div className="mk-pane">
      <div className="mk-endpoint">
        <div className="mk-endpoint__head">
          <input
            aria-label="Webhook name"
            className="mk-endpoint__name"
            onChange={(event) => onChange({ name: event.target.value })}
            value={webhook.name}
          />
          <button
            aria-label="Delete webhook"
            className="mk-icon-button mk-icon-button--danger"
            onClick={onDelete}
            title="Delete webhook"
            type="button"
          >
            <StrokeIcon path={TRASH_PATH} size={15} />
          </button>
          <button
            className="button button--primary mk-send"
            disabled={!canSend || sending}
            onClick={onSend}
            title={canSend ? 'Send this webhook' : LOCAL_ONLY_TITLE}
            type="button"
          >
            <StrokeIcon path={SEND_PATH} size={14} />
            Send
            <span className="mk-mono mk-send__key">⌘↵</span>
          </button>
        </div>

        <div className="mk-endpoint__line">
          <select
            aria-label="Method"
            className="api-request__method"
            onChange={(event) => onChange({ method: event.target.value })}
            style={{ color: methodColor(webhook.method) }}
            value={webhook.method}
          >
            {(WEBHOOK_METHODS.includes(webhook.method)
              ? WEBHOOK_METHODS
              : [...WEBHOOK_METHODS, webhook.method]
            ).map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>

          <div className="mk-target">
            <span className="mk-target__host mk-mono" title={host}>
              {host}
            </span>
            <input
              aria-label="Path"
              className="mk-target__path mk-mono"
              onChange={(event) => onChange({ path: event.target.value })}
              placeholder="/stripe/webhook"
              value={webhook.path}
            />
          </div>

          <span className="mk-chip">
            <StrokeIcon path={LOCK_PATH} size={13} />
            Local only
          </span>
        </div>
      </div>

      <SignaturePanel onChange={(signature) => onChange({ signature })} signature={webhook.signature} />

      <div className="mk-resp-editor">
        <div className="mk-resp-editor__tabs">
          <button
            className={tab === 'body' ? 'api-tab api-tab--on' : 'api-tab'}
            onClick={() => setTab('body')}
            type="button"
          >
            Body
          </button>
          <button
            className={tab === 'headers' ? 'api-tab api-tab--on' : 'api-tab'}
            onClick={() => setTab('headers')}
            type="button"
          >
            Headers
            {count > 0 ? <span className="api-tab__count">{count}</span> : null}
          </button>
        </div>

        {tab === 'body' ? (
          <>
            {oneOffBody === null ? null : (
              <div className="mk-oneoff">
                <StrokeIcon path={PENCIL_PATH} size={15} />
                <span className="mk-oneoff__text">Edited for this send only. The file keeps the original.</span>
                <button className="button mk-oneoff__button" onClick={() => onOneOff(null)} type="button">
                  Revert
                </button>
                <button className="button mk-oneoff__button" onClick={onSaveOneOff} type="button">
                  Keep in fixture
                </button>
              </div>
            )}
            <div className="mk-resp-editor__body">
              <CodeEditor
                code={oneOffBody ?? webhook.body}
                onChange={(body) => onOneOff(body === webhook.body ? null : body)}
                tokenize={tokenizeJson}
              />
            </div>
          </>
        ) : (
          <div className="mk-resp-editor__headers">
            <PairRows
              empty="No headers."
              keyPlaceholder="Header"
              onChange={setRows}
              pairs={rows}
              toggles={false}
              valuePlaceholder="Value"
            />
          </div>
        )}

        {hint === null ? null : <div className="mk-sighint mk-mono">{hint}</div>}
      </div>
    </div>
  )
}
