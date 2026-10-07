import { useEffect, useState } from 'react'
import type { ApiAuthMode, ApiUser } from '../../../shared/api'
import { initials } from './method-color'
import type { ApiState } from './use-api'

const MODES: { key: ApiAuthMode; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'bearer', label: 'Bearer' },
  { key: 'impersonate', label: 'Impersonate' },
]

export function AuthTab({ api }: { api: ApiState }) {
  const { request, environment } = api
  const { auth } = request

  return (
    <>
      <div className="api-body__modes">
        {MODES.map((mode) => (
          <button
            className={mode.key === auth.mode ? 'api-mode api-mode--on' : 'api-mode'}
            key={mode.key}
            onClick={() => api.patch({ auth: { ...auth, mode: mode.key } })}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>

      {auth.mode === 'none' ? (
        <div className="api-pairs__empty">
          No Authorization header will be sent. Most routes here are behind{' '}
          <code>auth:sanctum</code> and will answer 401.
        </div>
      ) : null}

      {auth.mode === 'bearer' ? <Bearer api={api} /> : null}

      {auth.mode === 'impersonate' ? (
        environment?.impersonate === true ? (
          <Impersonate api={api} />
        ) : (
          <div className="api-pairs__empty">
            Impersonation is off for {environment?.label ?? 'this environment'}. It mints a real
            token for someone else's account, so it is turned on per environment rather than
            everywhere at once.
          </div>
        )
      ) : null}
    </>
  )
}

function Bearer({ api }: { api: ApiState }) {
  const { auth } = api.request
  const variables = api.environment?.variables ?? []
  const chosen = variables.find((one) => one.key === auth.variable)

  return (
    <div className="api-auth">
      <div className="api-auth__row">
        <span className="api-auth__label">Token</span>
        <select
          className="tools__select"
          onChange={(event) => api.patch({ auth: { ...auth, variable: event.target.value } })}
          value={auth.variable}
        >
          {variables.map((variable) => (
            <option key={variable.key} value={variable.key}>
              {variable.key}
            </option>
          ))}
        </select>
        <span className="api-auth__value">
          {chosen === undefined
            ? 'no such variable'
            : chosen.value === ''
              ? 'not set'
              : chosen.secret
                ? '•'.repeat(12)
                : chosen.value}
        </span>
      </div>

      <div className="api-auth__note">
        The value lives in this app's own storage, never in a collection file. Set it on the
        environment.
      </div>
    </div>
  )
}

function Impersonate({ api }: { api: ApiState }) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<ApiUser[]>([])
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { auth } = api.request

  // Typing a name should not fire a query per keystroke into a container.
  useEffect(() => {
    const timer = setTimeout(() => {
      void (async () => {
        if (api.container === null) {
          setLoading(false)
          setProblem('No container is selected, so there is nowhere to look for users.')

          return
        }

        setLoading(true)
        setProblem(null)

        try {
          setUsers(
            await window.ray.searchApiUsers(
              api.container.id,
              api.container.workingDir,
              api.tenant,
              query,
            ),
          )
        } catch (error) {
          // An older build's preload has no such function, and the call throws
          // before anything can await it. Without this the spinner is the last
          // thing that ever happens, which reads as a hang rather than as the
          // app being out of date.
          setProblem(
            error instanceof Error
              ? `${error.message}. If this app was running before it was last built, restart it.`
              : 'The user search failed.',
          )
        } finally {
          setLoading(false)
        }
      })()
    }, 250)

    return () => clearTimeout(timer)
  }, [api.container, api.tenant, query])

  return (
    <div className="api-auth">
      <div className="api-auth__note">
        Requests are sent with a Sanctum token minted for the chosen user, good for fifteen
        minutes. It is written to the container's database, so it authenticates against a stack
        backed by that same database and nowhere else.
      </div>

      <div className="api-auth__row">
        <input
          className="api-side__search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users by name or email"
          value={query}
        />
        <button className="button" onClick={() => void api.revoke()} type="button">
          Revoke minted tokens
        </button>
      </div>

      {problem === null ? null : <div className="api-auth__problem">{problem}</div>}

      {api.minted === null ? null : api.minted.error !== null ? (
        <div className="api-auth__problem">{api.minted.error}</div>
      ) : (
        <div className="api-auth__note">
          Holding a token for {api.minted.userLabel}, good for another{' '}
          {Math.max(0, Math.round((api.minted.expiresAt - Date.now()) / 60_000))} minutes.
        </div>
      )}

      <div className="api-users">
        {loading && users.length === 0 ? (
          <div className="api-pairs__empty">Looking in the container…</div>
        ) : users.length === 0 ? (
          problem !== null ? null : (
          <div className="api-pairs__empty">
            {query === '' ? 'No users in this tenant.' : `Nobody matches “${query}”`}
          </div>
          )
        ) : (
          users.map((user) => (
            <button
              className={
                user.id === auth.userId ? 'api-users__one api-users__one--on' : 'api-users__one'
              }
              key={user.id}
              onClick={() =>
                api.patch({ auth: { ...auth, userId: user.id, userLabel: user.label } })
              }
              type="button"
            >
              <span className="api-users__initials">{initials(user.label)}</span>
              <span className="api-users__who">
                <span className="api-users__name">{user.label}</span>
                <span className="api-users__meta">
                  {[user.email, user.roles.join(', ')].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
