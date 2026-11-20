import type { MockEndpoint } from '../../../shared/mocks/types'
import { PairRows } from '../api/pair-rows'
import { methodColor } from '../api/method-color'
import { StrokeIcon } from '../chrome/module-icons'
import { TRASH_PATH } from './icon-paths'
import { usePairRows } from './use-pair-rows'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

type EndpointEditorProps = {
  endpoint: MockEndpoint
  serviceName: string
  onChange: (patch: Partial<Omit<MockEndpoint, 'id' | 'responses'>>) => void
  onDelete: () => void
}

export function EndpointEditor({ endpoint, serviceName, onChange, onDelete }: EndpointEditorProps) {
  const [rows, setRows] = usePairRows(endpoint.query, `${serviceName}/${endpoint.id}`, (query) =>
    onChange({ query }),
  )

  return (
    <div className="mk-endpoint">
      <div className="mk-endpoint__head">
        <input
          aria-label="Endpoint name"
          className="mk-endpoint__name"
          onChange={(event) => onChange({ name: event.target.value })}
          value={endpoint.name}
        />
        <button
          aria-label="Delete endpoint"
          className="mk-icon-button mk-icon-button--danger"
          onClick={onDelete}
          title="Delete endpoint"
          type="button"
        >
          <StrokeIcon path={TRASH_PATH} size={15} />
        </button>
      </div>

      <div className="mk-endpoint__line">
        <select
          aria-label="Method"
          className="api-request__method"
          onChange={(event) => onChange({ method: event.target.value })}
          style={{ color: methodColor(endpoint.method) }}
          value={endpoint.method}
        >
          {(METHODS.includes(endpoint.method) ? METHODS : [...METHODS, endpoint.method]).map(
            (method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ),
          )}
        </select>

        <input
          aria-label="Path"
          className="api-request__path"
          onChange={(event) => onChange({ path: event.target.value })}
          placeholder="/v7/device"
          value={endpoint.path}
        />
      </div>

      <div className="mk-section">
        <div className="mk-section__head">
          <span className="mk-section__title">Match when the query has</span>
          <span className="mk-hint">
            <code>*</code> matches anything. Other query parameters are ignored.
          </span>
        </div>

        <PairRows
          empty="No conditions."
          keyPlaceholder="Key"
          onChange={setRows}
          pairs={rows}
          toggles={false}
          valuePlaceholder="Value"
        />
      </div>
    </div>
  )
}
