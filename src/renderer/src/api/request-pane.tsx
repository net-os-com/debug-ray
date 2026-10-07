import type { ApiBodyMode } from '../../../shared/api'
import { EnvPicker } from './env-picker'
import { methodColor } from './method-color'
import { AuthTab } from './auth-tab'
import { PairRows } from './pair-rows'
import { SaveMenu } from './save-menu'
import { urlTokens } from './url-tokens'
import { initials } from './method-color'
import type { ApiState, RequestTab } from './use-api'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const TAB_LABELS: Record<RequestTab, string> = {
  params: 'Params',
  headers: 'Headers',
  body: 'Body',
  auth: 'Auth',
}

export function RequestPane({ api }: { api: ApiState }) {
  const { request, tab } = api

  const params = Object.fromEntries(request.pathParams.map((one) => [one.key, one.value]))
  const counts: Record<RequestTab, number> = {
    params: request.pathParams.length + request.query.filter((one) => one.enabled).length,
    headers: request.headers.filter((one) => one.enabled).length,
    body: request.bodyMode === 'none' ? 0 : 1,
    auth: request.auth.mode === 'none' ? 0 : 1,
  }

  return (
    <section className="api-request">
      <div className="api-request__head">
        <EnvPicker api={api} />

        <select
          className="api-request__method"
          onChange={(event) => api.patch({ method: event.target.value })}
          style={{ color: methodColor(request.method) }}
          value={request.method}
        >
          {METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        <input
          className="api-request__path"
          onChange={(event) => api.patch({ path: event.target.value })}
          placeholder="/desks"
          value={request.path}
        />

        <SaveMenu api={api} />

        <button
          className="api-request__actor"
          onClick={() => api.setTab('auth')}
          title="Who this request is sent as"
          type="button"
        >
          {api.request.auth.mode === 'impersonate' && api.request.auth.userLabel !== '' ? (
            <>
              <span className="api-request__initials">{initials(api.request.auth.userLabel)}</span>
              {api.request.auth.userLabel}
            </>
          ) : api.request.auth.mode === 'impersonate' ? (
            // A saved request keeps the mode but not who, so this is the state
            // a reopened one lands in — and it should say so rather than claim
            // the request carries no authentication at all.
            'impersonate · pick someone'
          ) : api.request.auth.mode === 'bearer' ? (
            // "token · token" says one thing twice; the variable is only worth
            // naming when it is not the obvious one.
            api.request.auth.variable === 'token' ? (
              'bearer token'
            ) : (
              `bearer · ${api.request.auth.variable}`
            )
          ) : (
            'no auth'
          )}
        </button>

        <button
          className="button button--primary api-request__send"
          disabled={api.sending || api.environment === null}
          onClick={() => void api.send()}
          type="button"
        >
          {api.sending ? 'Sending' : 'Send'}
          <span className="api-request__shortcut" title="⌘ Enter">
            ⌘↵
          </span>
        </button>
      </div>

      <div className="api-request__url">
        <span className="api-request__tokens">
          <span className="api-chip">{api.environment?.host ?? 'no environment'}</span>
          {urlTokens(request.path, params).map((token, index) => (
            <span className={tokenClass(token.kind)} key={index}>
              {token.text}
            </span>
          ))}
        </span>
        {/* Only worth the room when it differs — with no variables and no
            parameters it is the same string twice. */}
        {api.url === plain(api) ? null : (
          <span className="api-request__resolved" title={api.url}>
            {api.url}
          </span>
        )}
      </div>

      <div className="api-request__tabs">
        {(['params', 'headers', 'body', 'auth'] as RequestTab[]).map((key) => (
          <button
            className={key === tab ? 'api-tab api-tab--on' : 'api-tab'}
            key={key}
            onClick={() => api.setTab(key)}
            type="button"
          >
            {TAB_LABELS[key]}
            {counts[key] > 0 ? <span className="api-tab__count">{counts[key]}</span> : null}
          </button>
        ))}
      </div>

      <div className="api-request__body">
        {tab === 'params' ? (
          <>
            <div className="api-section">Path</div>
            <PairRows
              empty="This route takes no path parameters."
              keyPlaceholder=""
              lockKeys
              onChange={(pathParams) => api.patch({ pathParams })}
              pairs={request.pathParams}
              valuePlaceholder="value"
            />

            <div className="api-section">Query</div>
            <PairRows
              empty=""
              keyPlaceholder="name"
              onChange={(query) => api.patch({ query })}
              pairs={request.query}
              valuePlaceholder="value"
            />
          </>
        ) : null}

        {tab === 'headers' ? (
          <PairRows
            empty=""
            keyPlaceholder="Header"
            onChange={(headers) => api.patch({ headers })}
            pairs={request.headers}
            valuePlaceholder="value"
          />
        ) : null}

        {tab === 'body' ? <BodyTab api={api} /> : null}
        {tab === 'auth' ? <AuthTab api={api} /> : null}
      </div>
    </section>
  )
}

function BodyTab({ api }: { api: ApiState }) {
  const { request } = api
  const problem = jsonProblem(request.json)

  return (
    <>
      <div className="api-body__modes">
        {(['none', 'json', 'form'] as ApiBodyMode[]).map((mode) => (
          <button
            className={mode === request.bodyMode ? 'api-mode api-mode--on' : 'api-mode'}
            key={mode}
            onClick={() => api.patch({ bodyMode: mode })}
            type="button"
          >
            {mode === 'none' ? 'None' : mode === 'json' ? 'JSON' : 'Form'}
          </button>
        ))}

        {request.bodyMode === 'json' && request.json.trim() !== '' ? (
          <span
            className="api-body__state"
            style={{ color: problem === null ? 'var(--t3)' : 'var(--err-fg)' }}
          >
            {problem ?? 'Valid JSON'}
          </span>
        ) : null}
      </div>

      {request.bodyMode === 'none' ? (
        <div className="api-pairs__empty">
          No body will be sent. {request.method} requests usually do not need one.
        </div>
      ) : null}

      {request.bodyMode === 'json' ? (
        <textarea
          className="api-body__json"
          onChange={(event) => api.patch({ json: event.target.value })}
          placeholder={'{\n  "name": "Team lunch"\n}'}
          spellCheck={false}
          value={request.json}
        />
      ) : null}

      {request.bodyMode === 'form' ? (
        <PairRows
          empty=""
          keyPlaceholder="field"
          onChange={(pairs) =>
            api.patch({
              form: pairs.map((pair) => ({ ...pair, file: false })),
            })
          }
          pairs={request.form.map(({ key, value, enabled }) => ({ key, value, enabled }))}
          valuePlaceholder="value"
        />
      ) : null}
    </>
  )
}

/** Null when it parses; otherwise what the parser objected to. */
function jsonProblem(text: string): string | null {
  if (text.trim() === '') {
    return null
  }

  try {
    JSON.parse(text)

    return null
  } catch (error) {
    return error instanceof Error ? error.message.replace(/^JSON\.parse: /, '') : 'Invalid JSON'
  }
}

/** What the token row reads as, so it can be compared with the real URL. */
function plain(api: ApiState): string {
  return `${api.environment?.host ?? ''}${api.request.path}`
}

function tokenClass(kind: 'literal' | 'variable' | 'param'): string | undefined {
  if (kind === 'variable') {
    return 'api-chip'
  }

  return kind === 'param' ? 'api-param' : undefined
}
