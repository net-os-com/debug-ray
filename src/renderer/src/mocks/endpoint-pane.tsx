import { useState } from 'react'
import type { MockChoices, MockEndpoint, MockService } from '../../../shared/mocks/types'
import { activeResponse } from '../../../shared/mocks/active'
import { addResponse, removeResponse, updateEndpoint, updateResponse } from './edit-service'
import { EndpointEditor } from './endpoint-editor'
import { ResponseEditor } from './response-editor'
import { ResponseList } from './response-list'

type EndpointPaneProps = {
  service: MockService
  endpoint: MockEndpoint
  choices: MockChoices
  onEdit: (change: (service: MockService) => MockService) => void
  onChoose: (responseId: string) => void
  onDelete: () => void
}

export function EndpointPane({ service, endpoint, choices, onEdit, onChoose, onDelete }: EndpointPaneProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const active = activeResponse(service.name, endpoint, choices)
  const editing = endpoint.responses.find((one) => one.id === editingId) ?? active
  const resetKey = `${service.name}/${endpoint.id}`

  const add = (): void => {
    const made = addResponse(service, endpoint.id, 'New response')

    onEdit(() => made.service)
    setEditingId(made.responseId)
  }

  return (
    <div className="mk-pane">
      <EndpointEditor
        endpoint={endpoint}
        onChange={(patch) => onEdit((s) => updateEndpoint(s, endpoint.id, patch))}
        onDelete={onDelete}
        serviceName={service.name}
      />

      <ResponseList
        active={active}
        editing={editing?.id ?? null}
        endpoint={endpoint}
        onAdd={add}
        onChoose={onChoose}
        onEdit={setEditingId}
      />

      {editing === null ? null : (
        <ResponseEditor
          canDelete={endpoint.responses.length > 1}
          onChange={(patch) => onEdit((s) => updateResponse(s, endpoint.id, editing.id, patch))}
          onDelete={() => {
            onEdit((s) => removeResponse(s, endpoint.id, editing.id))
            setEditingId(null)
          }}
          resetKey={resetKey}
          response={editing}
        />
      )}
    </div>
  )
}
