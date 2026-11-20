import type { MockEndpoint, MockResponse } from '../../../shared/mocks/types'
import { size, statusBackground, statusColor } from '../api/method-color'
import { StrokeIcon } from '../chrome/module-icons'
import { PLUS_PATH } from './icon-paths'

function summary(response: MockResponse): string {
  const parts = [response.body === '' ? 'No body' : size(response.body.length)]

  if (response.delayMs > 0) {
    parts.push(`waits ${response.delayMs} ms`)
  }

  return parts.join(' · ')
}

type ResponseListProps = {
  endpoint: MockEndpoint
  active: MockResponse | null
  editing: string | null
  onChoose: (responseId: string) => void
  onEdit: (responseId: string) => void
  onAdd: () => void
}

export function ResponseList({ endpoint, active, editing, onChoose, onEdit, onAdd }: ResponseListProps) {
  return (
    <div className="mk-section">
      <div className="mk-section__head mk-section__head--between">
        <span className="mk-section__title">Responses</span>
        <button className="mk-ghost-button" onClick={onAdd} type="button">
          <StrokeIcon path={PLUS_PATH} size={14} />
          Add response
        </button>
      </div>

      <div aria-label="Active response" className="mk-responses" role="radiogroup">
        {endpoint.responses.map((response) => (
          <div
            className={
              editing === response.id ? 'mk-response mk-response--editing' : 'mk-response'
            }
            key={response.id}
          >
            <input
              aria-label={`Use ${response.name}`}
              checked={active?.id === response.id}
              className="mk-response__radio"
              name={`active-${endpoint.id}`}
              onChange={() => onChoose(response.id)}
              type="radio"
            />
            <button className="mk-response__body" onClick={() => onEdit(response.id)} type="button">
              <span className="mk-response__name">{response.name}</span>
              <span className="mk-hint">{summary(response)}</span>
            </button>
            <span
              className="hc-status"
              style={{
                background: statusBackground(response.status),
                color: statusColor(response.status),
              }}
            >
              {response.status}
            </span>
          </div>
        ))}
      </div>

      <span className="mk-hint">The active response is yours alone. Switching it never changes the file.</span>
    </div>
  )
}
