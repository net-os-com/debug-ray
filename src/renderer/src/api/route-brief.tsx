import type { AppRoute, ContractField, RouteContext } from '../../../shared/tools'
import { isDemanded } from './body-skeleton'

type RouteBriefProps = {
  route: AppRoute | null
  context: RouteContext | null
  /** Null when the body is not JSON, or when there is nothing to fill it with. */
  onFillBody: ((all: boolean) => void) | null
}

/**
 * What the route expects, before you send anything.
 *
 * Every other client makes you learn the shape of a request by sending an empty
 * one and reading the rejection. The shape is in the code, so this reads it out
 * instead: the middleware that will run, the DTO the controller takes, and each
 * field's type and rules.
 */
export function RouteBrief({ route, context, onFillBody }: RouteBriefProps) {
  if (route === null && context === null) {
    return null
  }

  const rows = [
    { key: 'Name', value: route?.name ?? context?.name ?? '' },
    { key: 'Action', value: shortAction(route?.action ?? context?.action ?? '') },
    { key: 'Methods', value: (route?.methods ?? context?.methods ?? []).join(', ') },
  ].filter((row) => row.value !== '')

  return (
    <div className="brief">
      {rows.length === 0 ? null : (
        <>
          <div className="brief__label">Route</div>
          {rows.map((row) => (
            <div className="brief__row" key={row.key}>
              <span className="brief__key">{row.key}</span>
              <span className="brief__value">{row.value}</span>
            </div>
          ))}
        </>
      )}

      {route === null || route.middleware.length === 0 ? null : (
        <>
          <div className="brief__label">Middleware</div>
          <div className="brief__chips">
            {route.middleware.map((one) => (
              <span className="chips__one" key={one} title={one}>
                {one.includes('\\') ? (one.split('\\').pop() ?? one) : one}
              </span>
            ))}
          </div>
        </>
      )}

      {context === null || context.fields.length === 0 ? null : (
        <Contract context={context} onFillBody={onFillBody} />
      )}
    </div>
  )
}

function Contract({
  context,
  onFillBody,
}: {
  context: RouteContext
  onFillBody: ((all: boolean) => void) | null
}) {
  const required = context.fields.filter(isDemanded).length

  return (
    <>
      <div className="brief__label">
        {context.kind === 'data' ? 'Accepts' : 'Validation'}
        <span className="brief__contract" title={context.contract ?? ''}>
          {context.contract?.split('\\').pop()}
        </span>
      </div>

      {onFillBody === null ? null : (
        <div className="brief__actions">
          <button className="button" onClick={() => onFillBody(false)} type="button">
            Fill body{required > 0 ? ` · ${required} required` : ''}
          </button>
          <button className="button" onClick={() => onFillBody(true)} type="button">
            Fill all {context.fields.length}
          </button>
        </div>
      )}

      <div className="brief__fields">
        {context.fields.map((field) => (
          <Field field={field} key={field.name} />
        ))}
      </div>
    </>
  )
}

function Field({ field }: { field: ContractField }) {
  return (
    <div className="brief__field">
      <span className={isDemanded(field) ? 'brief__name brief__name--required' : 'brief__name'}>
        {field.name}
      </span>
      <span className="brief__type">
        {field.type}
        {field.type !== '' && field.nullable ? '?' : ''}
      </span>
      <span className="brief__rules">
        {field.rules.map((rule) => (
          <span className="brief__rule" key={rule}>
            {rule}
          </span>
        ))}
      </span>
    </div>
  )
}

/** `App\Http\Controllers\User\UserController@store` is one useful word. */
function shortAction(action: string): string {
  return action.includes('\\') ? (action.split('\\').pop() ?? action) : action
}
