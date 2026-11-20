import { useEffect, useMemo, useState } from 'react'
import type { OutgoingCall } from '../../../shared/http-client'
import type { MockService } from '../../../shared/mocks/types'
import { StrokeIcon } from '../chrome/module-icons'
import { CodeEditor } from '../ui/code-editor'
import { applyCall, endpointFor, endpointFromCall, isTruncated, responseFromCall } from './from-call'
import { newService } from './edit-service'
import { tokenizeJson } from './json-tokens'
import type { MocksData } from './use-mocks'

const NEW_SERVICE = '__new__'
const CLOSE_PATH = 'M6 18 18 6M6 6l12 12'
const WARN_PATH =
  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'

const TRUNCATION_MESSAGE =
  "This body was cut at the package's limit. Raise netos-debug.http_client.max_body_bytes and record the call again."

type SaveAsMockDialogProps = {
  call: OutgoingCall
  mocks: MocksData
  onClose: () => void
}

export function SaveAsMockDialog({ call, mocks, onClose }: SaveAsMockDialogProps) {
  const services = mocks.state.services
  const matched = useMemo(() => endpointFor(services, call), [services, call])

  // Null until picked, so a list that arrives after the dialog opened still sets the default.
  const [chosen, setChosen] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [name, setName] = useState(`${call.status} ${call.reason}`.trim())
  const [target, setTarget] = useState<'matched' | 'new'>('matched')
  const [body, setBody] = useState(call.responseBody)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const serviceKey = chosen ?? matched?.service ?? services[0]?.name ?? NEW_SERVICE
  const picked = services.find((one) => one.name === serviceKey) ?? null
  const creating = picked === null
  const service: MockService = picked ?? newService(title.trim() === '' ? 'New service' : title.trim(), services)
  const match = creating ? null : endpointFor([service], call)
  const endpoint = match === null ? null : (service.endpoints.find((one) => one.id === match.endpointId) ?? null)
  const useMatch = endpoint !== null && target === 'matched'

  const truncated = isTruncated(call.responseBody)
  const { dropped } = responseFromCall(call, name, [])
  const kept = call.responseHeaders.filter((one) => !dropped.includes(one.key))
  const file = creating ? `mocks/${service.name}.yaml` : service.file
  const url = new URL(call.url)
  const draft = endpointFromCall(call, service.endpoints.map((one) => one.id))
  const canSave = !truncated && !saving && name.trim() !== '' && (!creating || title.trim() !== '')

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)

    const next = applyCall(service, call, useMatch ? endpoint.id : null, name.trim(), body)
    const { error: failure } = await mocks.save(next)

    setSaving(false)

    if (failure === null) {
      onClose()
    } else {
      setError(failure)
    }
  }

  return (
    <div className="sm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div aria-labelledby="save-as-mock-title" aria-modal="true" className="sm" role="dialog">
        <div className="sm__head">
          <div className="sm__heading">
            <h2 className="sm__title" id="save-as-mock-title">
              Save as mock
            </h2>
            <span className="mk-mono mk-hint">
              {call.method} {call.host}
              {url.pathname} · {call.status}
              {call.context.name === null ? '' : ` · from ${call.context.name}`}
            </span>
          </div>
          <button aria-label="Close" className="mk-icon-button" onClick={onClose} type="button">
            <StrokeIcon path={CLOSE_PATH} size={16} />
          </button>
        </div>

        <div className="sm__body">
          <div className="sm__pair">
            <label className="sm__field">
              <span className="sm__label">Service</span>
              <select className="mk-field" onChange={(event) => setChosen(event.target.value)} value={creating ? NEW_SERVICE : serviceKey}>
                {services.map((one) => (
                  <option key={one.name} value={one.name}>
                    {one.title} · {one.file}
                  </option>
                ))}
                <option value={NEW_SERVICE}>New service…</option>
              </select>
            </label>
            <label className="sm__field">
              <span className="sm__label">Response name</span>
              <input className="mk-field" onChange={(event) => setName(event.target.value)} value={name} />
            </label>
          </div>

          {creating ? (
            <label className="sm__field">
              <span className="sm__label">New service name</span>
              <input
                className="mk-field"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Balena"
                value={title}
              />
            </label>
          ) : null}

          <div aria-label="Endpoint" className="sm__field" role="radiogroup">
            <span className="sm__label">Endpoint</span>
            {endpoint === null ? null : (
              <label className={useMatch ? 'sm__option sm__option--on' : 'sm__option'}>
                <input checked={useMatch} name="endpoint" onChange={() => setTarget('matched')} type="radio" />
                <span className="sm__option-text">
                  <span className="sm__option-name">{endpoint.name}</span>
                  <span className="mk-mono mk-hint">
                    {endpoint.method} {endpoint.path}
                    {Object.entries(endpoint.query).map(([key, value]) => ` · ${key} = ${value}`)}
                  </span>
                </span>
                <span className="sm__match">Matches this call</span>
              </label>
            )}
            <label className={useMatch ? 'sm__option' : 'sm__option sm__option--on'}>
              <input checked={!useMatch} name="endpoint" onChange={() => setTarget('new')} type="radio" />
              <span className="sm__option-text">
                <span className="sm__option-name">New endpoint</span>
                <span className="mk-hint">
                  Prefilled with this call's method, path and query. Swap a value for * to match more.
                </span>
                <span className="mk-mono mk-hint">
                  {draft.method} {draft.path}
                  {Object.entries(draft.query).map(([key, value]) => ` · ${key} = ${value}`)}
                </span>
              </span>
            </label>
          </div>

          <div className="sm__warn" role="note">
            <StrokeIcon path={WARN_PATH} size={18} />
            <div className="sm__warn-text">
              <span className="sm__warn-title">This goes into git.</span>
              <span>Take real customer data out first: device names, UUIDs and tenant ids in variables.</span>
            </div>
          </div>

          <div className="sm__box">
            <div className="sm__box-head">
              <span className="sm__section">Body</span>
            </div>
            {truncated ? (
              <div className="sm__truncated" role="alert">
                {TRUNCATION_MESSAGE}
              </div>
            ) : (
              <div className="sm__editor">
                <CodeEditor code={body} onChange={setBody} tokenize={tokenizeJson} />
              </div>
            )}
          </div>

          <div className="sm__field">
            <span className="sm__section">Headers</span>
            <div className="sm__chips">
              <span className="mk-hint">Kept</span>
              {kept.length === 0 ? <span className="mk-hint">none</span> : null}
              {kept.map((one, index) => (
                <span className="sm__chip" key={`${one.key}-${index}`}>
                  {one.key}: {one.value}
                </span>
              ))}
              {dropped.length === 0 ? null : <span className="mk-hint sm__chips-gap">Left out</span>}
              {call.responseHeaders
                .filter((one) => dropped.includes(one.key))
                .map((one, index) => (
                  <span className="sm__chip sm__chip--out" key={`${one.key}-${index}`}>
                    {one.key}
                    {one.value.startsWith('‹redacted') ? ' ‹redacted›' : ''}
                  </span>
                ))}
            </div>
          </div>

          {error === null ? null : (
            <div className="sm__error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="sm__foot">
          <span className="mk-hint sm__foot-note">
            Written through <span className="mk-mono">netos-debug:mocks save</span>. Review it in the pull request.
          </span>
          <button className="button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="button button--primary" disabled={!canSave} onClick={() => void save()} type="button">
            Save to {file}
          </button>
        </div>
      </div>
    </div>
  )
}
