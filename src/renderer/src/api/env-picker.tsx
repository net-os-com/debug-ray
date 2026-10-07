import { useState } from 'react'
import type { ApiState } from './use-api'

/**
 * Which stack a request goes to, and what the environment fills in for it.
 *
 * The variables are shown rather than hidden behind a settings screen: the
 * difference between a call that works and one that says "tenant could not be
 * identified" is usually one of these, and you should be able to see it
 * without leaving the request.
 */
export function EnvPicker({ api }: { api: ApiState }) {
  const [open, setOpen] = useState(false)
  const environment = api.environment

  if (environment === null) {
    return null
  }

  return (
    <div className="api-env">
      <button className="api-env__button" onClick={() => setOpen((one) => !one)} type="button">
        <span className="api-env__dot" style={{ background: dotColor(environment.id) }} />
        {environment.label}
        <span className="api-env__caret">▾</span>
      </button>

      {open ? (
        <div className="api-env__menu">
          {api.environments.map((one) => (
            <button
              className="api-env__item"
              key={one.id}
              onClick={() => {
                api.setEnvironmentId(one.id)
                setOpen(false)
              }}
              type="button"
            >
              <span className="api-env__dot" style={{ background: dotColor(one.id) }} />
              <span>
                <span className="api-env__item-label">{one.label}</span>
                <span className="api-env__item-meta">{one.meta || one.host}</span>
              </span>
            </button>
          ))}

          <div className="api-env__vars">
            <div className="api-env__vars-head">Variables · {environment.label}</div>
            {environment.variables.map((variable) => (
              <div className="api-env__var" key={variable.key}>
                <span className="api-env__var-key">{variable.key}</span>
                <input
                  className="api-env__var-input"
                  onChange={(event) =>
                    api.saveEnvironments(
                      api.environments.map((one) =>
                        one.id !== environment.id
                          ? one
                          : {
                              ...one,
                              variables: one.variables.map((each) =>
                                each.key === variable.key
                                  ? { ...each, value: event.target.value }
                                  : each,
                              ),
                            },
                      ),
                    )
                  }
                  placeholder="not set"
                  // A secret is still typed in the clear; hiding it from the
                  // person setting it helps nobody, and it never leaves here.
                  type={variable.secret ? 'password' : 'text'}
                  value={variable.value}
                />
              </div>
            ))}

            <label className="api-env__toggle">
              <input
                checked={environment.impersonate}
                onChange={(event) =>
                  api.saveEnvironments(
                    api.environments.map((one) =>
                      one.id === environment.id
                        ? { ...one, impersonate: event.target.checked }
                        : one,
                    ),
                  )
                }
                type="checkbox"
              />
              <span>
                Allow impersonation
                <span className="api-env__toggle-note">
                  Mints a real token for another account in this stack's database.
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Green for the machine under your desk, red for the one that serves people. */
function dotColor(id: string): string {
  if (id === 'production' || id === 'prod') {
    return 'var(--err-fg)'
  }

  return id === 'local' ? 'var(--ok-fg)' : 'var(--sql-num)'
}
