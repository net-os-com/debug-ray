import { useState } from 'react'
import type { MockResponse } from '../../../shared/mocks/types'
import { PairRows } from '../api/pair-rows'
import { StrokeIcon } from '../chrome/module-icons'
import { CodeEditor } from '../ui/code-editor'
import { TRASH_PATH } from './icon-paths'
import { tokenizeJson } from './json-tokens'
import { NumberField } from './number-field'
import { usePairRows } from './use-pair-rows'

type ResponseEditorProps = {
  response: MockResponse
  resetKey: string
  canDelete: boolean
  onChange: (patch: Partial<Omit<MockResponse, 'id'>>) => void
  onDelete: () => void
}

export function ResponseEditor({ response, resetKey, canDelete, onChange, onDelete }: ResponseEditorProps) {
  const [tab, setTab] = useState<'body' | 'headers'>('body')
  const [rows, setRows] = usePairRows(response.headers, `${resetKey}/${response.id}`, (headers) =>
    onChange({ headers }),
  )

  const count = Object.keys(response.headers).length

  return (
    <div className="mk-resp-editor">
      <div className="mk-resp-editor__head">
        <input
          aria-label="Response name"
          className="mk-resp-editor__name"
          onChange={(event) => onChange({ name: event.target.value })}
          value={response.name}
        />
        <label className="mk-hint mk-resp-editor__field">
          Status
          <NumberField label="Status" max={599} min={100} onCommit={(status) => onChange({ status })} value={response.status} />
        </label>
        <label className="mk-hint mk-resp-editor__field">
          Delay
          <NumberField label="Delay in ms" max={60000} min={0} onCommit={(delayMs) => onChange({ delayMs })} value={response.delayMs} />
          ms
        </label>
        <button
          aria-label="Delete response"
          className="mk-icon-button mk-icon-button--danger"
          disabled={!canDelete}
          onClick={onDelete}
          title={canDelete ? 'Delete response' : 'An endpoint keeps at least one response'}
          type="button"
        >
          <StrokeIcon path={TRASH_PATH} size={15} />
        </button>
      </div>

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
        <div className="mk-resp-editor__body">
          <CodeEditor code={response.body} onChange={(body) => onChange({ body })} tokenize={tokenizeJson} />
        </div>
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
    </div>
  )
}
